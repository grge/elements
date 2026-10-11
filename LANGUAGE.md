
# Language Semantics and Formalism

This document outlines the formal semantics and design principles of the Horn-clause language used in the elements geometry system.

## Overview

This language is a minimal, declarative system built around Horn clauses. It supports:

- **Universal rules** (axioms and Horn clauses)
- **Concrete facts** (ground configurations)
- **Two kinds of queries:**
  - Theory-level queries (lemmas / theorems)
  - Ground-level queries (facts in a configuration)

The design goal is to keep the language uniform while clearly separating:
- **Schema-level reasoning** (universal statements)
- **Ground-level reasoning** (specific configurations)

Important note: several distinctions made below are **conceptual** rather than distinct AST node types.
In particular:
- an **axiom** is just a Horn clause with an empty body
- a **theorem** is just a queried Horn clause with an empty body
- a **lemma** is just a queried Horn clause with a non-empty body

So the language should stay structurally simple. The main top-level distinction that really matters
syntactically is between:
- `? H` — a ground query, and
- `? H: B` / `? H: -` — a queried Horn clause.

We define the **knowledge base** to mean the set of all Horn clauses and axioms (the schema level).

We define a **universe** to mean the set of objects currently in scope for inference.

We define a **fact set** to mean the currently known ground facts over a given universe.

We define a **configuration** to mean the session-level pair of universe + fact set used for interactive ground reasoning.

The model-theoretic interpretation is:

```
? H : B   holds iff  H ∈ least model of comp(K) ∪ {B}
? H       holds iff  H ∈ least model of comp(K) ∪ F,  where F is the current ground fact set
```

where `K` denotes the knowledge base and `comp(K)` reads every **defined** predicate as
if-and-only-if (see [Definitions](#definitions)): from `eq-triangle a b c` we may conclude
`circle a b c`, not only the other way round. All other clauses are one-way implications.

The checker is a sound but incomplete implementation of this semantics, so failure to prove a lemma
does not necessarily mean it is false in the model.

---

## Core Syntax

The language operates at two levels:

### Ground Level
- **Facts:** `circle a b c`
- **Queries:** `? eq-lines a b a c`

### Theory/Schema Level
- **Rules:** `eq-triangle a b c: circle a b c, circle b a c`
- **Axioms:** `eq-point a a: -`
- **Lemmas:** `? eq-lines a b a c: circle a b c`
- **Theorems:** `? between a a b: -`

### Horn Clauses

A Horn clause has the form:

```
head: body1, body2, ..., bodyn
```

Where `head`, `body1`, `body2`, etc. are all predicates.

**Semantics:** Whenever all body predicates `body1, body2, ..., bodyn` are true, the `head` is also true.

**Example:**
```
eq-triangle a b c: circle a b c, circle b a c
```

Horn clauses can also be written in indented form:
```
eq-triangle a b c:
    circle a b c
    circle b a c
```

**Syntax rules:**
- Inline bodies must be comma-separated on one line
- Indented bodies must have one predicate per line

The following is **not allowed:**
```
eq-triangle a b c:
    circle a b c, circle b a c   # invalid
```

### Axioms

An axiom is a Horn clause with no body. We use `-` to explicitly indicate that there is no body:

```
eq-point a a: -
```

This asserts that every point is equal to itself.

**Semantics:** Axioms represent universally quantified rules: for all objects `a`, `eq-point a a` holds.

Axioms are treated as invariants over objects: whenever a new object `x` is introduced, all applicable axiom instances are added automatically.

### Lemmas

A lemma is a queried Horn clause:

```
? eq-lines a b a c: circle a b c
```

**Semantics:** This asks: does the head follow from the body under the rules of the theory? Formally, is the Horn clause `eq-lines a b a c: circle a b c` derivable?

Like Horn clauses, lemmas can also be written in indented form:

```
? eq-lines a b a c:
    circle a b c
```

### Theorems

A theorem is not a separate language construct; it is simply a queried Horn clause with no body:

```
? between a a b: -
```

**Semantics:** This asks: is the head predicate universally true, i.e., derivable without assumptions?

### Bare Facts (Ground Configurations)

The language supports ground facts:

```
circle a b c
collinear a b d
```

**Semantics:** These form a ground conjunction. They introduce concrete objects `a`, `b`, `c`, `d` and assert that the listed predicates hold.

**Important distinction:** `circle a b c` means "for these specific objects, this relation holds", whereas `circle a b c: -` means "for all triples (a, b, c), the relation holds".

### Ground Queries

A ground query has no `:`:

```
? eq-lines a b a c
```

**Semantics:** This asks: is this predicate derivable in the current configuration? It depends on the current ground facts, the axioms (invariants), and all rules in the theory.

**Compare these two examples:**

```
circle a b c
? eq-lines a b a c
```

versus:

```
? eq-lines a b a c: circle a b c
```

Operationally these do similar work, but in the former the objects exist in the configuration space (introduced by the ground fact `circle a b c`), whereas in the latter the objects only exist within the lemma closure.

Lemmas are self-contained and depend only on the knowledge base together with a temporary proof universe induced by the symbols in the lemma statement. Ground queries depend on the session fact set and the session universe, as well as the knowledge base.

---

## Inference

### Forward and Backward Chaining

Forward and backward chaining can be thought of as traversing Horn clauses in different directions.

Consider the Horn clause: `eq-triangle a b c: circle a b c, circle b a c`

**Backward chaining** means starting with a predicate like `eq-triangle a b c` and replacing it with the conjunction `circle a b c, circle b a c`, then repeating this procedure recursively for each predicate in the conjunction until we reach a natural stopping point.

**Defined predicates** (see [Definitions](#definitions)) are automatically unfolded via backward chaining. This can be employed as:
- **Proof strategy:** "To prove `eq-triangle a b c`, replace that goal with two new goals: `circle a b c` and `circle b a c`"
- **Construction strategy:** "To construct a witness for `eq-triangle a b c`, construct witnesses for `circle a b c` and `circle b a c`"

Predicates without a definition are where unfolding stops. These become the foundation for forward chaining.

### Definitions

The language has one clause form, but a clause can play two roles: a **definition** (read as
if-and-only-if) or a one-way **implication**. There is no syntax for the difference; the definition of
a predicate is recognised:

> A predicate is **defined** by clause `D` when `D` has a non-empty body, `D` is not recursive (the
> predicate is not reachable from `D`'s own body through the rules), and every other clause for the
> predicate is provable from `D`. When several clauses qualify, the first in source order is used.
> Every other predicate is **open**: it is derived, never unfolded.

This is exactly the condition under which the completion of all of a predicate's clauses is a single
conjunction, i.e. still Horn. Consequences:

- A predicate's only clause is its definition. `tall x: giraffe x` on its own says that being tall
  *means* being a giraffe; if that is not intended, it is an error in the knowledge base, not in the
  engine. Write definitions as definitions.
- Adding a clause that follows from the definition (e.g. the true symmetry
  `eq-triangle a b c: eq-triangle b c a`) never changes the meaning of anything.
- Adding a weaker clause (`eq-triangle a b c: circle a b c`) makes it the definition, because that is
  what the clauses now say together.
- Genuinely alternative clauses leave the predicate open.
- Axioms about a predicate in terms of itself (common notion 3 for `eq-lines`) are recursive, so they
  are never mistaken for definitions.

**Auxiliary objects.** Variables that occur in a definition's body but not its head are existential:
the definition of `copy-segment a l b c` mentions an apex `d` and a point `g` that exist whenever the
construction does. Every unfolding gives them fresh names (`d#1`, `g#1`, … shown as `d₁`, `g₁`). `#`
starts a comment, so these never collide with names a user can write, and two constructions in one
figure never share auxiliary points. A lemma cannot refer to a construction's auxiliary points: in
`? eq-lines d a d b: copy-segment a l b c`, `d` is an arbitrary new point.

**Forward chaining** means starting with one or more facts and inferring new facts via Horn clauses. If ground facts successfully unify with the body of a Horn clause in the knowledge base, we can add the corresponding head predicate to our fact set.

**Summary:**
- **Backward chaining** is used for **construction / search**
- **Forward chaining** is used for **logical consequence**

### Lemma Checking Procedure

To check a lemma:

1. **Unfold** every hypothesis through definitions, giving auxiliary objects fresh names, until only
   open predicates remain (or the goal would repeat).
2. **Forward chaining:** compute the closure of the unfolded facts under all clauses.
3. **Check:** verify that the head is in the closure.

There is no notion of "primitive predicates": the boundary between unfolding and forward chaining
comes from the knowledge base itself (which predicates are defined).

In practice we don't need to compute the full closure — we can stop early and return success as soon as we see the head.

### Axioms and Theorems

Axioms and theorems (clauses with no body) require slightly specialised treatment during inference. An axiom like `eq-point a a: -` would never be invoked during ordinary forward chaining since it has no body to match against. Similarly, a theorem like `? eq-point a a: -` cannot get started via forward chaining since there are no predicates to initiate the inference procedure.

To handle these cases:
1. Introduce abstract objects corresponding to the variables in the theorem's head
2. Apply all axioms (invariants) to those objects immediately
3. Run forward chaining as normal

More generally, the same issue arises for any Horn clause where some head variables do not appear in the body — including non-axiom rules. Consider:

```
foo a: bar b
```

During forward chaining, when we see a fact `bar x` (for some concrete `x`), we cannot straightforwardly unify the body `bar b` with the head `foo a` and derive `foo a` for a specific `a` — because `a` is unconstrained. The correct behaviour is to treat this as a triggered invariant: as soon as any instance of `bar _` is derived, `foo a` holds for **every** object `a` in the current universe. This also applies to any objects introduced later in the same session.

Concretely, forward chaining handles such rules as follows:

- When a fact matching the body is first derived, assert the head for all currently known objects
- Whenever a new object is introduced into the universe, re-check whether any such triggered rules apply and assert the corresponding head facts

This is consistent with the axiom treatment: an axiom `eq-point a a: -` is just the degenerate case where the body is empty, so the trigger fires immediately on object introduction rather than waiting for a matching fact.

---

# Other Language Features

## Comments

Python-style `#` comments are supported. Comments should be preserved in the AST and associated with the object they annotate, regardless of which file it came from.

**Rule:** Attach a comment to an object if it either:
- Appears within the source text of that object, or
- Immediately precedes the source text, with no blank lines separating them

## Namespace and Scope

The knowledge base is a flat namespace, loaded from `.geo` files. These files can contain clauses, lemmas, theorems, and axioms, but not ground facts or ground queries. Each item is loaded into the knowledge base along with metadata about its source file provenance.

## Interactive Session / Scratchpad

The user can interact with the system via a scratchpad environment in the web interface, or an interactive prompt at the command line. The scratchpad accepts the full language: Horn clauses, axioms, lemmas, theorems, ground facts, and ground queries.

Rules and axioms defined in the scratchpad are session-scoped — they extend the knowledge base for the duration of the session but are not persisted to `.geo` files unless explicitly saved.

Ground facts in the scratchpad contribute to the current session configuration. That configuration has:
- a **session universe**: the objects currently introduced by ground facts
- a **session fact set**: the currently asserted ground facts over that universe

Lemmas and theorems are not checked against the session configuration directly. Instead, they induce a temporary **proof universe** from the symbols appearing in the statement being checked, together with a temporary proof fact set built from their hypotheses.

Ground queries, by contrast, are checked against the existing session configuration and do not silently extend it. If a ground query mentions objects outside the configuration universe, it is treated as an invalid query against the current configuration rather than as an instruction to enlarge that configuration.

---

# Design Notes

## Primitive Predicates

The previous design had a hardcoded set of "primitive predicates" as the boundary between backward and forward chaining. This was ad hoc and made it difficult to extend the language to new domains. That notion has been dispensed with entirely.

Instead, the boundary emerges from the knowledge base: defined predicates are unfolded, open ones are
not (see [Definitions](#definitions)). The geometry primitives (`collinear`, `between`, `eq-lines`,
`eq-point`) are simply open predicates: each has several clauses, or only recursive ones.

The drawing layer does have a list of predicates it knows how to draw. That list belongs to the
renderer, not to the logic.

## Variable Quantification

Unlike most logic languages, this language has no range restriction on variables. Variables can appear in the head without appearing in the body, and vice versa.

Consider:
```
foo a: bar b
```

The semantics are: "if `bar b` holds for any `b`, then `foo a` holds for any `a`." This is a natural extension of axioms. Similarly, the lemma `? foo a: bar b` asks: "does `foo a` hold for all `a`, given that `bar b` holds for some `b`?"

**Inference behaviour for head-only variables:**

- **Unfolding:** if `foo a: bar b` is the definition of `foo`, then `foo x` unfolds to `bar b#1`: some
  `b` with `bar b` exists. The head-only variable `a` simply does not occur in the body.
- **Forward chaining:** `foo a: bar b` acts more like a triggered invariant. As soon as any instance of `bar b` is seen, `foo a` is added for every existing object `a` — and for any object introduced in the future.

Variables that appear in the body but not the head are common in geometric constructions (an
intermediate point that is needed to build a result but not named in the goal). When a definition is
unfolded they become fresh auxiliary objects; see [Definitions](#definitions).

## Negation and Failure

Only positive Horn clauses are supported; there is no negation-as-failure.

A lemma that fails to check is not necessarily false, only not provable by this procedure (for
example, a fact true in every configuration but whose proof needs a case split, or a run that hit the
derivation budget).

## Equality

`eq-point` and similar predicates are ordinary predicates, and their properties are ordinary Horn
clauses written in the knowledge base (reflexivity, symmetry, transitivity, substitution into other
predicates). Those clauses are the whole meaning.

For speed, the engine **recognises** such structure by proving it from each predicate's own clauses
(on fresh constants, so the proof holds for every instance):

- a binary relation that is an equivalence and admits substitution into argument positions of other
  predicates is used as **the equality**: objects are kept in classes, and those positions are stored
  as class representatives;
- a relation of arity 2k that is an equivalence between its first and last k arguments (such as
  `eq-lines`, on unordered pairs) is kept as classes of argument tuples;
- a relation invariant under permuting its arguments (such as `between` or `collinear`) is stored in
  a canonical order.

Clauses that this structure already implies are not fired; all others are. The result is the same
closure the clauses define, so nothing is privileged: another knowledge base with an equivalence and
symmetric relations of its own gets the same treatment. See `src/kb/structure.ts` and
`src/kb/saturate.ts`.

## Recursion and Termination

A recursive clause is never a definition, so unfolding cannot loop; recursive clauses are used only
by forward chaining.

Forward chaining is robust in the presence of recursive rules because, over a finite set of object names, repeated rule application reaches a least fixpoint after finitely many new facts have been added.

## Lemma Compilation

Once a lemma has been checked, it could be added to the knowledge base as a Horn clause, enabling its
reuse in forward chaining. For a defined predicate this is already safe: a clause that follows from
the definition never changes the predicate's meaning (see [Definitions](#definitions)). The tradeoff
is knowledge base bloat and harder debugging. Not currently done automatically.
