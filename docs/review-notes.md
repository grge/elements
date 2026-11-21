# Review notes

What writing the book shows about the engine: the logic, the planner, the book itself and the drawing.
Each note says what happened, with numbers where there are some. The notes from chapter 4 come first,
then the review of November 2026, which measured the whole core. Add to it as chapters come. What to do
about it is in the [roadmap](roadmap.md).

## The logic: language, inference, performance

**What held up.** A new kind of sameness needed no engine change: `eq-area` was recognised as an
equivalence on triangles in all six orders of their corners, proven from its own rules, exactly as
`eq-angle` was. Euclid's common notions are Horn clauses over a configuration, and the book now writes
them three times in one shape (chapter 1 for segments, chapter 2 for angles, chapter 4 for areas): a
point on a segment cuts a whole into two parts; equal parts make equal wholes; equal parts taken from
equal wholes leave equal parts. Forward chaining over such clauses proved Pythagoras in Euclid's own
form. The language itself (predicates over points, definitions, lemmas) has not got in the way.

**Speed now limits what the book can say.**

- The book's checks took 38 s before chapter 4's work and 86 s after; the whole test suite 42 s and
  105 s. The lemmas of chapters 1 to 3 alone went from 38 s to 50 s, though none of them mentions
  area: chapter 3's rectangle diagonals from 4.6 s to 7.4 s.
- Pythagoras with whole squares proves only at five times the checker's budget, in 65 s, so the book
  states it by the squares' parts (12 s). The midline of chapter 3 waits for the same reason.
- Where the time goes, measured on chapter 3 and 4 lemmas:
  1. `saturate` runs every rule again, in full, whenever anything changed. Of its derivations 91 to
     99% are facts it already had (I.34's halves: 9% new; the windmill figure at 2 million: 1%), and
     the budget counts them all.
  2. No argument indexes: matching an atom scans every fact of its predicate, even when all its
     arguments are bound and it is only a check.
  3. An atom of an equivalence whose block is only partly bound walks every class, including a
     singleton for each of the n³ triples of points.
  4. After the goal is found the closure runs again from the start, to the end or the budget, to rule
     out a contradiction. For most lemmas that is nine tenths of the time (I.34's halves: goal in
     0.1 s, then 1.5 s). When that run exhausts its budget, the ✓ means "no contradiction found in the
     budget", which honest verdicts do not say.
  5. Definitions run as rules, so the closure recognises every construction it can whether or not
     the goal could use it: 33,496 of the windmill figure's 55,698 facts are line-line intersections.
  6. Every chapter's rules weigh on every check (see *The book*, below).
- So rules are written for the join as much as for their meaning. Chapter 4's axioms written plainly
  took 20 to 27 s a lemma; with a cheap, selective atom first (`triangle a b c`) and degenerate cases
  cut early (`distinct b e`), 1 s. The guards change what can be derived: I.43, the complements of a
  parallelogram, proves every step but the last cut, because the cutting rule wants its cut point
  apart from both ends and the closure cannot know that. Completeness is traded for speed, rule by
  rule, where no reader can see it.
- **Optimise or rethink?** 1 to 5 are the textbook problems of a naive Datalog evaluator, and each
  has a textbook answer: semi-naive evaluation, argument indexes, indexes on equivalence classes by
  member, continuing the first run to rule out a contradiction instead of starting again, and goal
  relevance (only rules that can reach the goal or `false`; magic sets beyond that). The reference
  closure in `inference.ts` is already semi-naive with indexes, and the tests already compare the two
  engines. My lean: optimise first, measured on Pythagoras with whole squares; rethink only if the
  evaluator, done properly, still cannot carry the book's figures. One probe so far: on the windmill
  figure, goal relevance alone cut the facts from 55,698 to 4,544, and the closure still did not
  finish, because of 1. Whether fixing 1 is enough is the first thing to measure. The review's
  answer (below) is to do 4 first, by another route: a figure of the hypotheses shows they are
  consistent, and that search is 80% of checking time. Then the evaluator is replaced once.

**Non-degeneracy is the main logical friction.** Forward chaining cannot argue by contradiction or by
cases, so "a midpoint of distinct points is neither end", "k is off the line b-d" and "e is not a"
cannot be derived, though every figure shows them. This chapter:

- I.35 needs `distinct a e`: when a = e the two parallelograms are one and there is nothing to prove,
  but the closure cannot use the trivial case.
- The median axiom had to say "a median of the triangle c-a-d", because "b, m and a make a triangle"
  never follows for a midpoint m.
- The windmill needed two new rules in chapter 2 (a crossing keeps a corner off a line; the triangle
  guard on angle addition), and `distinct b x`, `distinct b y` in its statement.
- I.43 would need sixteen hypotheses.

The roadmap's case splits are one answer. Others: the drawing offers facts true in every sampled
figure (sides, distinctness) as hypotheses to add, never as proof; or the algebraic lens reports the
non-degeneracy conditions a statement needs. And an asymmetry to resolve: the marks closure assumes
distinct names are distinct points (`closure.ts`), the checker does not.

**Lemmas are not rules** (roadmap, *Not now*). Pythagoras's closure derives I.34 and the
windmill's congruence again from axioms; so the book states the steps as lemmas (each light) and the
theorem as one more (heavy).

**No sums.** II.14 and I.48 wait, as I.32 does. The common notions' one shape is the shape a
recognised sum would have: a relation the engine proves additive from its rules, as it proves
equivalences, then solves linear equations over its classes. That is the arithmetic decision.

**Head-only variables.** The median axiom first said "whatever the apex", a variable only in its head.
It is sound, and ranges over every point of the figure: on `march`, with its many equal steps, it
doubled the check. Fine semantics, a trap for cost.

## The construction planner

**What held up.** A new locus (the parallel at the height that gives an area) was 30 lines, and the
machinery for a locus of two curves (built for copied angles) took it as it was. The squaring figures
construct with ruler and compass, including the circle of II.14.

- **A definition's auxiliary points cost freedom and reorder constructions.** `right a b c` is read
  through its definition, whose point d (on a-b continued) is a slider that changes nothing visible.
  Worse, a right angle at f can only be used once d is placed on the line through f, so in
  `triangle-to-rectangle` the planner takes the rectangle's corners as inputs and builds the triangle
  from them: a sliver of a triangle and a thin rectangle, with the input the definition names first
  (the triangle) last. The preference for written order loses to the count of degrees of freedom. A
  perpendicular locus (reading `right` directly, as `parallel` is read) would fix this; it is also the
  hidden point d of *what a construction draws* (roadmap).
- **Branches are chosen before the facts that decide them.** The windmill's page said NOT MET: c
  slides on a line, d is one of two meeting points, and that the squares stand outside the triangle
  is checked only where f-c and a-d cross, after both are placed. Every attempt took the slider
  forwards and the first meeting point, so all 400 failed alike, and the solver did no better. Now,
  after 40 attempts with nothing found, `realise` varies slider directions and branches too (a
  stopgap: pages that construct at once are unchanged; replaced by a backtracking search over branches,
  November 2026). The real fix is to let an order fact on a
  later point choose an earlier branch, or to search branches as the planner searches orders.
- **Default figures are chosen at random**, seeded: the quadrilateral of `drop-corner` and the
  windmill come out lopsided. Nothing prefers a figure that reads well: spread out, no slivers,
  points not crowded. (Done, November 2026: figures are scored by their worst near-miss, crowding or
  an accidental near-equality, and the best sample is polished. A page also no longer inherits the
  positions of the page read before it, which had made the parallelogram a rhombus when reached
  from an equilateral triangle.)
- **Loci live in `construction.ts`, by relation name**, not in the relation table (roadmap): seven
  kinds now.
- **Above 18 points the search is greedy.** Pythagoras with both windmills and whole squares would be
  about 25.
- Chapter 5 will want a locus for a right angle at a free vertex (on the circle on the hypotenuse).
  The stress test wants it sooner (*Right angles*, below).

## The book

**What held up.** One new sameness per chapter held for area, and Euclid's route carried the chapter
to Pythagoras without arithmetic, in the shape of Euclid's own proof.

- **Chapters are layered in the text, not in the logic.** Every check uses every chapter's rules. So
  a ✓ in chapter 2 may rest on chapter 3's parallel postulate, and "chapters 1 and 2 hold in
  hyperbolic geometry" is a claim nothing checks; chapter 4's axioms slow chapter 1's lemmas; and
  chapter 4's lemmas hatch chapter 3's parallelogram page. A lemma should be checked with its chapter
  and the ones before (or the chapters it declares), which a sibling book needs anyway (it forks at
  chapter 3), and which is the relevance cut performance wants.
- **A proposition without a construction of its own has no figure.** A lemma belongs to the latest
  predicate it mentions, so Pythagoras first showed on `eq-area`'s page, whose figure is two
  triangles, and Euclid's figure for I.47 was drawn nowhere (chapter 3's corresponding angles still
  are not). The book now gives it a construction, `windmill`, whose page draws the figure and lists
  its lemmas; the cost is that a construction's lemmas carry all of it (the windmill's triangles took
  7 s stated alone, 12 s over the whole windmill). The general answer may be that a lemma's figure is
  drawn when it is chosen.
- **Area is of triangles only.** Parallelograms and squares are compared by their halves, and
  "triangle a-b-e has the area of quadrilateral a-b-c-d" can only be said as "the piece added equals
  the piece taken away": the squaring lemmas are thin. A relation on quadrilaterals (the engine
  recognises blocks of four) or a sum would let figures be compared as figures.
- **The axioms are chosen by what the engine can do.** Shear and the median are axioms because
  Euclid's proofs split into cases; side-side-side and angle-side-angle because their proofs argue
  about sides; I.29 with the postulate because it needs a sum. The book says so each time, but the
  list grows. Whether that matters depends on what the book is for: a proof-checked Euclid, or the
  content of Euclid in a form an engine can carry.
- **Statements are shaped by speed**: Pythagoras by the squares' parts, steps split into lemmas.
- **Other geometries.** Chapter 4 is Euclidean through and through: in the hyperbolic plane the shear
  fails, and a triangle's area is its angle defect (π less its angle sum). So a hyperbolic book shares
  chapters 1 and 2, and its "area" chapter is about angle sums, which needs sums. One sameness per
  chapter may hold, with different samenesses.

## The drawing

**What held up.** `classMark` made hatching one more kind of mark, as arrows were: equal areas got
marks, hover chains (`△def = △abc`) and thumbnails with little new code. Lemmas travel: typing the windmill
into the scratchpad hatches its equal triangles from the book's proofs. Drawing `triangle` as its sides
cleared "Not drawn: triangle" from most pages.

- **A class whose members overlap or tile a figure hatches all of it alike.** The four halves of a
  parallelogram (two diagonals) are one class, so the whole parallelogram is hatched: it says "an
  area", not "these two are equal". Byrne colours the triangles of the proposition at hand. Marks are
  global (every member of every class); a page's own statement could choose what is marked.
- **Busy figures**: `rectangle-to-square` draws 46 arcs, 27 ticks and 16 arrows, every right angle
  and equality of its sub-constructions. Fading by depth is not enough.
- **Figures have no drawing of their own.** A quadrilateral is drawn only through facts that mention
  its sides; `drop-corner` states its quadrilateral as two triangles on a diagonal so that it shows.
  A hatched half of a square marks half a square, where Byrne fills the square.
- **The hierarchical drawing idea, tested against this chapter.** It fits: a definition's turn could
  draw its figure as a whole (a square filled when its half is hatched, the diagonal then unneeded),
  and a page's statement could come first and its sub-constructions' marks recede. What it does not
  answer is which marks a page should show at all, which is the question above.

## The November 2026 review

A review of the whole core, made after chapter 4 with its own measurements (Node 22 on four CPUs, at
commit 6c9913b; `npx vite-node scripts/bench.ts` reproduces them). Its diagnosis is below. Its
proposals were weighed against what elements is for (README.md); those adopted are in the roadmap.

### What holds up

- **The language.** It has predicates over points, definitions recognised as if-and-only-if, and `?`
  lemmas whose meaning is a least model (language.md). The strains below are in what the machinery does
  with it.
- **Structure by proof.** Every sameness so far (points, segments, angles, directions, areas) was
  recognised as an equivalence from its own rules and implemented with union-find, with no engine
  change. This is what makes the closure affordable. The plain reference engine, which is semi-naive
  with argument indexes but has no structure, is 1.3 to 7 times slower than `saturate` on the five
  lemmas tried. Structure stays, and the evaluator below is built on it.
- **Unfolding.** One mechanism serves checking and drawing, with fresh names for a definition's
  auxiliary points.
- **The relation table** is the boundary between the logic and the figure, and every fact is checked
  on every frame.
- **The planner.** All 29 pages of defined predicates construct with ruler and compass. Planning takes
  at most a third of a second, and realising tens of milliseconds.
- **Numeric evidence and the five verdicts**, which make a ✓ something a reader can rely on.
- **The book's plan**: one new sameness per chapter, and neutral geometry first.

### Where the machinery flattens the book

| The book already says | The machinery does instead | Measured |
|---|---|---|
| Chapters build on earlier ones, and chapters 1 and 2 hold without the parallel postulate | One flat set of rules for every check | Chapter 1's searches for `false` take 17.0 s with the whole book and 2.1 s with its own rules. "Holds in hyperbolic geometry" is checked by nothing |
| A definition abbreviates its body | Its defining clause fires as a rule, recognising every construction the facts allow | The windmill's closure stores 22,456 facts with definitions and 3,622 without; all 64 verdicts are the same without them |
| A proposition cites earlier ones | Every proof starts from the axioms | Pythagoras with whole squares needs five times the budget (above) |
| A construction is a step in a larger one | The planner searches the orders of every point | Search time about doubles with each point (2.7 s at 18). At 19 the greedy fallback fails on a figure the search builds |
| A figure of the hypotheses is a model of them | Consistency is looked for by a second full closure, from scratch | 80% of checking time; 12 lemmas' ✓ rest on that search running out of budget |
| A page states one proposition | Marks come from a closure of everything on the page, for every member of every class | `rectangle-to-square` takes 43.9 s of closure for its marks, and draws 46 arcs, 27 ticks and 16 arrows |

Four findings are not about flattening.

- **The evaluator is naive.** This confirms causes 1 to 3 above, on the whole book. Of
  4.96 million derivations, 9.9% add a fact. On the windmill's search for `false`, joins take 9.9 of
  the 10.8 s over only three rounds. Each of side-angle-side's two rules takes 2 s for under 4,000
  matches, about half a millisecond a match. That is most likely the cost of scanning where an index
  would look up.
- **Names have leaked into the geometry.**
  - `lociFor` and `countEquations` in `construction.ts` switch on relation names.
  - The relation table mixes the model (`read`, `holds`, `residual`) with the depiction (`depicted`,
    `draw`). It holds `circle` and `right`, which are defined, only to draw them.
- **Two samplers disagree.** Evidence samples with `configurations`, which never varies branches,
  while pages use `realise`, which does. So the windmill's page constructs, but its two lemmas get no
  sampled figure.
- **Layers point the wrong way in one place.** `kb/verdict.ts` imports the editor's `EditorMark` from
  `components/CodeEditor.vue` and `Evidence` from `geometry/`, so the logic depends on the interface.
  A verdict weighs a proof against evidence, so it belongs above both. (Fixed with witnesses: it is
  now `geometry/verdict.ts`, and the editor takes its type from there.)

### What the review measured

**The book as measured:**
- four files and 136 rules: 105 axioms, and 31 clauses for defined predicates (definitions and the
  theorems about them);
- structure makes 56 of the 136 rules redundant;
- 64 lemmas.

**How it was measured:** Node 22 on four CPUs, November 2026, at commit 6c9913b. Times vary by about a
tenth between runs; counts do not. `scripts/bench.ts` reproduces the checking table and the pages.
The other figures come from one-off probes, each described where it appears.

**Checking.** The real checker takes 134.7 s and proves all 64 lemmas. The phases come from the
benchmark (131.6 s in all). The benchmark always runs the search for `false` after a proof, whereas
the checker skips it when `false` is unreachable. That is why chapter 1's columns add up to more than
its checker time.

| Chapter | Lemmas | Checker | Goal | Search for `false` | Out of budget |
|---|---|---|---|---|---|
| 1, length | 23 | 13.7 s | 0.2 s | 17.0 s | 2: `march`'s order |
| 2, angle | 14 | 7.9 s | 2.1 s | 5.7 s | 0 |
| 3, direction | 17 | 53.5 s | 10.0 s | 40.9 s | 5: I.28's first converse, two of the rectangle, two of the square |
| 4, area | 10 | 59.6 s | 13.9 s | 41.7 s | 5: I.35, both windmill lemmas, f-b-c as half the square, the triangle to a rectangle |
| all | 64 | 134.7 s | 26.2 s | 105.4 s | 12 |

The heaviest lemmas, as goal phase plus search for `false`:

| Lemma | Goal | Search for `false` |
|---|---|---|
| the windmill's `eq-area a b d f b c` | 5.9 s | 9.6 s |
| the windmill's `eq-area a b f l b d` | 5.7 s | 9.5 s |
| the rectangle's diagonals | 4.1 s | 7.1 s |
| the rectangle's angle | 0.65 s | 6.7 s |
| I.35 | 0.65 s | 6.3 s |

There were 4,964,030 derivations in all, of which 489,873 (9.9%) added a fact.

**Scopes** (`--scoped`). 119.6 s in all, and all 64 lemmas still proved.
- Chapter 1's searches for `false` take 2.1 s instead of 17.0 s, and `march`'s two no longer run out
  of budget.
- Chapters 3 and 4 take about the same, since they use nearly every rule anyway.

**The windmill's search for `false`, rule by rule.**
- It took 10.8 s and ran out of budget in its third round.
- It stored 22,456 facts.
- It walked an equivalence's classes with the block not fully bound 3,457 times.
- Joins took 9.9 s.

| Rule | Time | Matches |
|---|---|---|
| side-angle-side, its third side | 2,155 ms | 3,884 |
| side-angle-side, its angle | 2,042 ms | 3,892 |
| angle-side-angle | 1,134 ms | 534 |
| angles taken away | 810 ms | 5,466 |
| angles added | 721 ms | 5,078 |
| supplements: substitution | 381 ms | 155,360 |
| the definition of a line-line intersection | 378 ms | 35,040 |
| a common supplement | 300 ms | 88,704 |

**Definitions as abbreviations.** The probe removed the clauses for defined predicates from the
closure, except `false`'s, and answered defined goals by matching their unfolding.
- All 64 verdicts agree.
- Stored facts fall sharply. In the heaviest closures they fall 3 to 6 times: the windmill's from
  22,456 to 3,622, and the rectangle's from 14,897 to 4,766. In others the fall is far greater: the
  hexagon's from 11,129 to 109, and `vesica`'s from 3,413 to 59. At the median the fall is 27 times.
- Time for the full closures falls only from 108.3 s to 96.6 s.

**Structure against semi-naive.** The reference `forwardClosure` (semi-naive with argument indexes)
against `saturate` (naive, with structure), in the goal phase:

| Lemma | `saturate` | reference |
|---|---|---|
| the equilateral triangle's angles | 18 ms | 23 ms |
| `bisect-angle` | 107 ms | 570 ms |
| the midpoint, constructed | 503 ms | 1,183 ms |
| the parallelogram's opposite sides | 194 ms | 1,399 ms |
| the parallelogram's halves | 91 ms | 584 ms |

**Pages** (`pages`). All 29 defined predicates construct, and none falls back to the solver. Planning
takes at most a third of a second (`rectangle-to-square`, 13 points), and realising tens of
milliseconds. The closure that merges marks is the slowest thing on any page:

| Page | Marks closure |
|---|---|
| `rectangle-to-square` | 43.9 s |
| `windmill` | 12.3 s |
| `triangle-to-rectangle` | 7.7 s |
| `compass-midpoint` | 4.2 s |
| `cut` | 4.2 s |
| `square` | 4.1 s |
| `march` | 3.9 s |

**The planner's growth.** The probe added to a page until it passed 18 points.

| Figure | Points | Plan | |
|---|---|---|---|
| `windmill` | 10 | 36 ms | constructed |
| `windmill` and the square on a-b | 13 | 198 ms | constructed |
| `windmill` and both squares | 16 | 770 ms | constructed |
| `rectangle-to-square` and four equilateral triangles | 17 | 1,654 ms | constructed |
| … and a fifth | 18 | 2,736 ms | constructed |
| … and a sixth, planned greedily | 19 | 3 ms | not constructed: two equations unused |

**Witnesses.** Evidence finds sampled figures of the hypotheses for 59 of the 64 lemmas, in at most
57 ms each. The other five:

- **I.11's `right a c d`.** Its hypotheses construct, in 24 of 24 samples. Evidence stops only because
  the claim brings in a point of its own.
- **I.33, and both windmill lemmas.** `realise` constructs them. `configurations` finds nothing,
  because it never varies branches.
- **Playfair's `collinear c d e: parallel a b c d, parallel a b c e`.** Neither sampler draws it. The
  plan takes a, b, d and e as inputs, and places c where the parallels to a-b through d and through e
  meet. They never meet: two parallels to one line are one condition, not two.

So with one sampler and that count fixed, every lemma in the book would have a witness.

## Right angles (November 2026)

Measured before building anything: which figures with right angles construct, and which the planner
leaves to the solver. `right a b c` unfolds to an extension point d (`between a b d`) and
`eq-angle a b c c b d`, so the only loci a right angle gives are an arm on the bisector of a-b-d, once
d is placed. Its vertex is never placed by it.

| Figure | Constructs |
|---|---|
| one right angle; two sharing an arm | yes |
| rectangle, square (the book's) | yes |
| foot of one altitude | yes, by building b-c from the foot |
| right triangle, by its vertex or its hypotenuse | yes |
| Thales (right angle on a diameter) | yes |
| windmill with its right angle; two squares on a triangle | yes |
| incircle touch points; perpendicular bisector by a right angle | yes |
| Simson line with two feet | yes |
| rectangle by three right angles | no: the fourth corner |
| two altitudes and the orthocentre | no |
| three altitudes, feet only | no |
| Simson line with three feet | no |

What fails is always a vertex that must come after both its arms: the foot of a perpendicular from a
placed point to a placed line. One foot the planner dodges by order; two or more it cannot. A failing
plan overcounts its freedom (Simson: 11 for 7), and the page solves the figure numerically and says so.

Built (November 2026): a right angle is read from the equal angles it unfolds to, with two loci, the
perpendicular at the vertex and the circle on the arms. Every figure above constructs, and
`triangle-to-rectangle` is now built from its triangle. Thales on a diameter, where the new circle is
the given one, is set aside as one condition (a theorem) by carrying the plan out.


## The stress test (November 2026)

Thirteen theorems beyond Euclid's first books, written as a user would write them with the book's
vocabulary and no help for the engine (`src/language/extra/beyond.geo`, the chapter *Beyond the book*; `npx vite-node
scripts/stress.ts [--distinct]`). For each: does it draw, does it hold in sampled figures, does it
prove. Where it does not prove, the textbook proof's ingredients were added one at a time as
hypotheses to find what blocks it ("measured"); otherwise the blocker is read from the proof.

**Drawing carries: 13 of 13 construct**, Euler's line (17 points), the nine-point circle and the
Simson line among them, and every true one holds in all 24 sampled figures. The isosceles trapezoid
is refuted by a figure, rightly: its hypotheses also describe a parallelogram.

**Proving does not: 0 of 13**, as written. What blocks each:

| Theorem | Draws | Holds | Blocked by |
|---|---|---|---|
| midline (midpoints' segment parallel to the base) | yes | yes | (in chapter 3 since, with the proof's points given) non-degeneracy; a point the hypotheses do not name (f, on the parallel through c); sides (the diagonals' crossing). Proves step by step given all three (measured) |
| centroid (medians concur) | yes | yes | the midline, and points not named |
| circumcentre on the perpendicular bisector | yes | yes | non-degeneracy of the construction's own points (the vesicas'), and sides: `circumcentre` says o is on the line through the vesica points, not between them, and which side of them it lies on decides the angle. Proves with the construction written out, o between, and its points distinct (measured) |
| orthocentre (altitudes concur) | yes | yes | points not named (the triangle through the corners parallel to the sides), or circle theorems |
| Euler's line | yes | yes | ratios (sums); out of budget at 93 000 facts |
| nine-point circle | yes | yes | angles in a circle (chapter 5, sums); out of budget |
| Thales (angle in a semicircle) | yes | yes | the angle sum (I.32): sums |
| Thales' converse | yes | yes | a point not named (the rectangle's fourth corner), or sums |
| chord bisected by the perpendicular from the centre | yes | yes | angle-angle-side (I.26's second half), which argues by comparing sizes; not derived with everything else stated (measured) |
| equal tangents | yes | yes | hypotenuse-leg, the same |
| Simson line | yes | yes | angles in a circle (sums); out of budget |
| Varignon (midpoints of a quadrilateral make a parallelogram) | yes | yes | the midline only: given it, proves at once (measured) |
| isosceles trapezoid's diagonals | yes | **no** | cases: not a parallelogram cannot be said |
| Ceva; anything hyperbolic | — | — | cannot be said: ratios; the figure layer is the Euclidean plane |

What it says, in order of how much each blocks:

1. **Non-degeneracy blocks nearly everything, and comes first.** The figure assumes that distinct
   names are distinct points (closure.ts); the checker does not, so a midpoint may sit on an end and
   no vertical-angle or supplement rule fires. Stating `distinct` for every two named points
   (`--distinct`) is not enough: the points a definition introduces (the circumcentre's vesicas)
   cannot be named in a lemma. AlphaGeometry and the deductive-database provers meet the same wall
   and handle it with non-degeneracy conditions read off the figure. A convention for lemmas (distinct
   names, and the points definitions introduce, are distinct), with the witness showing the
   hypotheses stay consistent under it, is the obvious candidate. A language decision, not a fix.
2. **Points the hypotheses do not name.** Forward chaining over the hypotheses' points cannot draw the
   auxiliary line a textbook proof starts with. Four of the thirteen need one. This is where "lemmas
   as rules" and constructions as rules with existential heads come back from *Not now*.
3. **Sums**, for four (Thales, Euler, nine-point, Simson): real, but behind 1 and 2, which every one
   of those also needs. The arithmetic plan stands; it is not next.
4. **Sides** (the midline's parallelogram) and **comparisons** (angle-angle-side, hypotenuse-leg):
   one or two each.
5. **Budget**: the three largest run out at 25 000 to 93 000 facts; the store work (*Next*) matters
   once anything there can prove.

Found on the way and fixed: evidence did not test a claim whose definition adds a point (`right`'s
extension), so every right-angle claim went untested; the relation table now measures the head
itself.

**The convention, built (November 2026).** A lemma that does not follow as written is checked again
with every two of its points distinct, named or introduced by a definition, unless it relates them by
`eq-point` (language.md). Measured: the book's 64 verdicts and its checking time are unchanged (all
follow without it); of the regression lemmas, the two that hold only for distinct points now follow
"for figures whose points are all apart"; *Beyond the book* proves nothing more, so the next walls
there are points not named, sides and sums, as the table says; and its checks take twice as long
(each is tried both ways). A claim that two names are one point (`? eq-point g h`, the natural way to
state that lines concur) is exempt and checked, but nothing in the book derives such an equality yet,
and evidence cannot test it, since the figure keeps different names apart.

