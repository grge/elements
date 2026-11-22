# Roadmap

What to work on, decided by what elements is for and the principles in the [README](../README.md).
*Next* is the plan, in order; the rest is everything else that is open, by area. The evidence behind
the plan is in [review-notes.md](review-notes.md); how things work now is in
[architecture.md](architecture.md). Done items leave this page (git history, design.md and book.md
keep what was built and why).

## Next

**The phase: the book as a probe** (November 2026). We work through the book chapter by chapter, and
where one hits a wall we add the tool it needs (turns, their solver, `cyclic`). So the book's shape is
provisional: names, which chapter a thing lives in, which words are of the plane, which are defined and
which rules are axioms. All of that is settled once, in a consolidation at the end (*Consolidation*,
below), not along the way. Until then, what we would revisit goes in the ledger,
[consolidation.md](consolidation.md), with why.

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
   - **Cold start: three changes, landed** (November 2026, review-notes.md, *Cold-start search*,
     *Landed*). Every closure is as it was:
     - supplements as the signed classes of a recognised flip;
     - indexes;
     - an early head check where it is exact.

     The book checks in 48 s against 184 s, as the app checks it, all 99 proved: the windmill is
     back inside its budget and its tests in the suite. With shared, resumable searches and the
     solver cache since, 34.5 s. What remains is the cost of a match (about
     14 µs, against 0.02 µs for the same join on integers).
   - **A new matching core, shown on a slice** (November 2026, review-notes.md, *The
     matching-core spike*): on integers, on chapters 1 to 4 without the solvers' words, it gives
     identical closures and verdicts, 10× on full closures and 12× on goal searches (the windmill
     16×). It passes the bar set before it was built (10×). Next: signed classes (flips), the solvers, chapters 5 to 7,
     the head check and signed classes inside it, and saturate's interface. Then it replaces
     `saturate.ts`, which stays as the oracle in the tests. Also cheap: one closure for lemmas with the same hypotheses, and the turn
     solver's answers cached per version of the store.
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
5. **Pay back what was done for speed.**
   - Pythagoras with whole squares: done (November 2026). The windmill gives its squares as
     squares, `square a b f g` and `square c b d e`; its two lemmas prove in about 15 s each. The
     budget of work now binds (2.5 million then, 3 million since chapter 6, saturate.ts `MAX_WORK`), the budget of derivations is a
     safety valve. The cost: pages that run out take longer to give up (*Beyond the book* 81 s to
     111 s), and the tests' full search for a contradiction runs to the budget (the lemma suite 154 s
     to 303 s).
   - I.43, the complements: done (November 2026). It follows under the convention that different
     names are different points; its figure needed the planner to take a parallel through any
     placed point collinear with its pair (h-k-f parallel to a-b, through k), which it now does.
   - Guards whose only reason was the join: rechecked (November 2026). Congruence, the shear and the
     median lose their `triangle` guards: the same verdicts, no false fact in any witness, no slower.
     Cutting from a corner keeps its guards: without them the book's checks take six times as long.
   - The midline of chapter 3: done (November 2026). In the chapter, with its proof's two points in
     the figure (d-e doubled to f, and where d-c and b-f cross), since a lemma can only name points
     the figure has; both halves (parallel, and half as long) follow under the convention, in 12 to 23
     s. The bare statement stays in *Beyond the book* (`midline-plain`) as the case of points not
     named. Step 5 is done.
6. **Sums, before chapter 5.** Done for angles (November 2026): turns, their solver, III.21 and `cyclic`, below. Sums of areas (II.14, I.48) are not differences of directions and are deferred (*Open questions*, sums). Decided November 2026: Book III's heart (the angle at the centre,
   angles in a segment, cyclic quadrilaterals, the semicircle) rests on the angle sum (I.32), and so do
   most of the stress test's open theorems. How sums work will set how chapter 5 is phrased, whether
   angle-angle-side is an axiom or a theorem (it follows from I.32 and angle-side-angle), and whether
   the split forms of chapters 2 and 4 stay. Design first (*Open questions*, sums), then a measured
   build. Measured on chapter 5 today: the chord's perpendicular (III.1, 3), equal chords and angles
   at the centre (III.26–29) and Euclid's tangent from a point (III.17) prove; the III.3 converse and
   the incircle need angle-angle-side; equal tangents need hypotenuse-leg; III.20–22 and III.31 need
   sums; intersecting chords (III.35–37) need ratio.
   - Decided (November 2026): this is the big book, and its sums are of **turns**, not angles.
     `eq-angle` stays undirected everywhere (the language of congruence; a Euclid book may come later
     and means the same by it); `eq-turn a b c d e f g h` says the turn from line a-b to line c-d, the
     same way round, equals that from e-f to g-h, round a half turn. Directed, it states the circle's
     theorems without sides. Like every word of the plane it measures, marks and constructs.
   - The word: done (November 2026). Chapter 3, after the postulate: its rules (an equivalence on
     pairs of lines, a line swapped for any running its way, turns add), and bridges from right
     angles, parallels and isosceles triangles. Measured, placed by the planner (a turned line through
     a point; the circle on which a chord is seen at a turn), marked with turning arrows, a turn and
     its reverse one class flipped. Saturation now cuts rules that cannot reach what is asked: nothing
     is concluded from a turn, so proofs that ask none pay nothing (the book's checks unchanged). Not
     stated: that lines turning by nothing are parallel, which would put `right`'s definition on a
     cycle (definitions must not be recursive).
   - The solver: done (November 2026). The engine proves from `eq-turn`'s rules that it is a
     difference (an equivalence of two unordered pairs, closed under exchanging middles, with
     `parallel` the lines of one direction: structure.ts, nothing named), and `holds` asks an integer
     lattice of its classes' equations (lattice.ts): a turn follows when its equation is an integer
     combination of the known ones, sound round a half turn, where dividing is not. III.31 as turns
     proves (*Beyond the book*); adding turns went from 5 s of rules to nothing.
   - III.21 an axiom of turns (decided November 2026). It cannot follow: the isosceles base turns give
     twice the turns equal, and halving is not sound round a half turn (twice a quarter turn and twice
     no turn are both no turn). Euclid's proof halves undirected angles, which is sound, but needs
     sides. So, as the full-angle method does, chapter 3 takes it as an axiom, saying it is a theorem in
     Euclid; III.22 and III.31 follow at once. Its converse (equal turns put four points on a circle)
     concludes `cyclic` (below), since a circle about a centre would need one the figure names.
     III.20 waits for the Euclid book.
   - The stress test as turns (November 2026): the altitudes, the Simson line and the nine-point
     circle seemed to prove, in 2 to 15 s, but did not: the turn bridges let a degenerate right angle
     (an arm of no length: `right a b b` holds) become a turn with a one-point line, which equals every
     turn, and the equivalence then glued every turn together; false claims proved as well. Fixed
     (every turn rule that could name a one-point pair says its points are distinct; regression
     tests); the three are not proved now, and why is the next question. They needed two more things: all right angles turn alike (the
     fourth postulate, directed), and `cyclic a b c d`, four points on one circle with no centre
     named, an open word so that III.21's converse can conclude it (the circles a proof finds have
     no centre the figure names; the prover cannot make one, though the planner can place it).
     III.21 is stated through `cyclic`. `cyclic` is rules only: not yet a word of the plane
     (measured, drawn, placed), until a statement wants to say it. The circumcentre's bisector stays
     blocked by congruence and sides.
7. **More book.** Chapter 5 (the circle), then ratio, each written as the book wants and measured as
   an experiment. A sibling geometry once the figure layer can take one (*The workbench*).
   Chapter 5, planned (November 2026), in this order:
   0. Before the chapter, in order:
      - **Two engine fixes: done (November 2026), neither in the engine.** The "matcher gap" was a
        misdiagnosis: the test word had one clause, and a lone clause is a definition, read as an
        abbreviation, its facts never stored. The contradiction was unsound turn rules: a degenerate
        right angle became a turn with a one-point line, equal to every turn (see step 6). Guarded and
        tested; the stress theorems' proofs went with it.
      - **Why the altitudes, Simson and nine-point did not prove**, once sound: done (November 2026).
        Rules saw only turns the store held, not those the solver finds, so the converse of III.21
        never fired; now an atom of a solved relation waits until its arguments are bound and is then
        asked of the solver (saturate.ts). The altitudes prove. The Simson line needs two facts of
        incidence the book does not state (a line meets a circle at most twice; a point off a line is
        off it however the line is named): with them it proves (measured), to be decided. The
        nine-point circle needs Thales' converse, so Apollonius (*Candidates*).
      - **Return bridges for turns: the first done (November 2026).** Lines that turn by nothing are
        parallel (`parallel a b c d: eq-turn a b c d a b a b, …`), the right-angle bridges restated
        through `right`'s body so its definition stays off the cycle. The structure analysis
        recognises that rule as the difference's *faithful* rule, and the engine implements it
        through the solver rather than firing it: after every round, pairs the solver shows to run
        one way are asserted parallel; relevance knows the link. The Simson line proves as Euclid
        states it, `collinear d e f` (42 s). The cost, accepted: any proof that needs `parallel` now
        lets the bridges into turns fire on every equal length, right angle and parallel, mostly for
        nothing; the book bench 20 s to 44 s (chapter 4, which never uses turns, 16.5 s to 35.6 s),
        the proofs the same. Making theories lazy (bridges in only on demand) would win it back.
        The second, a quarter turn gives `right`, waits for consolidation: `right` is defined with a
        point past its vertex, so concluding it needs such a point in the figure (Thales' has none);
        `right` must first become open, or a quarter turn (ledger). Thales and the altitudes, stated
        with `right`, wait with it.
      - **Return bridges for turns** (decided November 2026), as planned: Turns have bridges in (right angles,
        parallels, isosceles triangles) but none out, so what the solver proves stays in turn-language
        and theorems must be restated to meet it (the Simson line as "turns by nothing"). Wanted:
        turning by nothing gives `parallel` (and so `collinear` through a shared point), and a
        quarter turn gives `right`, so that the stress theorems prove as Euclid states them
        (`collinear d e f`, `right c f a`). Needs `right`'s definition cycle resolved first (ledger).
        Turns into equal angles need orientation, a sides question, and may stay out.
      - **Quadrance: done (November 2026).** `quad-sum`, recognised as a sum from its rules
        (structure.ts), the integer lattice its solver, equal lengths fed back every round, Pythagoras
        its bridge (chapter 4, an axiom for quadrances). Hypotenuse-leg is a theorem of chapter 4 now;
        equal tangents, their bisected angle and III.14 with the halves given prove; their false
        variants do not. The book's checks unchanged (bench 44.0 s to 44.6 s). The hypotenuse-leg
        axiom planned for chapter 5 is not needed.
      - **Quadrance as one discovered word** (decided November 2026), as planned: `quad-sum a b c d e f`,
        Q(a b) + Q(c d) = Q(e f), whose additivity the engine proves from its rules as it does for
        turns (swapping its first two pairs, equal lengths swapped in, cancellation); a rational
        solver over classes of equal lengths that feeds equal lengths back into the store; and
        Pythagoras as its bridge. Internal machinery: statements stay in Euclid's words. Proves
        hypotenuse-leg (so equal tangents and their bisected angle) and III.14 with the halves given.
        Not met by it, left as candidates: the quarter (a midpoint's half has a quarter of the
        whole's quadrance: the linear shadow of the triple-quad formula, a law of its own) and
        Apollonius' median law, so III.14 with halves derived and Thales' converse wait. Declaring a
        word's linear form instead was weighed and refused: the rules are the meaning.
      - **Headroom first** (November 2026). Adding AAS broke the windmill (Pythagoras), not by being
        wrong: its proof used 2.48 of its 2.5 million units of work, and any rule relevant to it
        tipped it over (the first attempt, committed with the failure unread, was reverted). Profiled:
        theories (turns, quadrance) do 5.7% of chapters 3 and 4's work, so lazy theories would not
        help; four core rules do 72%, mostly rediscovering what they know (side-angle-side 6,300
        matches for 7 facts). So rules' own symmetries are now broken while matching (architecture.md):
        the windmill 1.87 million, the book bench 44 s to 34 s with the rules below added.
      - **Angle-angle-side: done (November 2026).** The III.3 converse proves without it, by quadrance
        across the foot of the perpendicular: two small rules, a right angle's arms are two lines
        (chapter 2) and Pythagoras from a quarter turn (chapter 4). The incircle's step (a point of an
        angle's bisector is as far from both sides) needs it: its equal parts are angles. So AAS is an
        axiom of chapter 2, both forms, beside angle-side-angle.
      - **Angle-angle-side retested** with the fixes in (as planned): whether the III.3 converse follows by
        quadrance and the right-angle rule, or AAS stays an axiom.
   1. `cyclic` a word of the plane: done (November 2026). Measured (three points on a line are on
      no circle; a point named twice is one point), placed (the circle through three placed points),
      drawn as that circle with no centre point. Turn marks at a vertex (two lines through one point,
      `eq-turn c a c b …`) were never drawn: a block with a recurring point was taken for degenerate;
      a block of lines now only when a line is one point (relations.ts `pairs`).
   2. `cyclic` and III.21 (with its converse) move from chapter 3 to chapter 5; chapter 3 keeps turns:
      done (November 2026).
   3. The chapter, first draft: done (November 2026). Chords (III.1–3, the III.3 converse by quadrance,
      III.26–29), tangents (III.17 as `tangent-from`, equal tangents, their angle halved, the incircle's
      step by angle-angle-side), turns in a circle (III.21, III.22, III.31, III.32 with the diameter's
      far end named). III.32 needed all quarter turns alike, said of turns alone (chapter 3): a turn its
      own reverse is no turn or a quarter turn. III.14 proves but has no figure, so it waits in *Beyond the book*. Not a missing
      construction (reflecting c through n is `midpoint`'s own definition, constructible today) but
      the order: a chord with a given midpoint is built through a fact the hypotheses imply and do not
      state (the midpoint is the foot of the perpendicular from the centre), and the planner plans
      from stated facts only. Euclid's own form (distances along the perpendiculars) is constructible,
      but its proof halves the equal chords, which needs the quarter (*Candidates*).
   3. The chapter in three parts. The circle's own facts: radius, chords, the perpendicular from the
      centre (III.1–3, III.26–29). Tangents: III.16–17, equal tangents, the line to the centre
      bisecting their angle. Turns in a circle: III.21 (axiom), III.22, III.31, III.32.
   Decided with it (the first two provisional; quadrance replaces hypotenuse-leg, and the AAS retest
   decides the other):
   - Angle-angle-side an axiom: the second half of I.26, whose first half (angle-side-angle) the book
     already takes. Unlocks the III.3 converse and the incircle.
   - ~~Hypotenuse-leg an axiom of congruence~~ (superseded: a theorem by quadrance, chapter 4): Euclid does not state it, and it follows only through
     I.47 and length arithmetic, or a point not named. Unlocks equal tangents.
   - III.32 (tangent and chord) with its proof's point named, the far end of the diameter at the
     tangent point, as the midline names its points.
   - III.14 (equal chords equally far from the centre) stated with the halves given; halving lengths
     waits for length sums (*Open questions*, sums).
   - III.20 waits for the Euclid book.
   Measured before writing: III.1–3, III.17, III.26–29, III.22, III.31 and III.21's converse prove
   today; the III.3 converse (AAS), equal tangents and their bisected angle (HL), III.32 (a point not
   named) and III.14 (halving) do not.

8. **Consolidation**, at the end of the probe. The book reorganised as a whole: names, where each
   thing lives, which words are of the plane, which are defined, which rules are axioms and which
   theorems, which construction words are descriptions and which are problems. Worked from the
   ledger ([consolidation.md](consolidation.md)). Two things make it safe: the tests (every book
   lemma must stay ✓; *Beyond the book* is a regression set) and the index and graph views, which
   show the vocabulary and what rests on what.

   Then chapter 6, ratio (November 2026), first draft: done. `eq-ratio a b c d e f g h` (a-b is to c-d
   as e-f is to g-h) is a word of the plane: measured (a difference of logarithms), placed (a fourth
   proportional: a circle of computed radius; the circle of Apollonius), drawing nothing of its own
   yet (its mark undecided). Its rules make it, by what the engine proves, a difference over equal
   lengths with a faithful rule: ratios are solved by the turns' lattice, with no new engine. Axioms:
   the intercept theorem (VI.2) in four forms with its converse; similar triangles by turns, direct
   and mirror (as III.21 is for the circle, no sides); and, in chapter 3, I.6 in turns. Proved: three
   parallels cut lines proportionally, the midline (parallel and half as long) without named points,
   the medians' one to two, crossing chords (III.35), the angle bisector (VI.3, its proof's point
   named), the mean proportional (VI.13). The plain midline and Varignon in *Beyond the book* follow.
   Similarity by turns costs: the windmill's proof went over its budget again (pairs of triangles
   tried before their turns are asked), so the budget of work is now 3 million; engine efficiency is
   the next real limit (semi-naive evaluation, indexed joins, cheaper similarity matching).

   **The rest of the build-out, before engine work and the reorganisation** (decided November 2026,
   in this order):
   1. Chapter 7, regular figures: first draft done (November 2026). The square in a circle (IV.6), the
      hexagon's triangle, trisecting a segment (VI.9), the fourth proportional (VI.12), the golden
      section (II.11, VI.30: a tangent and its secant, then dividendo). Componendo and dividendo
      (V.17, V.18) are axioms of chapter 6 with the sums along lines, their parts named. A fault found
      and closed in the engine: a difference's fact naming a pair of one point (a segment of no length,
      a line of one point) is now never kept, so it cannot glue classes together (the intercept
      theorem's near-to-far form could make one from `between a b b`, an endpoint counting as
      between). The pentagon (IV.10, IV.11) and the fifteen-gon wait: the golden triangle's proof needs
      III.37 (the converse of III.36) and runs past its budget (*Beyond the book*).
      Ceva and Menelaus, explored: their proofs' pieces prove (Menelaus with its helper g, the parallel
      to a side through the opposite corner: two similar-triangle ratios sharing c-g, 5 s each), but
      the product of three ratios cannot be said: `eq-ratio` relates four segments. Options: state them
      with the helper (works today, not the usual statement); a 12-place word the engine recognises as
      a sum of three differences; not a definition through an unnamed segment. The 12-place word is the
      same engine question as the quarter and Apollonius (next): can the engine recognise, from rules,
      a linear relation of any number of terms with integer coefficients?
      The windmill's two lemmas ran past the 3 million budget (similarity by turns, componendo) and
      were left out of the suite; since signed classes, indexes and the head check (November 2026,
      *Cold start*, above) they prove again and are back in it.
   2. The quarter and Apollonius revisited: how the engine could discover quadrance laws with
      coefficients (they would bring the nine-point circle, Thales' converse, III.14 in Euclid's form).
   3. An exploration of conics: what a chapter would need, before the reorganisation decides its shape.
   4. **Every word of the plane a construction: done (November 2026).** `quad-sum` is placed by the
      planner, the last that was not (`right` is placed through its definition). A point in one segment
      is on a circle about its other end, its radius a leg or hypotenuse; in both parts, on a circle
      about their midpoint (Apollonius' median law); in a part and the whole, on a line across the
      segment between their other ends: one locus, Σ ±Q(p, t) = known, a circle or a line. Two circles
      about one centre now count as one condition, as two lines through one point already did. Numeric
      evidence now checks every rule with `quad-sum` among its hypotheses (all hold, but the quarter
      turn's: see Candidates). Drawn as its three segments, unmarked. Later each book chooses which
      words count as its tools. `eq-point` is not placed by design (different names, different
      points): a question for the reorganisation.
   Deferred past the reorganisation: signed area (its shape understood: a difference of areas on the
   same lattice, with bridges from figures cut into parts), the mark for equal ratios, and the
   interface work (givens the reader chooses, Byrne's fills, overlapping figures). Then engine work
   (engine.md and its review: indexed joins and signed classes are done, semi-naive evaluation
   measured no faster), then the reorganisation.

**Candidates**, tools we expect to adopt when a chapter needs them; not yet planned (November 2026):

- **The quarter and Apollonius' median law**, quadrance's laws with coefficients, which one additive
  word cannot express (*Next*, 7, step 0). Would prove III.14 with the halves derived and Thales'
  converse. Wanted: a way the engine could discover them from rules, not a declared linear form.
- **A mark for quadrance**: `quad-sum` is placed and drawn as its segments (November 2026), with no
  mark. Perhaps Byrne's squares on the segments (his I.47), or Wildberger's own way of showing
  quadrance in diagrams; both to be looked at closely first.
- **A quarter turn as a locus**: `eq-turn b a b c b c b a` (the line b-c in both blocks: twice its
  turn from b-a is nothing) is not placed; it is the perpendicular to b-a at b, or b-a itself. So the
  rule that takes it to `quad-sum` has no figure for numeric evidence. Planner work, for turns.
- **Signed area**: area with a direction, additive and free of sides as turns are, on the same
  lattice. For the deferred sums of areas (II.14, I.48). Wildberger's quadrea (16 times area squared)
  is quadratic, not the tool for sums.
- **Conics**: a target chapter, how to build it not known. The parabola is nearest: its definition
  (as far from a focus as from a directrix, through the foot of a perpendicular) can be written today,
  and its first theorems (the tangent is the perpendicular bisector of the focus and the foot, the
  reflection) look within reach; it needs drawing (a conic curve, a locus on it, its meetings with a
  line). The ellipse and hyperbola need length sums (two foci) or ratio (eccentricity).

Spread, Wildberger's other measure, is not a candidate now: turns do the angle chasing linearly and
with direction; spread's strength is metric laws of products, the ratio chapter's (and its double-angle
polynomial would state III.20 without sides, as a polynomial equation the engine cannot solve).

**Not now**, each back if a chapter or an experiment needs it: turning proved lemmas into rules,
composing plans per definition, a change of logic (below, *Open questions*).

**Skipped: which ✓ need the parallel postulate** (November 2026, George). Marking the postulate's
axioms would make the code treat one axiom as special, which the book should not. A general tool may
come instead, if at all: set aside any chosen clauses of the knowledge base and see whether a lemma
still follows. That would answer the parallel postulate's question without naming it (recognised
structure counts: a proof that leans on `parallel` being an equivalence leans on I.30).

**Proofs that need points no hypothesis names** (November 2026): now written proofs, whose
construction steps the planner builds ([language.md](language.md), *A written proof*; Thales'
converse proves with it). The history: The stress test's main wall
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
| 3, direction | written, with the midline, and turns after the postulate (*Next*, 6) |
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
  The plan (November 2026): sums are of turns (`eq-turn`, *Next*, 6). A turn is the difference of two
  lines' directions, so its facts are linear equations mod a half turn; the engine is to prove from
  `eq-turn`'s rules that it is such a difference (an equivalence closed under exchanging middles), and
  a linear solver attached to the store turns its facts into equations and shares merges with the
  union-find, as SMT solvers share equalities. No sum word is needed for the circle's theorems;
  `add-turn` only if a theorem's turns do not chain. Undirected `add-angle`, with sides, is the Euclid
  book's. Built for angles (*Next*, 6). Still open: sums of areas (II.14, I.48) and of lengths (half
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
- **Proofs** (proposed November 2026, [engine.md](engine.md)): every ✓ carrying the proof the
  engine found, shown on the page; proofs an author writes as `?` lines in a lemma's body, with
  constructions built by Euclid's moves; proofs kept and replayed instead of searched again. The
  diagnosis there covers the engine's power and efficiency too.
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
- **More of a ✓'s proof on the page.** Clicking a ✓ unfolds its proof (November 2026: the argument's
  steps, rules linked to where they are written, side conditions folded). Still to come: hovering a
  step lights up its points in the figure; citing the book's lemmas where a step is one (tools.md,
  option A); "write it in", which copies the proof into the source as `?` lines.

## Code structure

The layering (language → kb → geometry → composables → views) holds up. Worth doing when the code next
changes nearby:

- **`PageView.vue` holds the whole page** (themes, layout, contents, the steps in words). Split it when
  the page is reshaped, not before.
