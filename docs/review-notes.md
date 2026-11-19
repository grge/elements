# Review notes

What writing the book shows about the engine, collected for the review sessions to come: the logic,
the planner, the book itself, and the drawing. Each note says what happened, with numbers where there
are some, and what it suggests. Started with chapter 4 (November 2026); add to it as chapters come.
The roadmap keeps the plan; this page keeps the evidence.

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
  finish, because of 1. Whether fixing 1 is enough is the first thing to measure.

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

**Lemmas are not rules** (roadmap, *Lemma compilation*). Pythagoras's closure derives I.34 and the
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
- **Default figures are chosen at random**, seeded: the quadrilateral of `drop-corner` and the
  scratchpad's windmill come out lopsided. Nothing prefers a figure that reads well: spread out, no
  slivers, points not crowded.
- **Loci live in `construction.ts`, by relation name**, not in the relation table (roadmap): seven
  kinds now.
- **Above 18 points the search is greedy.** Pythagoras with both windmills and whole squares would be
  about 25.
- Chapter 5 will want a locus for a right angle at a free vertex (on the circle on the hypotenuse).

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
  predicate it mentions, so Pythagoras shows on `eq-area`'s page, whose figure is two triangles; Euclid's
  figure for I.47 is drawn nowhere in the book (chapter 3's corresponding angles likewise). Either a
  lemma's figure is drawn when it is chosen, or each proposition that matters gets a construction of
  its own (a `windmill`), whose lemmas must then check in full.
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
