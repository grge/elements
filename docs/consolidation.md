# Consolidation ledger

What to revisit when the book is reorganised as a whole, at the end of the probe ([roadmap.md](roadmap.md),
*Next*, *The reorganisation*). While we work through the book, tools are added where chapters need them, so
names, placement and what is primitive stay provisional. Each entry says what, and why it is worth
reconsidering; an entry leaves when it is settled. Newest at the end of each section.

## Reading the book (November 2026)

- **A reader's reading of the app**, after the engine work: proofs that cite line numbers, fold away
  their argument or wander (101 steps where two triangles do); a page's own points subscripted; word
  pages that gather every chapter under one chapter's label; lemmas landing on surprising pages;
  promises not kept; comments in two voices. Each with its pages in review-notes.md, *Reading the
  book*. Input to the whole reorganisation, not one entry. (November 2026)

## What a reader sees of a proof (November 2026)

- **A ✓ shows no proof for now.** The first display (clicking a ✓ unfolded the proof found, rules
  linked by chapter and line, side conditions folded) was taken out a day after it landed: it knew
  relations by name (which are side conditions, what a solver step is called), and a reading of the
  book showed a found proof is the search's trace, not an argument (review-notes.md, *Reading the
  book*). The machinery stays (provenance, `explain`, `replay`, the cache) and names nothing.
  Questions for the rethink:
  - granularity: a rule's step, or Euclid's;
  - how a rule gets a name a reader can read (side-angle-side, common notion 3), from the book, not
    the code;
  - which facts are bookkeeping, recognised (by structure) or declared by the book, never named;
  - whether found proofs are shown at all, or only offered as a draft to write in ("write it in"),
    a written proof being the reader's proof;
  - citing the book's lemmas in found proofs, and proofs and the figure together.
  (November 2026)

## The test for every tool (November 2026)

A tool can do three jobs, judged separately:

- **Power**: does it let statements in Euclid's words prove what they could not? A theory is best as
  hidden machinery (as an SMT solver's theories are): bridges in from familiar facts *and back out* to
  familiar conclusions. Quadrance does this (its equal lengths feed SSS); turns, without return
  bridges, do not yet, so their theorems must be restated in turn-language.
- **Vocabulary**: is it a word a reader would want to say? `cyclic` (concyclic, classical), yes;
  `quad-sum`, no: it stays internal; `eq-turn`, weakly.
- **Tools**: does it give the workbench a new construction? `eq-turn` and `cyclic` (once a word of the
  plane) do.

The book's statements use only words that pass the vocabulary test; the rest is machinery. A word that
appears in statements only because the engine needs it is a cost (the README: the clauses are prose).

## Words

- **`circle` and `cyclic`**: two words for being on a circle, one with a centre (defined, by equal
  lengths) and one without (open, concluded from equal turns). Perhaps one is the other's case, or the
  centre-free one is primary and the centre a separate fact. (November 2026)
- **`right`**: a definition (an angle equal to its supplement, through a point past its vertex) with
  bridges hanging off it (to turns, all right angles alike). Its definition blocks a bridge: "lines
  that turn by nothing are parallel" would put it on a cycle (`right` → `eq-angle` → `parallel` →
  `eq-turn` → `right`). Perhaps `right` should be open, or a turn. (November 2026)
- **`eq-spread`**: a word of the plane the book never uses. Keep for the ratio chapter, or drop.
  (November 2026)
- **`cyclic`**: a word of the plane since chapter 5's first step (measured, drawn, placed). Its
  rules still live in chapter 3, to move to chapter 5 (planned). (November 2026)
- **`right` and the quarter turn**: a quarter turn cannot conclude `right`, because `right` is
  defined with a point past its vertex, which a figure need not have (Thales' does not). So Thales and
  the altitudes, stated with `right`, do not prove though their turn forms do. `right` open (its
  supplement property kept as rules) or defined as a quarter turn would let them; either changes how
  chapter 2 is built and how the planner draws right angles. (November 2026)
- **Theories fire eagerly**: bridges into turns fire on every fact they can, wherever turns are
  relevant. A theory consulted on demand would cost only where it helps. Measured (November 2026):
  theories do 5.7% of chapters 3 and 4's work, so not the bottleneck yet; worth it as theories
  multiply. The bottleneck was core rules rediscovering facts (now cut by rule symmetries); what
  remains of it: re-running every rule from scratch on any new fact (semi-naive evaluation, to measure
  again), and joins that scan whole classes (indexes). (November 2026)
- **`right a b b` holds**: the definition asks a ≠ b and the point past the vertex ≠ b, not c ≠ b,
  so a degenerate angle (an arm of no length) is right. It made the turn bridges unsound until each was
  guarded. Perhaps `right` should ask c ≠ b; and degenerate angles in `eq-angle`'s classes may carry the
  same risk (a measure that "holds" when there is nothing to measure is not an equality). (November 2026)
- **`supp`**: an equal angle on the other side (marks.ts flips it). With turns, a supplement is a
  reversed turn; perhaps `supp` is redundant in the big book. (November 2026) The engine now
  recognises it as `eq-angle`'s flip and keeps it as signed classes, so it costs nothing to keep;
  whether the book wants the word is a vocabulary question only. An odd class is an angle equal to
  its own supplement, but degenerate angles (an arm of no length) land in such classes too, so odd
  classes are not yet right angles (engine-review.md, *Signed classes may give more than speed*).
  (November 2026)

- **One linear structure, not three?** The engine recognises a difference (turns, ratios) and a sum
  (quadrance); the quarter and Apollonius (coefficients) and Ceva and Menelaus (three terms) want a
  general linear relation recognised from rules. Perhaps one structure kind covers all. (November 2026)

## Foundations (November 2026)

From [foundations.md](foundations.md), where each is argued.

- **Sides of a line**: no plane separation anywhere, so the book works around it (angle addition
  through `between`, "same side" as opposite twice, facts about sides taken as axioms). Foundational,
  and shared by every geometry with `between`. Candidate: System E's same-side, Pasch and
  triple-incidence axioms, with negations as paired words and contrapositives generated. (November
  2026)
- **Inequalities**: no `<` in the book. Euclid needs it for I.6, I.7, I.18–20 and the triangle
  inequality. (November 2026)
- **Existence in code**: continuity lives in the planner and the construction checks, not in rules.
  Candidate: E's intersection axioms, which also let a construction choose a side. (November 2026)
- **Rules in modules, not only chapters**: a lemma's chapter is where it sits; the axiom groups it
  needs are what it rests on. Books per geometry, sharing pages by reference. (November 2026)

## Where things live

- **Turns in chapter 3**, used mostly by chapter 5 and the stress test. Chapter 3 is their home (they
  are about directions), but most of what they are for comes later. (November 2026)
- **`cyclic` and III.21** move from chapter 3 to chapter 5 (planned). (November 2026)
- **Proofs' points in statements**: the midline names its proof's two points; III.32 will name the far
  end of a diameter. If points not named come, these statements simplify. (November 2026)

## Axioms that are theorems in Euclid

Each taken as given here to get on; each worth asking whether it can become a theorem.

- **I.29** (parallels make equal alternate angles), with the parallel postulate. (before November 2026)
- **Angle-side-angle**, the first half of I.26; and **side-angle-side** (I.4), as Hilbert takes it.
  (before November 2026)
- **III.21** as an axiom of turns, and its converse: halving is unsound round a half turn, and
  Euclid's proof needs sides. (November 2026)
- **Angle-angle-side** (chapter 2, both forms), the second half of I.26, beside angle-side-angle:
  needed for the incircle (the equal parts are angles, which quadrance cannot reach). Hypotenuse-leg
  is a theorem by quadrance (chapter 4), and the III.3 converse no longer needs AAS. (November 2026)
- **A line meets a circle at most twice** (chapter 2, *Chapter 1's debts*): Euclid's III.2 and III.10
  come near it; here an axiom, said with equal lengths because `circle` in a body would cycle its
  definition. (November 2026)
- **The intercept theorem** (VI.2, chapter 6), four forms and the converse: Euclid proves it through
  areas compared by Book V's theory, which the book does not have; signed area might make it a
  theorem. (November 2026)
- **Similar triangles by turns** (chapter 6), direct and mirror: VI.4 to VI.6 in Euclid, an axiom
  here, the way III.21 is; with it, the intercept forms might follow, and some be dropped. (November
  2026)
- **Componendo and dividendo** (V.17, V.18; chapter 6), with the sums along lines: theorems of Book V
  in Euclid, axioms here; a general ratio of a sum cannot be said. (November 2026)
- **I.6 in turns** (chapter 3): equal base turns make equal legs. Euclid's I.6 is undirected, a theorem
  by I.4; here a bridge. (November 2026)
- **All right angles turn alike**: Euclid's fourth postulate, directed; a postulate there too.
  (November 2026)

- **The budget of work** rose to 3 million for chapter 6 (the windmill again). Each theory added has
  pressed the windmill; the engine's efficiency, not the book, is the limit. (November 2026)

## Constructions

- **Descriptions and problems**: the book's construction words are mostly descriptions (`square` is
  a parallelogram with a right angle and equal sides), which the planner solves; Euclid's are problems,
  each built from earlier ones. The graph view shows later chapters resting almost wholly on chapter 1.
  A strict book would grow that structure; this one may want to mark which words are which.
  (November 2026)
- **Every word of the plane constructs; a book chooses its tools**: the working principle, held
  loosely until a second book tests it. Recipes (one-way construction clauses, earned when their
  lemma checks) are the Euclid book's mechanism. (November 2026)
