Yes — if your goal is:

* unfold constructions down to core predicates, then
* use inference over the core theory to prove lemmas / answer queries,

then **the axioms for that core theory do need to be available to the inference layer**.

So in that sense, yes: something like

```text
between a b b :-
```

or, more generally, universally quantified bodyless core facts/rules, are part of what makes the theory usable.

But there is an important distinction:

> **you want to keep axioms semantically, not necessarily operationally as ordinary forward rules**

That is the key.

## Why axioms still matter

Suppose your construction phase produces some primitive configuration involving points and lines and incidence/betweenness/equality relations.

Then your query engine needs to know all the “free” truths of the theory, for example:

* reflexivities
* symmetries
* degenerate betweenness facts
* trivial equalities
* whatever core Euclidean background facts your theory assumes

Without those, your query closure will be incomplete relative to the theory you intended.

So yes, axioms are not optional if they are part of the meaning of the primitives.

---

## But bodyless axioms are not ordinary Horn inference

A rule like

```text
between(a,b,b) :-
```

is really saying:

> for all objects `a, b` in the universe, `between(a,b,b)` holds

That is not “derived from existing facts”. It is a **universal schema over the current universe**.

So the runtime should probably treat it as:

* not a normal forward rule
* but a special axiom generator

That is much more efficient and conceptually cleaner.

---

# The right operational model

I think your runtime wants three phases or mechanisms:

## 1. Initial facts / unfolded construction output

These are the concrete primitive facts coming from the construction side.

## 2. Universal axiom expansion over the current universe

This adds all theory truths that hold automatically for the currently existing objects.

## 3. Ordinary forward closure from non-empty-body rules

This derives consequences from the actual fact base.

That gives you the completeness you want without forcing the engine to treat axioms and ordinary rules identically.

---

# How to handle axioms efficiently

The important trick is:

> **instantiate axioms incrementally over only newly introduced objects**

Not over the whole universe every time.

Suppose your universe grows from `U` to `U ∪ Δ`.

Then for an axiom of arity 2, you only need to instantiate tuples involving at least one element of `Δ`, not all of `(U ∪ Δ)^2`.

For example, if the axiom is:

```text
between(x,y,y) :-
```

and a new point `p` appears, then the only new instances are:

* `between(p, y, y)` for all `y ∈ U ∪ Δ`
* `between(x, p, p)` for all `x ∈ U`
* and `between(p, p, p)` if not already covered

depending on how you enumerate and deduplicate.

That is still potentially expensive, but much cheaper than redoing the entire universe from scratch.

---

# In your example specifically

For an axiom like:

```text
between(a,b,b) :-
```

there are two possibilities.

## If `a`, `b` are variables

Then this is a genuine universal schema and should be instantiated over the universe.

## If `a`, `b` are literal constants

Then it is just a ground fact and should be inserted once.

I assume you mean the variable case, just written in your syntax.

---

# A useful distinction: finite, tame axioms vs explosive axioms

Not all bodyless axioms are equally dangerous.

## Tame axioms

Things like:

* `eq(x,x)`
* `between(x,y,y)`
* symmetry-style schemas

These are often fine, especially if the universe stays modest and you instantiate incrementally.

## Explosive axioms

Things with many unconstrained variables, like:

```text
foo(w,x,y,z) :-
```

These are just saying “everything is foo of everything”, and they scale as `|U|^4`.

Those are usually not practical unless very tightly controlled.

So I would keep axioms, but probably impose some discipline, for example:

* only allow bodyless axioms over core predicates
* maybe limit arity
* maybe require them to be marked explicitly as `axiom`

---

# Completeness: yes, but relative to your chosen theory

You said:

> “That means axiomatic rules ... should be accessible to the inference in order for the theory to be complete, right?”

Yes, **complete relative to the intended core theory**.

But there is a subtlety:

* if you omit universal axioms from runtime closure, then your theory is incomplete operationally
* if you include them naively, runtime may blow up
* so the right answer is not “drop axioms”, but “support them with a specialised mechanism”

That gives you both:

* completeness
* reasonable performance

---

# A nice design split

I would probably model core rules as two classes:

## Axiom schemas

Empty body, universally quantified over current universe.

Example:

```text
between(x,y,y) :-
eq(x,x) :-
```

Operational treatment:

* special incremental universe instantiation

## Derived rules

Non-empty body, safe/range-restricted.

Example:

```text
collinear(x,y,z) :- between(x,y,z)
```

Operational treatment:

* normal forward chaining

That is a very natural split.

---

# An even better option: compile some axioms into predicate semantics

For certain axioms, you may not even need to materialise all facts.

For example, if `eq(x,x)` is always true, you could choose to treat that as a built-in semantic rule in matching/querying rather than as explicit stored facts.

Similarly, perhaps some degenerate betweenness laws could be recognised by the matcher rather than eagerly generated.

That would reduce fact explosion further.

So there are really three implementation choices for axioms:

## 1. Materialise them eagerly

Simple, but can be expensive.

## 2. Materialise them incrementally on universe growth

Probably your best near-term option.

## 3. Treat some as built-in semantic truths

Most efficient for very basic axioms.

I suspect a hybrid is best.

---

# My recommendation for your current system

Given what you said, I would do this:

## Keep:

* bodyless axioms
* but only for the core theory
* and only if they are explicitly marked as axioms

## Exclude from default inference:

* general fresh-head-variable rules with non-empty bodies

## Handle axioms via:

* incremental instantiation over new objects
* or built-in semantic handling for the simplest ones

## Keep ordinary forward inference restricted to:

* safe non-empty-body rules

That seems like the right compromise for your use case.

---

# So, directly answering your question

Yes: if axioms like `between(x,y,y) :-` are part of the intended semantics of your primitive theory, then they do need to be available to inference for your lemma-checking to be complete.

But they should probably be treated as **axiom schemas over the universe**, not as ordinary forward rules. That is the efficient way to keep them without dragging the whole runtime down.

The next useful step would be to classify your current axioms into:

* built-in semantic axioms,
* incrementally instantiated universe axioms,
* and ordinary derived rules.

