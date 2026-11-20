# Roadmap

What to work on, decided by what elements is for and the principles in the [README](../README.md).
*Next* is the plan, in order; the rest is everything else that is open, by area. The evidence behind
the plan is in [review-notes.md](review-notes.md); how things work now is in
[architecture.md](architecture.md). Done items leave this page (git history, design.md and book.md
keep what was built and why).

## Next

In order. Each is worth doing on its own, and each is measured with `scripts/bench.ts`. Done: figures
as witnesses (November 2026; architecture.md, *The knowledge base*), which took the book's checks to a
fifth of their time; branches chosen by backtracking, in pages and evidence alike (architecture.md,
*Realising*); figures that read well (the same); a right angle placed at its vertex (architecture.md,
*From facts to a figure*). Not to clean up: the order a construction is built in (a definition is a
conjunction, and imposes none), or the freedom of a helper point (freedom like any other).

1. **What a construction draws, and how a reader can tell**, the last of cleaning up construction. A
   relation drawn as itself stops the drawing there, so `right a b c` draws Byrne's square and hides
   its d. The leading idea: unfold everything and draw bottom-up, each level taking a turn after its
   body has drawn, to add or restyle (`right` turns two equal-angle arcs into a square), never to
   delete. To settle: what a turn may do; who modifies a fact two definitions share; the clutter it
   adds; a second hook on the relation table, with figure.ts composing.
2. **A stress test of the design.** About a dozen theorems beyond Euclid's first books, chosen to probe
   the system rather than fill the book: Ceva, the centroid and circumcentre, the nine-point circle,
   the Simson line, a couple of easy olympiad problems, one hyperbolic statement. Write each as
   clauses and sort it: draws and proves now; needs sums; needs cases; cannot be said. The tally says
   whether the design carries beyond Euclid's first books, and whether arithmetic (step 3) is the
   addition to make. Record it in review-notes.md.
3. **Pages that answer quickly, and the store built for theories.**
   - Definitions as abbreviations: defining clauses never fire; a defined goal is answered by
     matching its unfolding. Tried on the book: the same 64 verdicts, with 3 to 27 times fewer facts.
   - Relevance: fire only rules that can reach the goal, `false` or a mark's query (the predicate
     graph `mayDerive` already builds).
   - The marks closure: `rectangle-to-square` waits 44 s for its marks. One closure per page, kept
     and extended, rather than each worker saturating from scratch; the worker keeps the rules rather
     than receiving them with every request.
   - The evaluator, replaced once and measured: semi-naive over the union-find store (rebuilding after
     merges, as egglog does), indexes on argument positions and on class membership, a budget counted
     in facts added. Today 90% of derivations re-derive known facts, and a bound atom scans every fact
     of its predicate. Build the store as a core (the equality, canonical keys) with theory solvers
     attached, recognised from the rules as equivalences are now: equivalence first, then addition if
     the stress test calls for it (*Open questions*, sums). Abstract the interface once two solvers
     exist, not before.
4. **What a page shows.**
   - Marks chosen by the page's statement first, its sub-constructions receding. Today marks are
     global: every member of every class, from every lemma about anything on the page, so a
     parallelogram is hatched all over and chapter 3's pages carry chapter 4's marks.
   - A class that tiles a figure shown as what it is; Byrne fills a square where we hatch its half.
   - Points under the notice: fitting the figure leaves no room for the plate at its foot.
   - Equal angles alone draw no arcs (three equiangular triangles, in headless screenshots at least).
5. **Pay back what was done for speed.** Pythagoras with whole squares (five times the budget today);
   guards whose only reason was the join, each rechecked; I.43, the complements; the midline of
   chapter 3.
6. **Dependencies.** Each ✓ says whether it needs the parallel postulate: mark the postulate's
   axioms, and recheck without them or track what a derivation used. Recognised structure counts: a
   proof that leans on `parallel` being an equivalence leans on I.30.
7. **More book.** Chapter 5 (the circle), then ratio, each written as the book wants and measured as
   an experiment. A sibling geometry once the figure layer can take one (*The workbench*).

**Not now**, each back if a chapter or an experiment needs it: turning proved lemmas into rules,
composing plans per definition, a change of logic (below, *Open questions*).

## The book

The chapters and what they wait on (book.md has each chapter's plan and notes):

| Chapter | State |
|---|---|
| 1, length | written |
| 2, angle | written; spreads set aside |
| 3, direction | written but for the midline (*Next*, 5) |
| 4, area | written, Euclid's way without sums, to Pythagoras and squaring a triangle; II.14's proof and I.48 wait for sums |
| 5, circle | mostly content on chapters 1–4; the circumcentre waits on cases |
| 6, ratio | equal ratios as an equivalence on pairs of segments; products need sums |
| 7, regular figures | content, on all the above |

### Open questions

The big ones change the logic, so they follow the README's last principle: taken up when a chapter
cannot be written honestly without them, and designed as a whole.

- **Sums.** The angle sum (I.32), additivity of area (II.14, I.48) and products of ratios all add.
  Chapter 4 went Euclid's way, sums as figures cut into parts, and stopped where two sums of one figure
  must be compared. The common notions are now written three times (segments, angles, areas) in one
  shape, which is the shape of a relation the engine could recognise as additive, proven from its rules
  as equivalences are and solved by linear arithmetic over its classes. The alternative is Horn
  clauses through auxiliary constructions, as Euclid does. A hyperbolic area chapter (area as angle
  defect) needs sums too.
  The leading plan (November 2026), with no new syntax: a relation such as `angle-add` gets its own
  rules (the parts commute, equal parts swap in, the parts determine the whole, cancellation); the
  engine proves from them that it is addition over an equivalence's classes; and a linear solver
  attached to the store turns its facts into equations and shares merges with the union-find, as SMT
  solvers share equalities. The step to accept deliberately: the solver sees sums no figure draws.
  Named quantities (`∠bac + ∠abc = …`, a change of language) only if statements with points alone
  read badly. Built with step 3's store, if step 2 shows the need.
- **Cases.** Horn clauses cannot split cases, and the least-model meaning depends on that. Waiting on
  them: the circumcentre; the shear and the median, axioms because Euclid's proofs split on where the
  apexes fall; every trivial case a `distinct` hypothesis excludes. Either stay with Horn clauses and
  state cases as lemmas joined by a covering one, or extend to coherent logic (disjunctions and
  existentials in heads, as provers such as ArgoCLP use), at the price of a lemma's meaning no longer
  being one least model. The one fork that changes what a lemma means.
- **Sides of a line.** The figure knows which side a point is on; the logic does not, so every proof
  across a line is told by a crossing point in its hypotheses. Options:
  - `same-side` and `opposite-side` with their own axioms, as `between` has, following the
    diagrammatic consequences of Avigad, Dean and Mumma's system E (2009). Tarski defines the same two
    relations by exactly our crossing. Much is Horn; Pasch and "one side, the other or the line" need
    cases. "The same side" is a sameness with two classes, so it could be a chapter's sameness.
  - Spreads (`eq-spread`, in the engine, set aside for chapter 2) or full angles (Chou, Gao and
    Zhang): neither tells an angle from its supplement, which makes I.29 side-free and would collapse
    chapter 3's alternate, corresponding and same-side bookkeeping into one statement. Worth trying
    on chapter 3 first.
  - Meanwhile the figure could offer the side facts it shows as candidate hypotheses, never as proof.
- **The axioms taken for now.** Side-side-side, angle-side-angle, the shear, the median, I.29 with the
  postulate: each an axiom because its proof needs sides, cases or sums. For a reader they are fine
  when the book says so; as the logic grows, keep them in one list and pay them back where it can.
- **Hidden points in lemmas.** A definition's auxiliary points cannot be named from outside, so a
  lemma about one writes the definition out (the parallelogram, twice, to name where its diagonals cross). Wider
  signatures, or leave it.
- **Lines and circles as objects.** `parallel a b c d` talks about lines through point pairs; a line
  object would read better and suit other geometries. Not needed yet.
- **Comparisons of size**, for the triangle inequality and Euclid I.16–25.

## The workbench

**Three lenses on one theory.** The Horn clauses are the theory; a geometry gives it models, each seen
three ways:

- **constructive**: loci, intersections, ruler and compass (the planner and the figure);
- **numeric**: residuals on sampled configurations (the solver, the checks, evidence and witnesses);
- **algebraic**: the same facts as polynomials, decided by Gröbner bases or Wu's method (Chou proved
  hundreds of Euclidean theorems this way). It proves what forward chaining cannot (facts needing case
  splits), and its non-degeneracy conditions ("provided a ≠ b") are the `distinct` hypotheses the book
  already writes. Rational trigonometry (quadrance, spread) makes every relation polynomial. A lemma
  `? H: B` is ideal membership; unfolding a definition's auxiliary points is elimination. It covers
  only the equality fragment (order is not algebraic), and proves generic truth over the complex
  numbers. What it would add, in order of value: an oracle while writing chapters (✗ as "true provided
  a ≠ b" versus "false"); a cross-check of `distinct` hypotheses; loci as curves, conics included; why
  a figure has no construction (a cubic in Wu's form, angle trisection); discovery of coincidences,
  certified. First step, before building anything: translate chapter 1's lemmas without `between`
  into polynomials, run Wu and Gröbner offline (sympy), and compare their conditions with the book's
  `distinct` hypotheses. JavaScript has no mature Gröbner library; giac has a WebAssembly build.

**Sibling books.** Chapters 1 and 2 use no parallel postulate, so a **hyperbolic** book in the Poincaré
disk can share them and fork at the postulate: the same propositions, the same ✓ (*Next*, 6, makes
that checked). Its lines are arcs meeting the boundary at right angles and its circles Euclidean
circles with shifted centres, so every intersection is one the planner already makes. A **spherical**
book needs its own axioms from chapter 1 (antipodal points share many lines; `between` changes). A
**rational trigonometry** book would sit beside the algebraic lens.

**The geometry as a plug-in.** The relation table (`relations.ts`) is the boundary between logic and
figure: each relation's reading, drawing and residual. Still outside it: loci and condition counts
(`lociFor` and `countEquations` switch on relation names) and the solver's energies. The review of
November 2026 proposes that the table hold primitives only (how to test, construct and sample each),
and that depiction (how each written relation draws, defined or not) become a second table. That is
the first step for every item in this section; do it when a lens or a sibling book is taken up.

## Logic

- **Show a ✗'s counterexample**: clicking the mark draws the figure that breaks the lemma, the failing
  fact marked. Lemmas whose head introduces points of their own get no evidence yet: they need a
  witness search.
- **Proof traces**: why a ✓ holds, as a derivation tree.
- **Show the recognised status** of each predicate: defined (by which clause) or open, and any
  recognised equivalence, substitution or symmetry.
- **Replace the `__object__` bootstrap** the checker uses for a lemma's head-only objects with an
  explicit initial universe.
- One arity per predicate name is what the parser enforces. `foo/1` beside `foo/2` needs a reason
  first.

## Construction and drawing

- **The solver and points that fold back.** A strip of equiangular triangles, and a rectangle with an
  equiangular triangle on a side, have degenerate answers in which a point lands on another; the
  separation term leaves it stuck beside the other, and the page says NOT MET. Worth trying: warm
  starts from several sampler attempts (which choose branches differently), or keeping such pairs
  apart by branch rather than by a barrier.
- **Plan from what the book proves**: before planning, ask the closure which facts in the planner's
  vocabulary the page implies (equal segments, right angles, collinear points) and use them as
  constraints, every fact still checked. A solved figure then becomes a construction (four equal
  angles make a rectangle, once the parallels chapter proves it).
- **Hybrid figures**: construct what can be, and solve only the rest numerically.
- **Figures above 18 points** are planned greedily, and at 19 that already fails on a figure the
  search builds. A bounded search would only move the cliff; planning per definition would remove it
  (*Not now*).
- **Continuity near tangencies**: nearest-branch tracking can jump; consider complex tracing.
- **Order facts on circles** restrict sliders to arcs (today they are only checked).
- **Annotations from proven facts**: a user's lemmas travelling to other pages; the lines a lemma is
  about (`bisect-angle` proves b-d is the bisector, but b-d is drawn only as the angles' arms).
- **Depth**: let the reader choose how many levels to show, and weight elements by role as well as
  depth (a construction's key properties in front of its guide circles).
- Step-by-step playback of a construction; undo for dragging.

## Interface

See [design.md](design.md#designed-not-yet-built) for what is designed but not built: reading and
editing modes, text that makes room for the figure, a better index, predicate views with lemma
layers, the boffin panel and an entry page.

- **More than one page, and a more playful layout**, in the same aesthetic: a front page, an explainer
  (the language, unfolding, the planner and the checker, each with live figures) and help. Sketch
  first; [the Plates concept](plates-concept/REDESIGN_CONCEPT.md) is a starting point.
- Save the scratchpad to the library in one step.
- Hovering a predicate name shows its arguments and doc comment; add its provenance and recognised
  status.
- Inline proof marks in reading mode.

## Code structure

The layering (language → kb → geometry → composables → views) holds up. Worth doing when the code next
changes nearby:

- **`PageView.vue` holds the whole page** (themes, layout, contents, the steps in words). Split it when
  the page is reshaped, not before.
