Yes. Looking at the runtime, there are a few very likely culprits, and one of them is much bigger than the rest.

## The biggest culprit: `headOnlyVariables` + `instantiateOverUniverse`

This is the one I would suspect first.

In `forwardClosure`, whenever a rule has variables in the head that are not fixed by the body, you do this:

* compute the satisfying substitutions for the body
* then call `instantiateOverUniverse(rule, s, universe)`
* which builds the full Cartesian product of the universe for the free head vars

That means if the universe has size `n`, and a rule has `k` head-only vars, you generate `n^k` candidates.

That gets expensive very quickly.

### Why it is especially costly in your code

`instantiateOverUniverse` calls `cartesianTuples`, which eagerly materialises **all tuples** first, then maps them to facts.

So even before deduplication or rejection, you are paying for:

* all tuple allocation
* all substitution cloning
* all fact allocation
* all key generation
* all map lookups

If inference has recently become slow after language-core changes, this is a prime suspect, because a small change in rule shape can suddenly introduce many more head-only variables or many more moments where those rules fire.

## Second biggest culprit: recomputing full rule matches from scratch

Inside the main agenda loop:

```ts
for (const rule of kb.rulesWithBody(fact.name)) {
  for (const s of bodySatisfied(rule.body, index, emptySubst())) {
    ...
  }
}
```

The important thing here is that when a single new fact arrives, you do **not** only consider matches involving that new fact in the relevant body position.

Instead, `bodySatisfied(...)` searches the whole current index for the whole body again.

So if a rule body is like:

* `p(x, y)`
* `q(y, z)`
* `r(z)`

and a new `q(...)` fact arrives, you still re-enumerate all `p`, all `q`, all `r` combinations compatible with the current index.

That means you repeatedly rediscover old joins.

This is a classic semi-naive evaluation issue: the engine is doing a more naive “re-run the whole join” approach.

That can dominate runtime even before the universe-product problem kicks in.

## Third: `processNewObjects` reruns a lot of work globally

Whenever a derived fact introduces fresh object names, you do:

* run **all axioms** over the expanded universe
* then for **all non-axiom rules with head-only vars**, recompute body satisfaction over the whole index
* then instantiate over the universe again

That means adding one genuinely new object can trigger a fairly global recomputation wave.

So you have two nested forms of repeated work:

1. repeated body matching from scratch
2. repeated universe instantiation from scratch

If the recent changes cause more object creation, this path will get hit much more often.

## Fourth: `agenda.shift()` is O(n)

This is smaller, but still real.

In the main loop:

```ts
const fact = agenda.shift()!
```

On a JS array, `shift()` is linear, because everything else gets moved down.

If you process thousands of facts, that adds avoidable overhead.

Not the main problem, but worth fixing.

Use an index pointer instead:

```ts
let agendaIndex = 0
while (agendaIndex < agenda.length) {
  const fact = agenda[agendaIndex++]
}
```

That is a cheap win.

## Fifth: no discrimination by body position or argument values

You do have:

* `rulesWithBody(fact.name)`
* fact index by predicate name

That is a decent first cut, but it is still pretty coarse.

For `bodySatisfied`, each subgoal scans all facts of that predicate:

```ts
for (const fact of index.get(first.name) ?? [])
```

So if you have many `between(...)` or `collinear(...)` facts, every rule touching that predicate scans the whole bucket, even when some arguments are already bound.

You are missing more selective indexing like:

* by predicate + first arg
* by predicate + second arg
* maybe predicate + tuple prefix depending on arity and common access patterns

Without that, unification is doing a lot of filtering work late.

## Sixth: no body ordering optimisation

`bodySatisfied` uses the body in source order:

```ts
const [first, ...rest] = body
```

So performance depends a lot on rule authoring order.

If a broad predicate comes first and a restrictive predicate comes later, you generate many substitutions only to kill them later.

You would usually want to choose the next body atom based on current bindings and candidate set size.

Even a crude heuristic like “evaluate the most selective / most bound atom first” can make a big difference.

## Seventh: a lot of key/string churn

Every fact insertion does:

```ts
groundKey(f)
```

which creates strings like `pred(a,b,c)` repeatedly.

That is fine at small scale, but once the engine is generating lots of candidate facts, the cost of:

* string building
* map lookups
* object allocation

starts to matter.

Again, probably not the main issue, but it compounds the others.

---

# My ranking of likely culprits

If I had to rank them by likely impact:

### 1. Universe instantiation blow-up

`instantiateOverUniverse` / `cartesianTuples`

### 2. Re-running full joins from scratch

`bodySatisfied(rule.body, index, emptySubst())` on every triggering fact

### 3. Global recomputation when new objects appear

`processNewObjects`

### 4. Poor body ordering / weak indexing

scanning whole predicate buckets

### 5. `agenda.shift()`

easy fix, smaller impact

### 6. String/object allocation churn

secondary but real

---

# The key structural issue

The main structural problem is:

> your engine is not incremental enough

It has some indexing, but operationally it still behaves like:

* “a new fact arrived”
* “re-evaluate too much of the rule space”

rather than:

* “a new fact arrived”
* “only evaluate the newly enabled joins involving that fact”

That is why it will feel fine on tiny examples, then suddenly bog down.

---

# What I would change first

## 1. Fix the agenda

Very easy, low risk.

Replace `shift()` with a cursor.

## 2. Instrument the engine

Before changing semantics, add counters for:

* number of calls to `bodySatisfied`
* number of substitutions yielded
* number of calls to `instantiateOverUniverse`
* number of tuples generated in `cartesianTuples`
* number of candidate heads generated
* number of duplicate facts rejected by `addFact`

That will tell you almost immediately where the time is going.

My guess is you will see huge duplicate/candidate counts.

## 3. Tame head-only variable instantiation

This is probably the first serious algorithmic fix.

At minimum, avoid eager Cartesian materialisation. Make it a generator.

Better still, rethink whether those rules should really be handled by generic forward closure at all. In many systems, object-generating rules are treated specially because they are the source of combinatorial explosion.

## 4. Move toward semi-naive rule firing

When a new fact arrives, use it as the distinguished delta fact for one body slot, rather than recomputing all matches of the whole body.

That is the big algorithmic upgrade.

## 5. Add better fact indexes

Even a simple index like:

* predicate name
* predicate name + arg0
* predicate name + arg1

would likely help a lot.

---

# One code smell worth calling out

This line in `unfold` is probably a bug, though not necessarily a performance one:

```ts
let expandedAny = true
```

Then inside the loop you do:

```ts
expandedAny = expandedAny || unfolded.expanded
```

Since it starts as `true`, it stays `true`.

So `expanded` is effectively always true once you pass that point. That may not affect forward inference speed directly, but it suggests some control-flow / intent drift in this part of the runtime.

---

# My best guess, concretely

If you asked me to bet on one thing, I would bet on this combination:

* recent language changes introduced more rules with head-only variables or more object creation
* that causes `processNewObjects` to fire more often
* that triggers repeated `instantiateOverUniverse(...)`
* and because rule bodies are rechecked from scratch each time, the cost compounds badly

So the slowdown is probably not one tiny local inefficiency. It is more likely:

> object-generating rules + naive recomputation + weak indexing

If you want, I can sketch a concrete semi-naive version of your `forwardClosure` loop in TypeScript, keeping your current data structures mostly intact.

