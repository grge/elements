# Architecture

How elements turns Horn clauses into checked lemmas and draggable ruler-and-compass figures, and why
it is built this way. For the language itself see [language.md](language.md); for the visual design
see [design.md](design.md).

```
 the book (src/language/book/*.geo) · user clauses · the text on the page
                         │  parse (src/language)
                         ▼
                   KnowledgeBase ── definitions.ts   which clause defines each predicate (iff)
                         │          structure.ts     equivalences, substitution, symmetries (proven)
          ┌──────────────┴───────────────┐
          ▼  checking (web worker)       ▼  drawing (main thread)
   unfold hypotheses                  unfold the page's facts to drawable facts
   saturate (forward closure)         construction.ts: plan → realise → execute
   ✓ / ✗ beside each `?` line         GeometryDiagram: render, drag, re-plan
```

## Source map

| Path | What it is |
|------|------------|
| `src/language/` | Lexer and parser; `book/`, the bundled book, one chapter per `.geo` file |
| `src/kb/inference.ts` | `KnowledgeBase`, `unfoldTree` and `unfold`, and `forwardClosure` (the plain reference engine) |
| `src/kb/definitions.ts` | Recognises which clause, if any, defines each predicate |
| `src/kb/structure.ts` | Proves which predicates are equivalences, admit substitution, or are symmetric |
| `src/kb/saturate.ts` | The fast forward closure used for checking, built on that structure |
| `src/kb/checker.ts` | Checks a lemma or ground query: unfold, saturate, look for the goal |
| `src/kb/runtime.ts`, `configuration.ts` | A page's runtime: the knowledge base extended with its rules, and its ground facts |
| `src/kb/names.ts`, `rules.ts` | Fresh names for auxiliary objects; rule printing, fingerprints, a small cache |
| `src/geometry/relations.ts` | The relation table: what each relation the figure knows is to the model, the checks and the evidence |
| `src/geometry/extraction.ts` | From facts to constraints, what is drawn and what is unread |
| `src/geometry/figure.ts` | What the figure draws through the points: lines, circles, and its marks |
| `src/geometry/marks.ts` | Ticks and arcs: equalities stated or proven by ✓ lemmas, in classes with their chains |
| `src/geometry/construction.ts` | The ruler-and-compass planner, executor and dragging |
| `src/geometry/solver.ts` | Numerical fallback for figures with no construction |
| `src/geometry/classes.ts` | Equal segments (union-find) and merged lines, shared by the model and the figure |
| `src/geometry/view.ts`, `scene.ts` | Fitting a figure to the screen; the figure in screen coordinates (shared by the diagram and the thumbnails) |
| `src/composables/` | `useKB` (bundled + user clauses), `useWorkspace` (page state), `useVerification` (talks to the worker), `useThumbnails` (contents miniatures) |
| `src/components/` | `CodeEditor` (CodeMirror), `GeometryDiagram` (the figure), `FigureThumb` (a miniature) |
| `src/views/PageView.vue` | The page: masthead, source, figure, contents, themes |
| `src/workers/lemmaCheckWorker.ts` | Checks `?` lines off the main thread |

## The knowledge base

The knowledge base is the book (one chapter per file in `src/language/book/`, each with its axioms,
constructions and propositions; see [book.md](book.md)) plus the user's own clauses, kept in the
browser. Chapters are only for browsing: logically it is one flat set of clauses. On a predicate's page
the app shows its clauses and the propositions about it: a lemma belongs to the predicate it mentions
that is defined latest in the book, and a predicate to the chapter that first defines it, so its page
gathers what later chapters say about it (`useKB.ts`).

Two analyses of the rules run lazily and are cached by the rules' content:

**Definitions** (`definitions.ts`). The language reads a predicate's *defining* clause as
if-and-only-if, so a hypothesis `eq-triangle a b c` can be unfolded into `circle a b c, circle b a c`.
There is no syntax for this. A predicate is defined by a clause when that clause is not recursive and
every other clause for the predicate can be proven from it; this is exactly the case in which the
completion of all its clauses is still a conjunction. So adding a true rule never changes a meaning,
and the geometry primitives, which have several or only recursive clauses, are never unfolded. A lone
one-way rule (`tall x: giraffe x`) *is* read as a definition: writing definitions as definitions is the
knowledge base author's responsibility. Details in [language.md](language.md#definitions).

**Structure** (`structure.ts`). Equality of points and of segments is written in chapter 1 as ordinary
rules (reflexivity, symmetry, transitivity, substitution). Fired one by one these are expensive: segment
equality alone has n⁴ ground facts. So the engine *proves*, from each predicate's own rules on fresh
constants, which predicates are equivalences (on single objects or on argument tuples, such as unordered
pairs of points), into which argument positions equals may be substituted, and which argument
permutations a predicate is invariant under. Rules contain no constants, so a proof on fresh constants
holds for every instance: what is recognised is proven, not guessed. (A block's reorderings are
looked for among those the rules state directly, each proven, closed under composition; trying every
reordering by proof is ruinous for blocks of four.) Nothing in the engine knows a predicate name; a map
colouring knowledge base with its own equivalence gets the same treatment (see `tests/structure.test.ts`).

## Checking lemmas and queries

A lemma `? H: B` asks whether `H` follows from `B`. The checker (`checker.ts`):

1. unfolds each hypothesis through definitions. A definition's body-only variables are existential, so
   each unfolding gives them fresh names (`d#1`, `g#1`, shown as `d₁`, `g₁`); `#` starts a comment, so
   they can never collide with names a user writes, and a lemma cannot refer to a construction's
   internal points;
2. computes the forward closure of the result (`saturate.ts`);
3. reports whether `H` is in it.

`saturate.ts` keeps objects in union-find classes, stores substitutable argument positions as class
representatives, keeps tuple equivalences as classes of canonical tuples and symmetric relations in a
canonical argument order. It skips exactly those rules the structure already implies (each one is
checked) and fires every other rule normally, so it computes the same closure as the plain
`forwardClosure` in `inference.ts`, which stays as the reference. `tests/saturate.test.ts` checks the two
agree on every small lemma.

The search ends with the goal derived, with the hypotheses contradictory (they derive the reserved
`false`, which takes precedence), with the closure complete and no goal, or out of its budget of
derivations. Because the search stops as soon as
the goal is found, a successful check is carried on to the end to rule out a contradiction, but only
when `false` is derivable at all from the kinds of facts involved (a cheap test at the level of
predicate names).

What it cannot do: case splits. Facts that need one can be stated with a `distinct` hypothesis instead
(the order of marched points holds once the first step is non-zero), and are on the
[roadmap](roadmap.md).

**Numeric evidence** (`geometry/evidence.ts`) weighs every lemma against figures. Its hypotheses are
extracted and planned like any figure; about two dozen well-spread configurations are sampled, and the
head, extracted too, is measured on each with the relation table's `holds` (which also measures
`eq-point`, a relation the figure can evaluate but not impose). The verdict (`kb/verdict.ts`) combines the
two: ✓ derived; ⊥ vacuous; ✗ not derived and refuted by a sampled figure (false); ? not derived, with the
reason saying whether it held in every sample (probably true), whether the search ran out of budget,
or why there were no figures to test (a hypothesis that cannot be drawn, such as `eq-point`); ! derived
yet refuted by a sample, an alarm for a false axiom or a bug. The drawing takes distinct names for
distinct points, so a lemma false only when two points coincide holds in every sample: probably true,
as it should be. The whole book samples, at about 6 ms a lemma.

The page checks its `?` lines in a web worker (`useVerification` → `lemmaCheckWorker`), so typing never
blocks.

## From facts to a figure

**The relation table** (`relations.ts`) is the boundary between the logic and the figure: one entry
per relation the drawing layer knows, with its number of points, how the construction model reads it
(`read`), whether the figure draws it as itself (`depicted`), whether it holds at given positions
(`holds`), and for the solver how far it is from holding (`residual`). Extraction, the model, the
checks a drawing is held to and numeric evidence all ask the table instead of switching on names. How
each relation is drawn is still the business of `figure.ts` and `scene.ts`.

**Extraction** (`extraction.ts`, `extract`) unfolds the page's facts as the logic does, all the way to
open predicates, keeping the tree (`unfoldTree` in `inference.ts`), and reads three things off it. The
*constraints* are the leaves the model can read (relations with a `read` in the table): what the
planner builds from. What is *depicted* is the
first drawn node on each path: `circle a b c` is defined (equal radii) and arrives at the planner as
`eq-lines a b a c`, but is drawn as a circle, and its radii are not drawn again. Where unfolding stops
is the logic's business, not the drawing's. Leaves the model cannot read (`eq-point`, `triangle`, a
user's open predicate, a fact with the wrong number of points) are *unread* and the page says so. That
list belongs to the drawing layer, not to the logic. One supply of fresh names is shared by the whole figure, so two constructions never share
auxiliary points. Each fact keeps its depth, the number of definitions unfolded to reach it (the
shallowest if it is reached twice); merged lines and circles keep the shallowest of theirs, and the
figure draws deeper elements thinner and fainter.

Two things are built from the extraction, one from each list:

- from the constraints, one **`ConstructionModel`** (`buildModel`): collinear groups, classes of equal
  segments, order facts, pairs kept apart, measures, and the facts themselves. The planner places points
  from it, and when no construction works the numerical solver (`solver.ts`) places them from the same
  model, with an energy per class of equal segments, per line, per order fact and per measure;
- from the depicted facts, the **`Figure`** (`figure.ts`): what to draw through the points, whoever
  placed them. Lines are collinear groups merged where they share two points; a circle is a centre and
  a radius, so circles with one centre and radii stated equal are one. Its **marks** (`marks.ts`) are
  equalities the depicted facts state or ✓ lemmas prove about the outline (the written facts and the
  definitions they use, down to what is drawn), put into classes per recognised equivalence; see
  design.md, *Marks* and *Equality chains*.

The planner's own loci are not part of the figure: the diagram draws a point's route (its loci) only
while the point is touched.

**Planning** (`construction.ts`) turns the model into a straight-line program in which each point is

| step | degrees of freedom | |
|------|-----|---|
| free | 2 | an input |
| on a locus | 1 | a slider along a line, a circle, a perpendicular bisector, a ray at a given angle or an angle's bisector |
| where two loci meet | 0 | an intersection, with a choice of branch |

Loci are built from points already placed: the line through two points of a collinear group; a circle
about a placed centre whose radius is any placed segment of equal length (the compass carries a length;
Euclid I.2 shows this is no stronger than the collapsing compass); the perpendicular bisector of two
placed points the new point is equidistant from.

Equal angles and supplements give loci too: a point whose angle at a placed vertex must equal a known
angle lies on one of two rays from the vertex (either side of the placed arm), and a point making
equal angles with two placed arms lies on their bisector (the outer bisector for supplements; for a
straight angle, the perpendicular). Of the two rays the drawing keeps the one the point is on, as it
keeps an intersection's branch. An angle condition on a point already on a line through the vertex is
not used: that line meets the rays only at the vertex. Angles a figure states but cannot use (a theorem,
such as the isosceles triangle's) are checked on every frame.

The order of construction is chosen by an exact search, dynamic programming over the set of placed
points, that uses as many of the figure's equations as possible (each one used removes a degree of
freedom), then prefers named points over auxiliary ones as inputs, then earlier-mentioned points. A
point with two loci available is placed immediately; delaying it can never use more equations.
Above 18 points the search falls back to the same preferences applied greedily.

Every fact the model read is a **check**, evaluated on every frame at the step that places its last
point (the table's `holds`); a fact the construction used holds by construction, and one it did not
use is a theorem when it keeps holding. A failure names the fact. **Order facts** (`between`) are not
equations: they choose which intersection to take, and bound where a point may slide (a slider's value
is measured inside its allowed interval, so dragging can never break the order). `distinct` rules out
"the other intersection".

**Realising** a plan samples its own parameters (seeded, so a figure is stable; reusing previous
positions across edits unless that would make points coincide) and keeps the best-spread sample that
satisfies every fact. No numerical solving is needed. **Executing** a plan with given parameters either
yields every point, or stops at the step that cannot be carried out (two circles that do not meet, an
intersection on the wrong side) and says why; the drawing keeps everything before that step.

**Dragging** changes one parameter. A determined point can be dragged too: the planner is asked for an
order of construction in which that point is an input, and the figure switches to it if no equation is
lost. During a drag each intersection stays on the branch nearest to where it was.

If no configuration satisfies every fact, the figure is drawn by the **numerical solver**
(`solver.ts`, Adam gradient descent on an energy) instead, and the page says so.

**Distinct points.** A `distinct` fact rules out an intersection that would coincide with the given
point ("the other intersection", as the regular hexagon needs) and is checked on every frame. Without
one, the planner still prefers an intersection that lands on no existing point.

**Degenerate configurations.** The logic is exact over every configuration, including coincident
points; the drawing assumes distinct names are distinct points (it merges collinear groups that share
two names, for instance). The two stances differ on purpose; `distinct` lets the logic state the
drawing's assumption where it matters.

## The page

`PageView.vue` composes the page; `useWorkspace` holds its state: the text being shown (scratchpad or a
predicate from the knowledge base), the runtime built from it, the drawable facts, the construction and
its current drawing. The contents' miniatures run the same pipeline for each predicate of a chapter
(about 1 ms each for chapter 1), in idle time, cached per knowledge base. The figure is fitted so that
its points lie beside the text and its circles within the page. `GeometryDiagram` renders the figure, ghosting it under the text column, and
reports parameter changes back after a drag. `CodeEditor` is CodeMirror with highlighting, completion
and the verification gutter. See [design.md](design.md).

## Choices and alternatives

**Why recognise structure instead of declaring it or hard-coding it.** The language is meant to stay
small and general, and extensible beyond Euclidean geometry, so built-in names were out, and so were new
declarations. Recognition by proof keeps plain Horn clauses as the whole meaning while giving the speed
of union-find. The closest existing design is equality saturation in Datalog
([egglog](https://github.com/egraphs-good/egglog)); the idea is borrowed, not the dependency.

**Why construct instead of solve.** Graph-decomposition solvers dominate CAD, but they target
well-constrained sketches with numeric dimensions, and decomposability is not the same as ruler-and-compass
constructibility ([review, 2022](https://arxiv.org/abs/2202.13795);
[survey](https://hal.archives-ouvertes.fr/hal-00481267)). Our figures are under-constrained by design
(you drag the inputs) and Euclid's are constructive, so each point is the intersection of at most two
loci, as in the diagrams of [AlphaGeometry](https://arxiv.org/abs/2502.03544). Checking the leftover
equations on actual configurations follows the witness idea of Michelucci and Foufou: counting alone
cannot tell a dependent equation (a theorem) from a contradiction
([on its limits](https://arxiv.org/abs/1904.00526)).

**Continuity.** Keeping intersections on the nearest branch is the cheap, usual choice; it can jump near
tangencies. The principled answer is Cinderella's complex tracing, and exact tracing is NP-hard in
general ([Denner-Broser](https://www.mi.fu-berlin.de/inf/groups/ag-ti/theses/phd_finished/denner-broser_britta/index.html)).

**Considered and not adopted for now:** backward search with tabling (goal-directed, gives proof trees;
not needed at the current size), SMT solvers (powerful but heavy and opaque), and
Avigad, Dean and Mumma's system E (a formal account of Euclid that reads order facts from the diagram; a
good reference for how `between` and distinctness should eventually work). Algebraic provers (Wu's
method, Gröbner bases) are planned not as the engine but as a third lens on a geometry's model,
beside the construction and the numbers; see the [roadmap](roadmap.md#beyond).

## Tests

| File | Covers |
|------|--------|
| `parser.test.ts` | lexer and parser |
| `unfold.test.ts`, `definitions.test.ts` | unfolding, fresh names, which clauses are definitions |
| `structure.test.ts`, `saturate.test.ts`, `forward-closure.test.ts` | recognised structure; the fast and reference engines agreeing |
| `checker.test.ts`, `runtime.test.ts`, `configuration.test.ts` | checking pipeline and page state |
| `lemmas.test.ts` | every proposition in the book, and the engine's regression lemmas (`fixtures/regression.geo`, expected failures listed) |
| `construction.test.ts` | 13 figures (including Euclid I.2 and I.3, kept as fixtures in `fixtures/constructions.geo`): degrees of freedom, solver-free starting positions, 300 random drags each checked against every fact |
| `geometry.test.ts` | extraction and the numerical solver |
| `useKB.test.ts` | source references for bundled clauses |
