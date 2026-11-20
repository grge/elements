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

1. **What a construction draws, and how a reader can tell**, the last of cleaning up construction.
   Decided (November 2026): no point is hidden. A definition may keep its lower levels' marks to
   itself, but a point outside its head is part of what it says, and is drawn (`right` draws its
   square and, fainter, its definition with d; a test holds every page to it). What remains is marks:
   today's rules grew a case at a time (circles as circles, `right` as a square, supplements as arcs,
   areas hatched), and one interface for them (each level taking a turn after its body has drawn, to
   add or restyle, never delete; who restyles a fact two definitions share) waits for more cases:
   the book's next chapters and the stress test supply them. Abstract then, not before.
2. **A stress test of the design.** Done (November 2026; review-notes.md, *The stress test*): 13
   theorems beyond the first books, now the chapter *Beyond the book*, all draw, and none proves as
   written. Non-degeneracy blocked nearly all of them; the convention that different names are
   different points is built (language.md, *Distinct points*), and what blocks them now is points a
   proof needs that no hypothesis names, then sides, then sums (four of them). Arithmetic is real but
   not next. Points not named are parked (November 2026, below, *Not now*): proofs that need them
   wait, and the store comes next.
3. **Pages that answer quickly.** Done (November 2026). The book's checks 33 s to 11.5 s, *Beyond
   the book*'s 227 s to 81 s, all pages' marks closures 292 s to 141 s, the test suite under 90 s;
   every verdict the same throughout (the book, the regression lemmas, *Beyond the book*, compared
   at each step).
   - Kept: definitions as abbreviations (ten to fifty times fewer facts; architecture.md); a budget
     of work beside the budget of derivations, the default for every search, the marks closure
     included; equivalences matched with a block unbound walk only the tuples consistent with what
     is bound, not every tuple of points; a tuple's images and canonical form memoised. The profile
     is now flat: matching itself.
   - Measured and dropped: relevance (every goal reaches 49 of the 51 live rules: the book's
     relations are one web); semi-naive evaluation (built over the union-find store, no faster: the
     duplicate derivations, the rectangle's 58 000 for 1 335 facts, come from many different
     matches deriving the same fact, symmetric images and overlapping rules, not from re-matching
     old facts); the different-names convention as a theory in the store (no faster: its cost is
     the guarded rules it lets fire, which are real derivations); choosing a rule's first atom by
     size (slower).
   - Not done, and not worth it now: one marks closure per page kept and extended across edits
     (closures run to their budget, and an edit that removes a fact restarts it anyway).
   - What would help next, if pages need to be faster: fewer, less overlapping rules (the book's
     business), and a cheaper derivation. A theory solver for sums, when sums come, attaches where
     the equivalences are recognised (*Open questions*, sums); abstract the interface once two
     solvers exist.
4. **What a page shows.**
   - Marks chosen by the page's statement first, its sub-constructions receding: done (November
     2026; design.md, *Marks*). A proven mark is drawn only if its relation is in play on the page;
     the depth that makes sub-constructions recede was already there. The windmill stays busy: area
     is its subject. Whether marks from elsewhere are off or faint is a working setting (the
     settings pane). Hovering a `?` line brings its marks forward: done (design.md, *Marks*).
   - A class that tiles a figure shown as what it is; Byrne fills a square where we hatch its half.
   - Points under the notice: done (November 2026). The figure keeps its points above the plate
     (`computeRenderTransform`'s `insetBottom`, measured from the notice); circles may pass behind.
   - Labels: placed in the widest gap between what is drawn at their point, not up and to the right
     of it. The rectangle's square at a was there all along, under its label.
   - Equal angles alone draw no arcs: no longer seen (November 2026). Three equiangular triangles
     draw their arcs; the note was likely marks waiting on a slow closure.
   - Disconnected parts of a figure are placed independently and can overlap (three triangles typed
     on the scratchpad). A layout question, not yet looked at.
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

**Parked: proofs that need points no hypothesis names** (November 2026). The stress test's main wall
after non-degeneracy: the midline's proof begins "through c draw the parallel to a-b", and forward
chaining reasons only about the points it has. Sketched, not adopted: existence statements (`!
parallel-through a b c f: distinct a b`, "there is an f"), whose head points not in the body are new,
and a proof's construction named on the lemma (`? … by parallel-through a b c f, …`), each checked
against an existence statement and added with fresh points before the usual check. Sound if the
existence statements are true, which is Euclid's own gap (when do two circles meet?) and leans on
sides and comparisons; they would start as marked axioms, perhaps later proven from a few postulates
by the planner's Euclid's-moves check. With it, reusing proven lemmas as rules (Varignon and the
centroid need the midline). Not added to the language for now.

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

## Code structure

The layering (language → kb → geometry → composables → views) holds up. Worth doing when the code next
changes nearby:

- **`PageView.vue` holds the whole page** (themes, layout, contents, the steps in words). Split it when
  the page is reshaped, not before.
