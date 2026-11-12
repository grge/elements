# Roadmap

Open problems and ideas, roughly in order of value within each section. See
[architecture.md](architecture.md) for how things work now.

## Principles

- **Keep the engine general.** No geometry in the inference engine; geometry lives in `.geo` files and
  in the drawing layer. Extending to other geometries should mean new rules and a new drawing layer.
- **Prefer conventions over syntax.** When something seems to need new syntax, look first for a
  convention the engine can recognise and verify, and make the recognised status visible.
- **The rules are the meaning.** Anything the engine builds in (union-find, canonical forms) must be
  something it has proven from the rules.
- **The figure never silently disagrees with the facts.** It either satisfies every fact or says
  which step fails and why.

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
   smoothly instead of falling back to the solver. Next: spreads; case splits, which the circumcentre
   waits on.
6. **More than one page, and a more playful layout**, in the same aesthetic: a front page, an
   explainer (the language, unfolding, the planner and the checker, each shown with live figures) and
   help. Sketched before built, once two chapters show what it lays out; [the Plates
   concept](plates-concept/REDESIGN_CONCEPT.md) is a starting point, and design.md's entry page is the
   earlier idea.

## Beyond

**The rest of the book.** Each chapter after 2 waits on a decision or a piece of drawing:

| Chapter | Needs first |
|---------|-------------|
| 3, direction | the parallel through a point as a locus in the planner |
| 4, area | how to add quantities (book.md, *Open questions*) |
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
- **Use definitions in both directions during forward chaining** where no new objects are needed
  (`eq-triangle a b c` ⇒ `circle a b c`), not only when unfolding hypotheses.
- **Lemma compilation**: add verified lemmas as rules. Safe for defined predicates already (a clause
  that follows from the definition cannot change its meaning).
- **Show the recognised status** of each predicate in the UI: defined (by which clause) or open, and any
  recognised equivalence, substitution or symmetry.
- **Replace the `__object__` bootstrap** the checker uses to introduce a lemma's head-only objects with
  an explicit initial universe.
- **Performance for larger knowledge bases**: the reference closure is semi-naive with argument
  indexes (November 2026); the same for
  `saturate.ts`. Lemmas with `distinct` facts run the closure to the end to rule out a contradiction,
  and chapter 2 made that dearer: its arm and supplement axioms hold for every third point, so each
  `between` fact spawns angle facts for all points (`march`'s order lemmas went from 0.4 s to 3.6 s,
  `hexagon`'s take 2.6 s). Worth trying: stop that closure once no rule can still reach `false`; keep a knowledge-base snapshot in the worker instead of re-sending rules per request.
- **Case splits**, so that facts true in every configuration need no `distinct` hypothesis.
- One arity per predicate name is what the parser enforces today. `foo/1` beside `foo/2` would need
  a reason first.

## Construction and drawing

- **Next: say when the figure is solved, not constructed.** Today a figure the planner cannot build is
  drawn by the numerical solver with only a status line to say so, and it looks just as constructed.
  Design how the page shows which it is (and, once figures are hybrid, which points): see design.md.
- ~~The figure's rule~~ (built November 2026; design.md, *The figure: what it draws and why*).
- **Plan from what the book proves** (tentative, after the above): before planning, ask the forward
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
  *Beyond*: three lenses, sibling books).
- **Annotations from proven facts**: ticks and arcs come from stated and proven equalities (built
  November 2026, design.md *Marks*). Still to do: a user's lemmas travelling to other pages, and the
  lines a lemma is about (`bisect-angle`'s page proves b-d is the bisector, and now marks the two
  angles, but b-d is drawn only as their arms).
- Step-by-step playback of a construction; undo for dragging.
- Figures above 18 points use a greedy order; a bounded search would do better.

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

## Earlier proposals

Two proposals from March 2026, folded into this page and removed (`git show d2efd7a:docs/proposals/`
has them): *progressive rendering* (above, under *Construction and drawing*) and *embedded lemmas*,
which attached a construction's properties to its definition with `?` lines in the body. The page
already shows each predicate with the lemmas about it, by convention rather than syntax, which was
most of that proposal's point.
