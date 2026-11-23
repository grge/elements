# Roadmap

What to work on, decided by what elements is for and the principles in the [README](../README.md).
*Next* is the plan, in order; *Later* is what comes after it; the rest is everything else that is
open, by area. The evidence behind the plan is in [review-notes.md](review-notes.md); how things work now is in
[architecture.md](architecture.md). Done items leave this page (git history, design.md and book.md
keep what was built and why).

## Next

Two phases, in order (decided November 2026). The book as a probe is over: chapters 1–7 have first
drafts, and the engine path (engine.md and its review) has landed: the matching core, provenance,
replay, the cache and written proofs. What was built, and why, is in architecture.md, book.md,
engine.md and review-notes.md. What to revisit is in the ledger, [consolidation.md](consolidation.md).

1. **Foundations.** The book's axioms made sound enough to share with another geometry, and a second
   geometry to prove it. The analysis is in [foundations.md](foundations.md): where the axioms live,
   which geometries could share them, and System E mapped onto elements. Done there: the inventory
   of the book's workarounds for sides, and the first side words in the book (`same-side`,
   `opposite`, `inside`). In order:
   1. **Modules and strata** (foundations.md, *Modules and strata: the design*). A module is a file.
      A word belongs to the file holding its own rules, and the order comes from which modules use
      which. A book is a set of modules. Search runs in strata, a pass per module, alternating until
      a round adds nothing: scheduling, not meaning. The book declares its groups; no axiom is
      special in the code (November 2026, George). Not chapter scoping: modules are included and
      left out explicitly. In order:
      1. the strata spike: the windmill with the whole book's rules, and the first build's side rules
         with order split out. The decision point;
      2. the module analysis as a tool, with a test;
      3. strata in the engine, with diagnostics; the windmill leaves the over-budget list;
      4. a book as a set of modules, in the app, the tests and the bench;
      5. rules into theory modules, order first, and constructions into their own files.
   2. **The order module grows:** Pasch's other half, `inside`/`outside` for circles, negations as
      paired words, contrapositives written by hand, then the rest of the six workarounds and the
      blocked list. Then checking by module: set aside chosen clauses and see whether a lemma still
      follows, which keeps the reason for skipping "which ✓ need the parallel postulate".
   3. **The hyperbolic plane** in the Poincaré disk. What a geometry supplies (points and how to sample
      them, each word's measure, loci and where they meet, drawing) is separated from what stays
      shared. Then:
      - figures drawn in the disk;
      - a small constructions page;
      - the neutral chapters checked in both models.

      Existence (the continuity rules, System E's intersection axioms) only as far as the disk needs,
      since perpendicular bisectors can fail to meet there. With it, the list of geometries the
      interface could carry, and those it could not (foundations.md).
2. **The reorganisation** (the consolidation). The book reorganised as a whole, worked from the
   ledger:
   - names, and where each thing lives;
   - which words are of the plane and which are defined;
   - which rules are axioms and which theorems;
   - which construction words are descriptions and which are problems;
   - pages sharing content by reference, the chapters' half of modules (the rules' half is in
     *Foundations*);
   - how a proved lemma becomes a tool ([tools.md](tools.md), option B), which is how the axioms that
     are Euclid's theorems would be demoted;
   - what a reader sees of a proof.

   Two things make it safe. The tests: every book lemma must stay ✓, and *Beyond the book* is a
   regression set. And the index and graph views, which show the vocabulary and what rests on what.

## Later

After the reorganisation, in no order:
- **Inequalities**, the second foundational gap: no `<` in the book; I.6, I.7, I.18–20, the triangle
  inequality (foundations.md, *What it teaches*, 6).
- **Cases**: proof by cases, which Horn clauses cannot do (*Open questions*, cases; foundations.md,
  *Not sides*). Waiting on it: chapter 1's circumcentre (x between c and d, or beyond d), the shear and
  the median, Pasch's "one side, the other or the line", and the case splits of E's proofs.
- **The quarter and Apollonius' median law**, quadrance's laws with coefficients, which one additive
  word cannot express. They would prove III.14 with the halves derived. Wanted: a way the engine could
  discover them from rules, not a declared linear form. The same question as Ceva and Menelaus: a
  product of three ratios is a 12-place word, a sum of three differences (book.md, chapter 7).
- **Conics.** The parabola is nearest: its definition can be written today, and its first theorems
  (the tangent bisects focus and foot; the reflection) look within reach. It needs drawing: a conic
  curve, a locus on it, its meetings with a line. The ellipse and hyperbola need length sums or ratio.
- **Signed area**: area with a direction, additive and free of sides as turns are, on the same lattice.
  For the deferred sums of areas (II.14, I.48).
- **The pentagon and fifteen-gon** (IV.10, IV.11): the golden triangle's proof needs III.37 and runs
  past its budget.
- **A quarter turn as a locus**: `eq-turn b a b c b c b a` is not placed, so the rule that takes it to
  `quad-sum` has no figure for numeric evidence. Planner work, for turns.
- **Marks.**
  - One interface for marks, once there are enough cases: each level adding or restyling after its
    body has drawn, never deleting.
  - A mark for equal ratios.
  - A mark for quadrance (Byrne's squares, or Wildberger's own way: look closely first).
  - A class that tiles a figure shown as what it is; Byrne fills a square where we hatch its half.
- **Layout.**
  - Labels placed in the widest gap at their point.
  - Disconnected parts of a figure placed so they do not overlap.
- **The interface**: givens the reader chooses, Byrne's fills, overlapping figures.
- **Speed, if pages need it**: lazy theories (bridges in only on demand); one closure for lemmas with
  the same hypotheses; fewer, less overlapping rules (the book's business).

Not now, each back if a chapter or an experiment needs it: composing plans per definition; a change of
logic (*Open questions*, below). Not a candidate: spread, Wildberger's other measure. Turns do the
angle chasing linearly and with direction; spread's strength is metric laws of products.

## The book

The chapters and what they wait on (book.md has each chapter's plan and notes):

| Chapter | State |
|---|---|
| 1, length | written |
| 2, angle | written; spreads set aside |
| 3, direction | written, with the midline, and turns after the postulate |
| 4, area | written, Euclid's way without sums, to Pythagoras and squaring a triangle; II.14's proof and I.48 wait for sums |
| 5, circle | first draft (November 2026): chords, tangents, turns in a circle, with `cyclic`; III.14 waits for the quarter, III.20 for the Euclid book |
| 6, ratio | first draft (November 2026): `eq-ratio` (a difference of logarithms, solved as turns are), the intercept theorem, similarity by turns; parallels, the midline, the medians, crossing chords, the angle bisector, the mean proportional |
| 7, regular figures | first draft (November 2026): the square and the hexagon's triangle in a circle; trisecting, the fourth proportional, the golden section; the pentagon and fifteen-gon wait for III.37 |

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
  The plan (November 2026): sums are of turns (`eq-turn`; architecture.md). A turn is the difference of two
  lines' directions, so its facts are linear equations mod a half turn; the engine is to prove from
  `eq-turn`'s rules that it is such a difference (an equivalence closed under exchanging middles), and
  a linear solver attached to the store turns its facts into equations and shares merges with the
  union-find, as SMT solvers share equalities. No sum word is needed for the circle's theorems;
  `add-turn` only if a theorem's turns do not chain. Undirected `add-angle`, with sides, is the Euclid
  book's. Built for angles. Still open: sums of areas (II.14, I.48) and of lengths (half
  of equal chords is equal: III.14), which are not differences of directions; the lattice could take
  them if an area or length relation is recognised as additive, but what makes one so is undecided. The step to accept deliberately: the solver sees directions no line of the figure has.
  Named quantities (`∠bac + ∠abc = …`, a change of language) only if statements with points alone
  read badly. Built with step 3's store, if step 2 shows the need.
- **Cases.** Horn clauses cannot split cases, and the least-model meaning depends on that. Waiting on
  them: the circumcentre; the shear and the median, axioms because Euclid's proofs split on where the
  apexes fall; every trivial case a `distinct` hypothesis excludes. Either stay with Horn clauses and
  state cases as lemmas joined by a covering one, or extend to coherent logic (disjunctions and
  existentials in heads, as provers such as ArgoCLP use), at the price of a lemma's meaning no longer
  being one least model. The one fork that changes what a lemma means.
- **Sides of a line.** The figure knows which side a point is on; the logic does not, so every proof
  across a line was told by a crossing point in its hypotheses. Now *Next*, 1: the inventory, System E
  and the first words (`same-side`, `opposite`, `inside`) are in foundations.md. Options as first weighed:
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
- **Which pages are Euclid's constructions.** Three things that came apart with `right` (November
  2026): what the clauses mean (the logic); how the figure is placed (the planner, by any method:
  carried lengths, copied angles as measured rays, perpendiculars, Thales, areas by their height, the
  solver as a last resort); and whether the clauses *are* a ruler-and-compass construction. The
  steps list blurs the second into the third: it shows the planner's route as if it were the
  construction. `right` is a definition (Euclid's own, definition 10), whose d need only exist;
  `perpendicular` is a construction (I.11), whose points are the method. A check would tell them
  apart: plan with Euclid's moves only (a line through two points, a circle about a point through a
  point, where they meet, any point on one; `plan(model, { euclid: true })`) and say on the page
  whether the figure still draws. Measured: 25 of the 39 pages that draw pass. Chapter 1 passes but
  for `eq-lines`; chapter 2's constructions pass (`bisect`, `bisect-angle`, `perpendicular`,
  `drop-perpendicular`) but `copy-angle`, which carries lengths rather than transferring them (I.2,
  I.22); chapters 3 and 4 pass nowhere, since `parallel-through` is built on `copy-angle` and the
  rest are written with the relations `parallel` and `right` rather than constructions of them. The
  relations' own pages fail, rightly. To settle:
  - What is given. Euclid's problems say ("on a given straight line"); a definition does not.
    `midpoint m a b` passes only because the planner takes m and a as given and doubles a-m to b;
    that is not I.10. Givens are the points that take up the figure's freedom (all of it, no more; a
    point on a given line takes one degree), and `plan(model, { free, euclid: true })` already
    answers for a given set. A pass means the clauses spell out a construction from those givens; a
    fail only that they do not (whether one exists at all is algebra, not the planner's question).
    Different givens are different problems (an angle's trisector from the angle is impossible, the
    angle from its trisector easy). Ideas:
    - Try every set of givens and report which work ("from a and b, a construction; from a and m, a
      doubling"): a few hundred plans for the windmill, well under a second.
    - Let a reader choose the givens in the figure (*Interface*, givens the reader chooses).
    - Let the book say them, as Euclid's enunciations do: a line in a page's doc comment such as
      `# given a b`, read and handed to the planner. It is part of the problem's statement, read by
      the reader as prose, not a hint to the engine.
  - How the page says it: a mark on the page and in the contents, perhaps the steps list read as
    Euclid's construction when it is one.
  - Whether the book should then write more constructions where it now states relations (drop-corner
    with `parallel-through` rather than `parallel`), trading readability for a page that passes.

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
disk can share them and fork at the postulate: the same propositions, the same ✓ (setting clauses
aside and re-checking would show it; *Skipped*, above). Its lines are arcs meeting the boundary at right angles and its circles Euclidean
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
- **Proofs** (built November 2026, [engine.md](engine.md)): every ✓ carries the proof the engine
  found (not shown: consolidation.md, *What a reader sees of a proof*); proofs an author writes as `?` lines in a lemma's body, with
  constructions checked on the figures; proofs kept and replayed instead of searched again; the
  search made by the matching core (`core.ts`). Later, when we come back to the engine:
  - **Kept proofs in the browser's storage,** so a reload or a new session replays instead of
    searching. Today they live in the checking worker's memory, by the lemma's text. Stored, a
    proof's rules go by their text and are resolved again on load (`checkByReplay` already matches
    them so); a size cap and a way to clear them are needed.
  - **A page's lemmas checked in parallel workers.** They are independent, so a pool of workers is
    a multiplier on top of the core; the kept proofs would then be shared through storage.
  - **More speed in the core.** It is 6.7× `Saturation` (review-notes.md, *The matching core*),
    against the spike's 10× without solvers. The solvers are the place to look: the lattice is
    sparse maps reduced row by row; dense arrays, or reducing a query once per equation rather than
    per atom, may pay. The profile has no single hot spot left, so measure before building.
- **Lemmas promoted by profiling** (an idea, November 2026; after the current engine work). Profile
  the extracted proofs for steps an earlier lemma would give in one go: chapter 1's equal radii,
  `transfer`, `cut` and `parallel-through` would each shorten 16 to 22 later proofs. Promoting the
  profile's picks to rules of the search gained nothing and cost 6 to 7%. A lemma shortens a proof's
  depth, and the search's cost is its breadth (3 to 5 rounds). Worth more:
  - **citing lemmas in found proofs,** where they apply, for the reader (option A of tools.md);
  - **promotion revisited** if searches become deep, once rules are cheap in the new core, and only
    as a second pass that cannot lose a proof.
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
  (*Later*, not now).
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

- **Givens the reader chooses.** Which points are inputs is today a side effect of dragging, and an
  incomplete one. Pressing a point the construction determines re-plans with that one point free,
  forgetting any earlier choice; a point on a locus can only slide, never become an input; and
  nothing on the page records what was chosen. Instead, a page keeps a set of givens, and its plan is
  `plan(model, { free: givens })`: every given an input, the rest ordered by the planner.
  - Empty on load (the planner chooses, as now), or seeded by the page's `# given` line (*The book*,
    which pages are Euclid's constructions).
  - Making a point given works for every kind, by the test determined points already use: re-plan
    with it free and accept only if no fact is lost, some other point giving up the freedom (in
    `circle a b c`, c given makes b the slider). A given that over-determines the figure (a, b and m
    of a midpoint) is refused, and the point's title says why.
  - Givens accumulate until released, with one control to reset to the planner's choice.
  - The figure marks given points, apart from free, sliding and fixed ones. The steps list is the
    current plan's route, and can carry the Euclid's-moves check: "from a and c: a construction", or
    drawn with help.
  - The gesture, since dragging a sliding point already slides it: double-click (double-tap)
    toggles given (works on touch, leaves dragging alone); or shift-drag moves a point freely,
    making it given (direct, but nothing on touch); or dragging a sliding point well off its locus
    tears it free (playful, but surprising). Leaning to double-click.
- **More than one page, and a more playful layout**, in the same aesthetic: a front page, an explainer
  (the language, unfolding, the planner and the checker, each with live figures) and help. Sketch
  first; [the Plates concept](plates-concept/REDESIGN_CONCEPT.md) is a starting point.
- Save the scratchpad to the library in one step.
- Hovering a predicate name shows its arguments and doc comment; add its provenance and recognised
  status.
- Inline proof marks in reading mode.
- **A written proof's constructed points drawn in the figure**, marked as constructed, and its steps
  lighting up what they state. What a ✓ shows of a found proof, if anything, is parked with the
  reorganisation (consolidation.md, *What a reader sees of a proof*).

## Code structure

The layering (language → kb → geometry → composables → views) holds up. Worth doing when the code next
changes nearby:

- **`PageView.vue` holds the whole page** (themes, layout, contents, the steps in words). Split it when
  the page is reshaped, not before.
