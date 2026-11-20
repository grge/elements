# Roadmap

Open problems and ideas, roughly in order of value within each section. See
[architecture.md](architecture.md) for how things work now, and [review-notes.md](review-notes.md) for
what writing the book has shown about the engine, gathered for the review sessions. The direction comes
from [north-star.md](north-star.md); the [November 2026 review](review-2026-11.md) holds the
measurements behind it. Where an item below disagrees with the North Star, the North Star wins until
the item is rewritten.

## Principles

- **Keep the engine general.** No geometry in the inference engine; geometry lives in `.geo` files and
  in the drawing layer. Extending to other geometries should mean new rules and a new drawing layer.
- **Prefer conventions over syntax.** When something seems to need new syntax, look first for a
  convention the engine can recognise and verify, and make the recognised status visible.
- **The rules are the meaning.** Anything the engine builds in (union-find, canonical forms) must be
  something it has proven from the rules.
- **The figure never silently disagrees with the facts.** It either satisfies every fact or says
  which step fails and why.

North-star.md adds how to decide: the page is the product, the clauses are prose, every page is
honest, dependencies come from the content, the workbench must not cost the book, and big changes to
the logic need a reader-visible reason.

## Towards basically done

The plan as of November 2026, in order. The first milestone is **demo-ready**: steps 1 to 3.

1. **Correctness.** Done in November 2026: a predicate's page draws its signature, ticks are as
   bold as Byrne's and mark circles' radii too, the solver switch is gone, and the figure draws
   the construction it used, in layers by depth (see *Construction and drawing*).
2. **A careful pass over everything.** Done in November 2026: dead code removed, language.md
   rewritten, the two March proposals folded into this page, the book's comments brought up to date.
   The structural findings are under *Code structure* below.
3. **The editor.** Done in November 2026: prose comments, hanging indents, no breaks inside names,
   reasons for ✗ and ⊥ and syntax errors shown under their lines, unknown names marked, completion
   with argument fields, Enter and Tab that know the layout (see design.md, *Source*).
   The tether between source and figure followed (see design.md, *As built*).
4. **Honest verdicts.** Done in November 2026: numeric evidence on sampled figures, and five verdicts
   (✓ proven, ✗ false, ? not proven with the reason, ⊥ vacuous, ! alarm; see architecture.md). Next
   under *Logic*: show a ✗'s counterexample figure.
5. **Chapter 2, angle.** The engine and drawing support for both candidates is in (November 2026):
   `eq-angle` on angle triples and Wildberger's `eq-spread` on pairs of lines, recognised as
   equivalences, measured in checks, the solver and numeric evidence, with Byrne's arcs for equal
   angles (`tests/fixtures/angles.geo`: the isosceles triangle in both, all lemmas well under a
   second). Content decided: angles as the thread, spreads to close (book.md, *Chapter 2*). Written so
   far: the axioms (with `triangle`, three points not on a line, which angle-side-angle needs: on a
   line it derived false equal lengths), the triangle theorems, the five constructions (I.9–12,
   I.23) and chapter 1's debts (the midpoint proven; reflection; the perpendicular bisector case by
   case). Angles now construct (rays at a given angle, bisectors), so `eq-angle`, `supp` and `right` figures drag
   smoothly instead of falling back to the solver. Spreads are set aside for now (November 2026), in
   favour of chapter 3 (see *Beyond*); case splits, which the circumcentre waits on, too.
6. **More than one page, and a more playful layout**, in the same aesthetic: a front page, an
   explainer (the language, unfolding, the planner and the checker, each shown with live figures) and
   help. Sketched before built, once two chapters show what it lays out; [the Plates
   concept](plates-concept/REDESIGN_CONCEPT.md) is a starting point, and design.md's entry page is the
   earlier idea.

## Beyond

**The rest of the book.** Each chapter after 2 waits on a decision or a piece of drawing:

| Chapter | Needs first |
|---------|-------------|
| 3, direction | written but for the midline: axioms, the postulate, alternate, corresponding and same-side angles, I.31, parallelograms, rectangles and squares (book.md, *3*); the midline waits on closure performance |
| 4, area | written, Euclid's way without sums (November 2026): equal area of triangles, parallelograms and triangles, Pythagoras in split form, squaring a quadrilateral and a triangle; II.14's proof and I.48 wait for sums (book.md, *4*) |
| 5, circle | mostly content, on chapters 1–4 |
| 6, ratio | equal ratios as an equivalence on pairs of segments |
| 7, regular figures | content, on all the above |

**Three lenses on one theory.** The Horn clauses are the theory. A geometry gives it *models*, and
each model can be looked at in more than one way:

- **constructive**: loci, intersections, ruler and compass (the planner and the figure);
- **numeric**: residuals on sampled configurations (the solver, the checks, and numeric evidence for
  honest verdicts);
- **algebraic**: the same facts as polynomial equations, decided by Gröbner bases or Wu's method
  (Chou proved hundreds of Euclidean theorems this way). It proves what forward chaining cannot
  (facts that need case splits), and its non-degeneracy conditions ("provided a ≠ b") are exactly the
  `distinct` hypotheses the book already writes, so the two lenses can check each other.
  Wildberger's rational trigonometry gives this lens its natural vocabulary: quadrance (squared
  distance) and spread (squared sine of the angle between lines) make every relation polynomial,
  over any field. JavaScript has no mature Gröbner library; small systems can be done by hand, larger
  ones through a WebAssembly build of a computer algebra system (giac has one).

  The correspondence is close: a conjunction of atoms is a polynomial system and its solutions, a
  lemma `? H: B` is ideal membership (does H vanish wherever B does?), and unfolding a definition's
  auxiliary points is elimination. Where it stops: order (`between`, sides) is not algebraic, so the
  lens covers the equality fragment (common notion 2 is false without order); and algebra proves
  *generic* truth over the complex numbers, with non-degeneracy conditions, where the Horn clauses
  reason exactly. What it would add, in order of value:
  - **An oracle while writing chapters**: when a Horn check gives ✗, "true provided a ≠ b; a step or
    an axiom is missing" versus "false". Beyond numeric evidence, it adds certainty and the
    conditions.
  - **A cross-check of `distinct` hypotheses** against the conditions algebra demands: which are
    needed, which are missing.
  - **Loci as curves**: eliminate all but one point's coordinates as another slides, and draw the curve
    it traces (conics included), which the planner cannot.
  - **Why a figure has no construction**: in Wu's triangular form, every step of degree at most 2 is
    a ruler-and-compass step; a cubic says why (angle trisection) instead of a silent fall back to the
    solver.
  - **Discovery**: coincidences found by sampling (equal segments, collinear or concyclic points),
    certified algebraically, offered as candidate lemmas.

  First step, before building anything: translate chapter 1's lemmas without `between` into
  polynomials, run Wu's method and Gröbner bases offline (sympy), and measure how many prove, how
  fast, and how their non-degeneracy conditions compare with the book's `distinct` hypotheses.

The engine stays free of geometry: a model is a plug-in that interprets the drawable relations three
ways (as loci, as residuals, as polynomials). Building that boundary (*Construction and drawing*,
below) is the first step for every item here.

**Sibling books.** Chapters 1 and 2 use no parallel postulate, so a **hyperbolic** book, drawn in the
Poincaré disk, can share them unchanged and fork at chapter 3: the same propositions, the same ✓, in
both worlds. Its lines are arcs meeting the boundary at right angles and its circles are Euclidean
circles with a shifted centre, so every intersection is one the planner already makes. A **spherical**
book is harder (antipodal points share many lines, and `between` changes), so it needs its own axioms
from chapter 1. A **rational trigonometry** book, quadrance and spread instead of length and angle,
would sit naturally beside the algebraic lens.

## Logic

- **Show a ✗'s counterexample**: clicking the mark draws the figure that breaks the lemma, with the
  failing fact marked. Exact checks where a sample is rational: in quadrances (squared distances)
  every drawable relation is polynomial, though points the compass places generally leave the
  rationals (two circles meet at a square root). Lemmas whose head introduces points of its own (some
  point exists such that…) get no evidence yet: they need a witness search.
- **Proof traces**: why a ✓ holds, as a derivation tree.
- ~~**Use definitions in both directions during forward chaining**~~ where no new objects are needed
  (`eq-triangle a b c` ⇒ `circle a b c`), not only when unfolding hypotheses. Superseded: definitions
  become abbreviations, never rules of the closure, and defined goals become queries (review-2026-11.md, *The engine*).
- **Lemma compilation**: add verified lemmas as rules. Safe for defined predicates already (a clause
  that follows from the definition cannot change its meaning). Not planned now (north-star.md).
- **Show the recognised status** of each predicate in the UI: defined (by which clause) or open, and any
  recognised equivalence, substitution or symmetry.
- **Replace the `__object__` bootstrap** the checker uses to introduce a lemma's head-only objects with
  an explicit initial universe.
- **Performance for larger knowledge bases**, now steps 1 and 2 of north-star.md, *What follows now*.
  Witnesses replace the search for `false` first; that search is 80% of checking time. Then the
  evaluator is replaced once. The history: the reference closure is semi-naive with argument
  indexes (November 2026); the same for
  `saturate.ts`. Lemmas with `distinct` facts run the closure to the end to rule out a contradiction,
  and chapter 2 made that dearer: its arm and supplement axioms hold for every third point, so each
  `between` fact spawns angle facts for all points (`march`'s order lemmas went from 0.4 s to 3.6 s,
  `hexagon`'s take 2.6 s). Chapter 3 adds to it: `parallel` is an equivalence whose classes hold every
  pair of distinct points on a line, and a rule whose first atom is unbound walks every class pair by
  pair, again whenever anything changes (saturate is not semi-naive). A rule that a midpoint differs
  from its ends doubled `drop-perpendicular` (1.6 s to 3.1 s) and was left out; reordering rule bodies
  did not help (the greedy join already chooses). Worth trying: stop that closure once no rule can still reach `false`; keep a knowledge-base snapshot in the worker instead of re-sending rules per request.
  Chapter 4 made this the main limit (review-notes.md has the measurements): the book's checks went
  from 38 s to 86 s, Pythagoras with whole squares needs five times the budget (65 s), and most
  derivations re-derive known facts. The benchmark for this work: Pythagoras with whole squares, and
  the lemmas of chapters 1 to 3 back to their old times.
- **Sides of a line, in the logic.** The drawing knows which side of a line a point is on; the logic
  does not, so every proof across a line (I.29, rectangles, corresponding angles) is told by a
  crossing point in its hypotheses (book.md, *3*). Long term: `same-side` and `opposite-side` as
  relations with their own axioms, as `between` has. Much of it is Horn (two points opposite a third
  are on the same side; a crossing makes opposite sides), the shape of the diagrammatic consequences
  in Avigad, Dean and Mumma's system E (2009), which is the model to read first. Tarski's axioms
  define the same two relations by exactly our crossing (two points are on opposite sides when the
  segment between them meets the line; on the same side when both are opposite a third). The rest
  (Pasch; every point on one side, the other or the line) needs case splits, below. Meanwhile the
  drawing could offer side facts it sees in every sample as candidate hypotheses, never as proofs.
  A third way round, for angles: **spreads** (`eq-spread`, already in the engine, set aside for
  chapter 2), or angles between lines up to a straight angle (Chou, Gao and Zhang's "full angles").
  Neither tells an angle from its supplement, which is exactly what makes I.29 side-free: a line
  crossing two parallels makes equal spreads with both, whichever side is read. Much of chapter 3's
  bookkeeping (alternate, corresponding, same-side angles, each with its crossing) would collapse
  into one statement, at the price of not saying which of the two angles is meant. Worth trying on
  chapter 3 before building side relations.
- **Case splits**, so that facts true in every configuration need no `distinct` hypothesis, and for
  the parts of side reasoning that are not Horn.
- One arity per predicate name is what the parser enforces today. `foo/1` beside `foo/2` would need
  a reason first.

## Construction and drawing

- ~~Say when the figure is solved, not constructed~~ (November 2026; design.md, *Constructed or
  solved*): solved points are pencilled asterisks, the steps are a key that names the facts no step
  constructs, and a plate at the foot of the figure says solved or not met.
- ~~The solver fails on four right angles~~ (fixed November 2026). Two faults, both in the solver:
  its order term penalised b's position along a-c as a fraction of a-c, which fades as c moves away,
  so an end on the wrong side was sent off to infinity instead of across (each right angle's
  supplement point ended beyond the wrong vertex, where the angle it copies is the same angle, and
  trivially equal); and it had no term for `distinct`, so an extension point could sit on its
  vertex. Now order is (b − a)·(c − b) ≥ 0, distinct points are held apart, and the page solves from
  the construction's own attempt (every point it can place, on the right side of every order), moved
  into the solver's frame by a similarity, then from truly random starts (not seeded near it), keeping
  the best. A solved fact counts as met within 1e-3, above where the solver stops.
- **The solver and points that fold back.** Still unsolved: a strip of equiangular triangles
  (`abc`, `bcd`, `cde`) and a rectangle with an equiangular triangle on a side. Each has a degenerate
  answer in which a point lands on another (the second triangle folded back onto the first, e onto
  b); the solver's separation term keeps them apart but leaves the point stuck beside the other, and
  descent never reaches the far side (from the true answer it holds at 1e-5). The page says NOT MET.
  Worth trying: warm starts from several of the planner's attempts, which choose branches
  differently (realise now varies branches and slider directions once 40 plain attempts have found
  nothing, for the windmill: review-notes.md, *The construction planner*), or keeping such pairs
  apart by the planner's branch rather than by a barrier.
- **Open: what a construction draws, and how a reader can tell.** A relation drawn as itself stops
  the drawing there, so the points its definition brings in are not drawn: `right a b c` draws
  Byrne's square, and its d (`between a b d`, the extension of ab) is placed by the planner, named in
  the steps, and nowhere in the figure; `circle2 a b: circle a b c` draws its c₁ because `circle2`
  has no drawing of its own. Which relations draw as themselves is invisible on the page. The
  leading idea, not decided: **unfold everything and draw bottom-up**, each level of the unfolding
  taking a turn after its body has drawn, to add to it or modify it (`right`'s turn turns the two
  equal-angle arcs of its body into a square; `circle`'s draws the circle through its equal radii).
  Then nothing the planner uses is hidden, and a relation is special only by what its turn does,
  which the page could say (see *Logic*, recognised status). To settle first:
  1. what a turn may do: add, replace marks its body drew, restyle; never delete outright, so every
     fact keeps a visible trace (does `circle` keep its radii's ticks?);
  2. facts two definitions share: who modifies them, in what order (innermost first?);
  3. clutter: only `circle`, `right` and `supp` stop the unfolding today, so they are what changes
     (a rectangle gains four faint stubs);
  4. where it lives: a second hook on the relation table that sees what the body drew; figure.ts
     composes, and extraction no longer decides where to stop.
- **A perpendicular locus.** `right` is read through its definition, whose extension point is a
  slider and must be placed before the right angle can be used; so `triangle-to-rectangle` is built
  backwards, from the rectangle (review-notes.md, *The construction planner*).
- **Points under the notice**: fitting the figure leaves no room for the plate at its foot, so a
  low point can sit under it (Scratch's three equiangular triangles: e). For the design review.
- **Equal angles alone draw no arcs**: a figure of only `eq-angle` facts (three equiangular
  triangles) shows its points and nothing through them, in headless screenshots at least; possibly
  the marks waiting on the closure worker. Check in a browser.
- ~~The figure's rule~~ (built November 2026; design.md, *The figure: what it draws and why*).
- **Plan from what the book proves** (deferred, November 2026: the engine should change on the
  evidence of more chapters, and perhaps other geometries, first): before planning, ask the forward
  closure (the worker that merges marks) which facts in the planner's vocabulary the page implies,
  equal segments between its points, right angles, collinear points, and add them to the model as
  constraints; every fact is still checked. A figure drawn by the solver becomes a construction when
  the answer arrives (remembered across visits). Its reach grows with the book: the equiangular
  triangle is constructible today if `triangle a b c` is written (the closure derives `eq-triangle`);
  four equal angles in a quadrilateral make a rectangle only with the parallel postulate (in hyperbolic
  geometry they are less than right), so that figure becomes constructible when the parallels chapter
  proves I.32 and its consequences, and is a test that it does.
- ~~Draw the construction actually used~~ (November 2026): every element is drawn thinner and fainter
  the more deeply nested the definition it comes from; the planner's own loci are shown on touch.
  Next, from the March 2026 progressive rendering
  proposal: let the reader choose how many levels to show, and weight elements by role as well as
  depth (a construction's key properties, such as its equal sides, in front of its guide circles).
- **Continuity near tangencies**: nearest-branch tracking can jump; consider complex tracing.
- **Order facts on circles** restrict sliders to arcs (today they are only checked).
- **Hybrid figures**: construct what can be constructed and solve only the remaining part numerically,
  instead of falling back to the solver for the whole figure.
- **A drawing-layer boundary**: the relation table (`relations.ts`, November 2026) holds each relation's
  reading by the model, its number of points, its drawing and its residual; extraction, the figure, the
  checks and numeric evidence ask it. Still to join it: loci (in `construction.ts`'s `lociFor`) and the
  solver's energies (by the model's structure, not per relation). Then the table is a plug-in, a *model* of the theory (see
  *Beyond*: three lenses, sibling books). The November 2026 review proposes a model table
  holds primitives only, and depiction becomes a table of its own.
- **Annotations from proven facts**: ticks and arcs come from stated and proven equalities (built
  November 2026, design.md *Marks*). Still to do: a user's lemmas travelling to other pages, and the
  lines a lemma is about (`bisect-angle`'s page proves b-d is the bisector, and now marks the two
  angles, but b-d is drawn only as their arms).
- Step-by-step playback of a construction; undo for dragging.
- Figures above 18 points use a greedy order. At 19 points it already fails on a figure the search
  builds (review-2026-11.md, *What the review measured*). The review proposes plans that compose by
  definition; not planned now (north-star.md). A bounded search would only move the cliff.

## Interface

The tether between source and figure is built (November 2026; see design.md, *As built*). See
[design.md](design.md#designed-not-yet-built) for the designed-but-not-built pieces: reading and editing modes, text that makes room for the figure, a better index,
predicate views with lemma layers, the boffin panel and an entry page. Smaller items:

- Save the scratchpad to the library in one step.
- Hovering a predicate name shows its arguments and doc comment; add its provenance and status
  (defined by which clause, or open; recognised structure).
- Inline proof marks in reading mode.

## Code structure

From the November 2026 review. The layering (language → kb → geometry → composables → views) holds
up, and nothing calls for a rewrite. Worth doing when the code next changes nearby:

- **`PageView.vue` holds the whole page** (themes, layout, contents, the steps in words). Split it when
  step 4 above reshapes the page, not before.
- **The worker gets every rule with every request** (also under *Logic*, performance).
- **`kb/verdict.ts` imports from the editor and from geometry**: the editor's `EditorMark` type and
  `Evidence`. A verdict weighs a proof against evidence, so it belongs above both (review-2026-11.md,
  step 1).

## Earlier proposals

Two proposals from March 2026, folded into this page and removed (`git show d2efd7a:docs/proposals/`
has them): *progressive rendering* (above, under *Construction and drawing*) and *embedded lemmas*,
which attached a construction's properties to its definition with `?` lines in the body. The page
already shows each predicate with the lemmas about it, by convention rather than syntax, which was
most of that proposal's point.
