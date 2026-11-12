# Language

elements is written in Horn clauses: one clause form, read by a small set of conventions instead of
extra syntax. This page covers the syntax, what it means, and what the checker does with it. For how
the engine computes it see [architecture.md](architecture.md); for the book written in it see
[book.md](book.md).

## Names and comments

A name is letters, digits, `_` and `-`: `eq-triangle`, `a`, `p1`. An atom is a predicate name followed
by its arguments, separated by spaces: `circle a b c`. A predicate has one arity everywhere; using a
name with two arities is a parse error.

`#` starts a comment, to the end of the line. Comments directly above an item, with no blank line
between, are its *doc comment*: a predicate's page shows it above the clause. Because `#` can never be
part of a name, the engine's own names for auxiliary points (`d#1`, shown `d₁`) can never collide with
a name you write.

`false`, with no arguments, is reserved for contradiction (see [below](#distinct-points-and-contradiction)).

## What you can write

| Item | Example | Meaning |
|------|---------|---------|
| clause | `midpoint m a b: between a m b, eq-lines a m m b` | for all values of its variables, the head holds when the body does |
| axiom | `eq-point a a: -` | a clause with no body: the head always holds |
| fact | `eq-triangle a b c` | this holds, for these particular points |
| lemma | `? eq-lines a b b c: eq-triangle a b c` | does the head follow from the body? |
| theorem | `? between a a b: -` | does the head hold outright? |
| ground query | `? eq-lines a b b c` | does it follow from the page's facts? |

A body is written on one line, separated by commas, or indented, one atom per line:

```txt
eq-triangle a b c:
    circle a b c
    circle b a c
```

Lemmas can be indented the same way. Mixing the two (`circle a b c, circle b a c` on an indented line)
is an error.

The book's `.geo` files hold clauses, axioms and lemmas only. A page holds anything: its clauses extend
the knowledge base while the page is open, its facts are drawn, and its `?` lines are checked. Your own
predicates, made from the contents, are kept in your browser.

## Meaning

### Clauses and variables

Every clause holds for all values of its variables. A variable may appear in the head only: in
`foo a: bar b`, once some `bar` holds, `foo` holds of every object, including objects introduced later.
An axiom is the case with an empty body. A variable in the body only is an ordinary existential: the
rule fires whenever some value makes the body hold.

### Definitions

A clause can be a **definition**, read as *if and only if*, or a one-way implication. There is no
syntax for the difference; the definition is recognised:

> A predicate is **defined** by clause `D` when `D` has a non-empty body, `D` is not recursive (the
> predicate is not reachable from `D`'s own body through the rules), and every other clause for the
> predicate is provable from `D`. When several clauses qualify, the first in source order is used.
> Every other predicate is **open**: it is derived, never unfolded.

This is exactly the case in which the completion of all the predicate's clauses is a single
conjunction, so it is still Horn. Consequences:

- A predicate's only clause is its definition. `tall x: giraffe x` on its own says that being tall
  *means* being a giraffe; if that is not what was meant, the mistake is in the knowledge base.
- Adding a clause that follows from the definition (`eq-triangle a b c: eq-triangle b c a`) never
  changes a meaning. Adding a weaker one (`eq-triangle a b c: circle a b c`) makes it the definition,
  because that is what the clauses now say together. Genuinely alternative clauses leave the
  predicate open.
- Axioms about a predicate in terms of itself (common notion 3 for `eq-lines`) are recursive, so they
  are never taken for definitions. The geometry primitives (`eq-point`, `eq-lines`, `between`,
  `collinear`, `distinct`) are open; `circle` is defined (`circle a b c: eq-lines a b a c`).

**Unfolding** replaces an atom of a defined predicate by its definition's body, recursively, until only
open predicates remain. A definition's body-only variables are a construction's auxiliary points; each
unfolding gives them fresh names (`d#1`, `d#2`, …), so two constructions in one figure never share
them. In Euclid's construction for copying a segment (kept in `tests/fixtures/constructions.geo`),

```txt
copy-segment a l b c:
    eq-triangle d a b
    circle b c g
    between d b g
    circle d g l
    between d a l
```

`d` and `g` exist whenever the construction does. A lemma cannot refer to them: in
`? eq-lines d a d b: copy-segment a l b c`, `d` is an arbitrary new point.

### What a `?` line asks

Write `K` for the knowledge base and `comp(K)` for `K` with every defined predicate read as if and only
if. Then

```
? H: B   holds iff  H is in the least model of comp(K) ∪ B
? H      holds iff  H is in the least model of comp(K) ∪ F,  F the page's facts
```

where `B`'s variables are new constants (a body-only variable is some object, a head-only variable an
arbitrary one). A ground query is about the page's configuration: one that mentions a point no fact
introduces is rejected rather than read as introducing it.

The checker is sound but incomplete. Beside the proof search, each lemma is tested numerically on
sampled figures that satisfy its hypotheses (see [architecture.md](architecture.md#checking-lemmas-and-queries)),
and the verdict weighs the two:

- ✓ the head follows;
- ⊥ the hypotheses are contradictory (they derive `false`), so the lemma holds only vacuously. This
  takes precedence over ✓: anything follows from a contradiction, and a ✓ would hide the mistake;
- ✗ false: not derived, and a sampled figure satisfying the hypotheses breaks the head;
- ? not proven: not derived, with the reason why it is open. It may hold in every sampled figure
  (probably true: the proof may need a case split or an axiom the book lacks), the search may have run
  out of its budget, or the hypotheses may not be drawable;
- ! an alarm: derived, yet a sampled figure breaks it, so an axiom is false or the engine is wrong.

### How it is checked

1. **Unfold** each hypothesis, giving auxiliary points fresh names.
2. **Forward chaining**: compute the closure of the unfolded facts under every clause.
3. **Look** for the head. The search stops as soon as the head appears, unless `false` is derivable at
   all from the kinds of facts involved; then it runs to the end to rule out a contradiction.

Forward chaining terminates: over a finite set of objects a set of Horn clauses reaches its least
fixpoint after finitely many new facts. A recursive clause is never a definition, so unfolding cannot
loop.

## Distinct points and contradiction

There is no negation. Distinctness is an ordinary relation, `distinct a b`, with its rules in the book
like any other (symmetry, substitution of equals, how it spreads along segments and orders). It lets
axioms be stated honestly, such as Euclid's first postulate: two *distinct* points determine a line.

A rule may conclude `false` (`false: eq-point a b, distinct a b`), and a lemma whose hypotheses derive
it is reported as ⊥. The drawing reads `distinct` too: it rules out an intersection that would land on
the given point, "the other intersection".

## Equality

Equality of points (`eq-point`) and of segments (`eq-lines`) is written as ordinary clauses:
reflexivity, symmetry, transitivity, substitution of equals into other predicates. Those clauses are
the whole meaning. For speed the engine proves which predicates are equivalences, into which argument
positions equals may be substituted, and which argument permutations leave a predicate unchanged, and
uses union-find and canonical argument orders instead of firing those clauses. It computes the same
closure; see [architecture.md](architecture.md#the-knowledge-base).

## Not in the language

Negation as failure, comparisons of size, arithmetic on quantities and case splits. Comparisons and
adding quantities are open questions in [book.md](book.md#open-questions); case splits and the other
logic work are on the [roadmap](roadmap.md#logic).
