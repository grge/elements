Yes, very likely.

For your current runtime, I would expect **indexing to help a lot**, though probably not as much as fixing the worst generative behaviour from axioms and fresh-head-variable handling. So I’d put it like this:

* **first-order win:** stop doing explosive global work
* **second-order win:** make each remaining rule application much cheaper with better indexing

But the second one is still important.

## Why indexing helps

Right now, your rule matching is basically doing:

* new fact arrives
* find rules mentioning that predicate
* for each such rule, search the current fact store for matches to the other body atoms

If your fact store is only indexed by predicate name, then for a body atom like:

```text
between(x, y, z)
```

you are effectively scanning **all** `between` facts and checking which ones unify with the current substitution.

That’s fine when there are 10 of them. It gets bad when there are 10,000.

So indexing helps because it turns:

> “scan every fact of this predicate and filter”

into something closer to:

> “jump directly to the small subset that could possibly match”

## A concrete example

Suppose you have a rule:

```text
collinear(a, b, c) :- between(a, b, c)
```

and a query path where `a` and `b` are already bound.

Without indexing, you scan every `between(_, _, _)` fact.

With indexing on `(predicate, arg0, arg1)`, you can go straight to:

```text
between(a, b, ?)
```

That can be dramatically smaller.

Or take something like:

```text
eq_line(a, b, c, d), eq_line(c, d, e, f) -> eq_line(a, b, e, f)
```

If `c,d` are already bound from the first atom, then you really want a fast lookup for:

```text
eq_line(c, d, ?, ?)
```

not a full scan of all `eq_line` facts.

## Why it matters especially in your engine

You currently have two things working against you:

### 1. `bodySatisfied` appears to search whole predicate buckets

So every rule firing redoes a lot of filtering work.

### 2. You re-run body matching from scratch often

That means even moderate inefficiency in each scan gets multiplied many times.

So indexing helps not just once, but in every repeated join.

---

# What kind of indexing would help?

You do **not** need a super fancy database engine to get a big improvement.

A few simple indexes would probably go a long way.

## Level 1: predicate-name index

You probably already have this.

This gets you:

* all `between` facts
* all `collinear` facts
* etc.

Useful, but coarse.

## Level 2: predicate + argument-position indexes

For each predicate, maintain maps like:

* arg0 → facts
* arg1 → facts
* arg2 → facts

For binary or ternary predicates this is already very helpful.

Example:

* `between` indexed by first arg, second arg, third arg
* `on_line` indexed by point and by line
* `on_circle` indexed by point and by circle

Then if a variable is already bound in a body atom, you can use that index.

## Level 3: small tuple indexes for common access patterns

For important predicates, maintain composite indexes like:

* `(arg0, arg1)` → facts
* `(arg1, arg2)` → facts

This is especially good for predicates where rules frequently bind multiple arguments before lookup.

You don’t need every combination for every predicate. Just a few hot ones.

---

# Body ordering and indexing go together

Indexing is much more effective if you also choose body atoms in a smarter order.

Suppose your rule body is:

```text
p(x), between(x, y, z), q(z)
```

If you start with `between(x, y, z)` unbound, even a decent index may not help much.

But if `p(x)` binds `x` first, then when you reach `between(x, y, z)`, you can query a much narrower slice.

So the combination is:

* **choose a selective atom early**
* **use indexes for the bound arguments**

That is where a lot of the speedup comes from.

If you keep source-order body matching, indexing still helps, but less than it could.

---

# Will indexing help axioms?

Less so.

For bodyless axioms, the issue is not lookup, it is **generation volume**. Indexing doesn’t solve that much.

For example:

```text
between(x, y, y) :-
```

The cost is from enumerating many universe tuples, not from fact lookup.

So for axioms:

* better incremental generation is the big fix
* indexing is secondary

## Will indexing help ordinary derived rules?

Yes, very much.

That is where I would expect the most benefit.

---

# My guess for your runtime specifically

I’d guess the current slowdown is coming from a mix of:

* too much global work for axioms / generative rules
* repeated broad scans during body matching

So indexing won’t fix everything, but it will probably make the “normal” part of inference substantially faster.

If you do nothing else, and just add better indexes, you may see a noticeable improvement already.

But if you:

1. restrict or special-case axioms/generative rules, and
2. add indexes,

then you’ll likely get a much more dramatic improvement.

---

# What I would implement first

I would keep it simple.

## First pass

For each predicate, maintain:

* all facts by predicate name
* facts by each single argument position

So something like, conceptually:

```ts
index.byPred.get("between")
index.byArg.get("between", 0).get(a)
index.byArg.get("between", 1).get(b)
index.byArg.get("between", 2).get(c)
```

Then, when matching an atom under a partial substitution:

* inspect which arguments are already bound
* choose the narrowest available index
* only scan those candidates

That is already a good step.

## Second pass

Add composite indexes only for hot predicates and hot patterns, based on profiling.

For example:

* `between(arg0,arg1)`
* `eq_line(arg0,arg1)`
* `on_circle(arg1)` if rules commonly bind the circle first

Don’t try to build every possible combination up front.

---

# A nice extra benefit

Better indexing also makes the engine architecture cleaner, because it pushes you toward a more explicit notion of:

* fact store
* query/match interface
* body atom evaluation under substitution

That makes later improvements easier, like:

* semi-naive evaluation
* smarter join ordering
* memoisation

So even beyond performance, it’s good structural work.

---

# My bottom line

Yes, indexing would likely help your inference materially.

But I’d frame it this way:

* **Axioms / generative rules:** fix semantics and instantiation strategy first
* **Ordinary forward inference:** indexing is one of the most worthwhile optimisations you can make

So I would definitely do it, but I wouldn’t expect indexing alone to solve the whole slowdown if the main issue is still universe-wide generation.

If you want, I can sketch a concrete indexing design for your current `FactIndex` and `bodySatisfied` flow in TypeScript.

