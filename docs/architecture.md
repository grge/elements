# Architecture

How elements turns Horn clauses into checked lemmas and draggable ruler-and-compass figures, and why
it is built this way. For the language itself see [language.md](language.md); for the visual design
see [design.md](design.md). For what it is for and where it is going, see the [README](../README.md) and the [roadmap](roadmap.md).

```
 the book (src/language/book/*.geo) · user clauses · the text on the page
                         │  parse (src/language)
                         ▼
                   KnowledgeBase ── definitions.ts   which clause defines each predicate (iff)
                         │          structure.ts     equivalences, substitution, symmetries, flips (proven)
          ┌──────────────┴───────────────┐
          ▼  checking (web worker)       ▼  drawing (main thread)
   unfold hypotheses                  extract: unfold the page's facts, read through relations.ts
   saturate (forward closure)           constraints → construction.ts: plan → realise → execute
   ✓ / ✗ beside each `?` line           depicted    → figure.ts; marks from stated and ✓ facts
                                       marks merged by the forward closure (second web worker)
                                       GeometryDiagram: render, drag, re-plan, the route on touch
```

## Source map

| Path | What it is |
|------|------------|
| `src/language/` | Lexer and parser; `book/`, the bundled book, one chapter per `.geo` file; `extra/`, chapters after the book that are not part of it (the stress test), whose lemmas are checked on their pages but never taken as proven for marks |
| `src/kb/inference.ts` | `KnowledgeBase`, `unfoldTree` and `unfold`, and `forwardClosure` (the plain reference engine) |
| `src/kb/definitions.ts` | Recognises which clause, if any, defines each predicate |
| `src/kb/structure.ts` | Proves which predicates are equivalences, admit substitution, are symmetric, are differences or sums, or are an equivalence's flip |
| `src/kb/saturate.ts` | The fast forward closure used for checking, built on that structure, with a solver for differences |
| `src/kb/lattice.ts` | Integer combinations of linear equations: the solver for differences (turns) and sums (quadrances) |
| `src/kb/checker.ts` | Checks a lemma or ground query: unfold, saturate, look for the goal |
| `src/kb/runtime.ts`, `configuration.ts` | A page's runtime: the knowledge base extended with its rules, and its ground facts |
| `src/kb/names.ts`, `rules.ts` | Fresh names for auxiliary objects; rule printing, fingerprints, a small cache |
| `src/geometry/relations.ts` | The relation table: what each relation the figure knows is to the model, the checks and the evidence |
| `src/geometry/extraction.ts` | From facts to constraints, what is drawn and what is unread |
| `src/geometry/figure.ts` | What the figure draws through the points: lines, circles, and its marks |
| `src/geometry/marks.ts` | Ticks and arcs: equalities stated or proven by ✓ lemmas, in classes with their chains |
| `src/geometry/provenance.ts` | Where an element of the figure came from, in words; a mark's chain |
| `src/geometry/construction.ts` | The ruler-and-compass planner, executor and dragging |
| `src/geometry/solver.ts` | Numerical fallback for figures with no construction, on the planner's model |
| `src/geometry/closure.ts` | Answers against a figure's forward closure (merging marks), assuming distinct names are distinct points |
| `src/geometry/classes.ts` | Equal segments (union-find) and merged lines, shared by the model and the figure |
| `src/geometry/vocabulary.ts` | Every word the knowledge base mentions, with what it can do and where each capability comes from: the relation table, its definition, or its rules (the contents' index) |
| `src/geometry/view.ts`, `scene.ts` | Fitting a figure to the screen; the figure in screen coordinates (shared by the diagram and the thumbnails) |
| `src/composables/` | `useKB` (bundled + user clauses), `useWorkspace` (page state), `useVerification` (talks to the checking worker), `useClosure` (the closure worker, its answers remembered across visits), `useThumbnails` (contents miniatures) |
| `src/components/` | `CodeEditor` (CodeMirror), `GeometryDiagram` (the figure), `FigureThumb` (a miniature), `WordIndex` (the contents as an index), `WordGraph` and `wordGraphLayout` (the contents as the graph of what each definition rests on) |
| `src/views/PageView.vue` | The page: masthead, source, figure, contents, themes |
| `src/workers/lemmaCheckWorker.ts` | Checks `?` lines off the main thread |
| `src/workers/closureWorker.ts` | Saturates a figure's facts off the main thread, for merging its marks |

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

**Flips** (November 2026). A relation `p` between two blocks is an equivalence `q`'s *flip* when the
rules of the two prove three things:
- `p` is symmetric;
- `p` respects `q`: `p X Y` and `q Y Z` give `p X Z`;
- two `p`s make a `q`: `p X Y` and `p X Z` give `q Y Z`.

A supplement is the book's case: an equal angle on the other side. Together `p` and `q` are then
*signed classes*:
- `q`'s classes, each member with a sign;
- `q` holds between members of the same sign, and `p` between members of opposite signs;
- in a class where some member is its own flip (an angle equal to its own supplement), every two
  members are both.

`p`'s reorderings and its substitution of equals follow from `q`'s. The candidates are the
equivalences some rule for `p` substitutes by, as for sums.

## Checking lemmas and queries

A lemma `? H: B` asks whether `H` follows from `B`. The checker (`checker.ts`):

1. unfolds each hypothesis through definitions. A definition's body-only variables are existential, so
   each unfolding gives them fresh names (`d#1`, `g#1`, shown as `d₁`, `g₁`); `#` starts a comment, so
   they can never collide with names a user writes, and a lemma cannot refer to a construction's
   internal points;
2. computes the forward closure of the result (`saturate.ts`);
3. reports whether `H` is in it.

`saturate.ts` keeps:
- objects in union-find classes, with substitutable argument positions stored as class
  representatives;
- tuple equivalences as classes of canonical tuples, a flip as signs in its equivalence's classes
  (it stores no fact of its own);
- symmetric relations in a canonical argument order.

It skips exactly those rules the structure already implies (each one is checked), and fires every
other rule normally, so it computes the same closure as the plain
`forwardClosure` in `inference.ts`, which stays as the reference. `tests/saturate.test.ts` checks the two
agree on every small lemma.

**Differences are solved** (November 2026). An equivalence the structure analysis proves to be a
difference (two unordered pairs per block, closed under exchanging the middle pairs: `eq-turn`) is
read as equations value(c d) − value(a b) = value(g h) − value(e f), the values of pairs being the
classes of the pairs' equivalence when one substitutes (`parallel`: lines of one direction). When its
union-find does not have a fact, `holds` asks a lattice (`lattice.ts`) built from its classes'
equations at the store's current version: the fact follows if its equation is an integer combination
of them, reduced through rows in echelon form, each step an exact division. Integer combinations are
sound in any abelian group, so round a half turn, where division is not (twice a turn being nothing
leaves two turns). Nothing is asserted back: no rule concludes from `eq-turn`, so answering is enough.
The step beyond the rules, taken deliberately: the solver adds values no pair of the figure has.

**Sums are solved, and give equal values back** (November 2026). A relation of three pairs whose
rules prove it a sum (its parts exchange; equal pairs stand in; the parts determine the whole:
`quad-sum`, quadrances over equal lengths) has its facts read as equations value(a b) + value(c d) =
value(e f), on the same integer lattice as turns; `holds` asks it, and after every round pairs it
shows equal are asserted equal (`eq-lines`), so congruence and the rest use them. A difference's
*faithful* rule (`parallel` from a turn of nothing) is implemented the same way: equal directions go
back as parallels, the rule itself not fired. Relevance follows these links. And an atom of a solved
relation in a rule's body waits until its arguments are bound, then asks the solver, so rules see
what the solver knows.

**A rule's own symmetries are broken** (November 2026, `symmetry.ts`). A renaming of a rule's
variables that maps its body onto itself (each atom onto one that reads the same, by what the
structure analysis proved) and its head onto an equivalent head turns every match into another with
the same conclusion: side-angle-side has three (exchange the triangles, read both backwards, both).
Matching keeps only the least match of each such family in a fixed order of the variables, checked
as soon as the deciding variables are bound (lex-leader). Any subset of the symmetries is sound: the
least member of a family passes every check. Measured on chapters 1 to 3: every closure that runs to
its end identical, 16% less work; the windmill's proof 2.48 million units of work to 1.87 million.

**Only rules that can help are fired** (November 2026, `relevant`): working back from what will be
asked (the goal, or a closure's queries), `false` and the equality, through the bodies of rules whose
heads are needed, a rule whose head is never needed is not fired. Sound: what it would derive could only
feed rules that are cut too. Measured on the book it changes nothing, its relations being one web; it
matters for a predicate nothing is concluded from, such as `eq-turn`, whose rules then cost nothing to
a proof that asks for no turn. The definitions analysis likewise re-checks, after a change, only the
predicates that depend on one whose status changed.

**Definitions are abbreviations** in `saturate.ts` (November 2026): a defined predicate's facts are never
stored. Its clauses (the definition and the theorems proven from it) do not fire; a rule that mentions
one in its body would have it replaced by its definition, the definition's own points becoming new
variables (no rule in the book does); and asking whether one holds (a lemma's claim, a mark's `right`)
searches for an instance of its definition among the facts. The meaning is unchanged, only when the work
is done: every verdict of the book, the regression lemmas and *Beyond the book* is the same. Stored facts
fall ten to fifty times (the windmill's from 20 847 to 1 984); the book checks in three quarters of the
time. The definitions analysis (`definitions.ts`) keeps every clause firing (`abbreviate: false`), since
it decides what a definition is.

Matching uses indexes (November 2026).
- **A stored relation** is indexed by (position, value), over the images of its facts, so a bound
  argument is a lookup.
- **An equivalence** is indexed by (position in a block, value), over the keys mentioned in its
  classes. With a block not fully bound, but an argument bound, the match visits only the keys with
  that value there, each with its class.
- **With nothing bound,** it walks every mentioned class, then the tuples never mentioned, which
  match only reflexively (both blocks images of one tuple). Only those consistent with what is bound
  are generated, from the block with fewer unbound variables.

In a signed class, two members match as equals when their signs agree, as flips when they differ,
and as both in an odd class.

**The early head check.** A partial match is abandoned once its rule's head is one fact and the store
already has it, since nothing the match goes on to find could add anything. The head is one fact when
every head variable is bound, and none stands for a class at a position where equals do not
substitute: there the head is a fact for each member, and one holding says nothing of the others.
It is skipped for heads that are defined or answered by a solver.

**Proofs** (November 2026; `proof.ts`, engine.md *Part 1*).
- **Provenance.** The store records why each fact, each union of tuples (with its sign) and each
  merge of points is there:
  - a rule's match (premises worked out only when something new is recorded);
  - a solver's step (its equations, integer coefficients from the lattice, and the equalities of
    values it relies on, all taken when it acts);
  - given.
- **Certificates are taken at the moment they are used.** A rule premise the turn solver answered
  in the middle of a join gets its certificate when the rule's conclusion is recorded, before that
  conclusion changes the store. Later, the solver's equations may include facts that came after.
- **Explanation.** `Saturation.explain(goal, hypotheses)` turns provenance into a proof:
  - a membership in a class is the shortest path through recorded unions, signs counted
    (proof-producing union-find);
  - every explanation is bounded by time, so it never goes round a cycle;
  - steps that structure gives for nothing (a fact read another way, a one-link chain) are not
    steps.
- **Checking.** `replay` (`proof.ts`) checks a proof on a store that fires no rule. It asserts the
  hypotheses, then checks each step: its premises hold; a rule step is an instance of its rule; a
  solver step's fact follows once the solvers have settled.
- **Cost:** none measurable. The book checks in 34.4 s with provenance, against 34.5 without.
- **Measured:** every book lemma's proof explains and replays (`tests/proof.test.ts`). The checker
  returns the proof with a ✓ when asked (`CheckOptions.explain`).
- **Kept proofs.** The checking worker keeps each ✓'s proof by the lemma's text, and checks the
  lemma again by replaying it (`checkByReplay`) before any search. A kept proof is used only if:
  - the hypotheses unfold now to the facts it started from (with the convention's `distinct` facts
    if it was found under it, so a ✓ apart stays apart);
  - every rule it cites is in the knowledge base now, matched by the rule's text, since a page's
    rules are parsed again on every edit;
  - it replays.

  Consistency is still asked: a witness, or `false` out of reach; otherwise the lemma is searched.
  Verdicts that are not ✓ keep nothing, since a new rule can change them.
- **On the page.** The worker posts each ✓ with its proof as plain data (`proofView.ts`): the steps
  that carry the argument, and apart from them the side conditions (`distinct`, `triangle`,
  `collinear`, `between`, rule steps resting only on those, ratios that are one on both sides).
  Clicking the ✓ unfolds it under the lemma (`CodeEditor.vue`), the side conditions behind one line.
  A rule step names its rule by text; the page shows where it is written (`ruleWrittenAt` in
  `useKB.ts` for the book, the page's own lines first), and clicking opens the page of the
  predicate it concludes.
- **Written proofs.** A lemma's `?` steps (`Lemma.steps`) are checked by `checkWrittenProof`: each
  step by a short search (`STEP_WORK`) from the unfolded hypotheses and the steps above, plain first,
  then under the convention; each construction (a step naming new points) through a callback, so the
  logic stays free of figures. The page answers it with `checkConstruction`
  (`geometry/constructionStep.ts`): the step is planned with the figure above it, its inputs kept,
  and sampled for four things: no point above placed by means of a new one; determined or freely
  chosen; apart from every other point (only then covered by the convention); existing always or
  only as witnessed. A figure with no sample names the point the new one falls on, where it can.
  `writtenVerdicts` (verdict.ts) turns the result into marks: one per step (a construction's says
  what it constructs, under its ✓), and the lemma's, unproven while any step is not shown.
  A step may cite lemmas (`lemmas`: the book's, `language/bookLemmas.ts`, and the page's ✓ lemmas
  above): each joins that step's search as a rule over primitives, its hypotheses unfolded, only for
  a step whose predicate it concludes (`citable`, `withCited`); `citedLemma` names it in the proof.

**Searches are shared and resumable** (November 2026). A run that stops inside a round keeps its
place: the rule it was at, and that rule's matches not yet asserted. `saturate` keeps the last
few searches, keyed by their rules (the relevant cut, which depends on the goal's predicate),
their seeds and their budgets. A lemma with the same hypotheses and a goal of the same predicate
(the windmill's two) carries the last search on towards its own goal (`Saturation.resume`).
- It first re-asks the check the search stopped at, then runs on under the same budgets, counted
  from the start.
- The search is deterministic and the closure only grows, so this is step for step the search a
  fresh one would make, and the verdict is the same. Measured on every lemma of the book and
  *Beyond*: no verdict differs.
- The solvers' answers are cached per version of the store, since a join asks the same atom
  again and again.

The search has two budgets, whichever runs out first: derivations, and **work** (join steps, the
partial matches a rule's body is extended from, `Saturation.work`), which is in proportion to time.
Join steps are fixed by a rule's join order alone, so an engine that joins in the same order counts
the same (since November 2026; before, index scans counted too). Derivations alone stopped
measuring anything once the cheap derivations of defined facts were gone: the same budget bought three
times the search.

The search ends with the goal derived, with the hypotheses contradictory (they derive the reserved
`false`, which takes precedence), with the closure complete and no goal, or out of its budget of
derivations and of work (above). Because the search stops as soon as the goal is found, a derived goal still needs its
hypotheses shown consistent: contradictory hypotheses can derive the goal too, and the lemma would then
be vacuous. There are three ways, cheapest first:

- `false` cannot be derived at all from the kinds of facts involved (a test at the level of predicate
  names);
- a **witness**: a figure in which every hypothesis holds (numeric evidence, below, finds one in
  milliseconds). Hypotheses true together in the plane cannot be contradictory, as long as the axioms
  are true of the plane. The checker takes this as an answer from its caller (`CheckOptions.consistent`),
  so the logic knows nothing of figures;
- otherwise the closure is carried on to the end, looking for `false`. If that runs out of budget the
  check says so (`unshown`: follows, but the hypotheses could not be shown consistent), not ✓.

Before witnesses (November 2026) every derived lemma took the third way, which was four fifths of
checking time, and twelve of the book's ✓ rested on that search running out of budget. Now every book
lemma has a witness, and the book's checks take a fifth of the time (`scripts/bench.ts --witness`). The
tests still run the full search, so a false axiom still shows, and they check that every fact the
closure derives about a lemma's points holds in its witness.

**The non-degeneracy convention** (`CheckOptions.distinctNames`, which the page uses): a lemma that does
not follow is checked a second time with `distinct` for every two points of its unfolded hypotheses and
claim, except pairs it relates by `eq-point`. The convention only adds hypotheses, so a plain ✓ is kept
as the stronger result and the book's checks cost nothing more; a ✓ found the second way is marked
`apart` ("for figures whose points are all apart"). A witness has its points apart, so it witnesses the
convention too. A contradiction that only the convention brings is a pair of names the hypotheses make
one point, and the verdict names them. The cost: a lemma that follows neither way is checked twice, and
under the convention more guarded rules fire (most re-deriving known facts: the windmill's lemmas need
three times the derivations for the same facts, which a budget counted in facts added would not mind,
*Next*, step 3).

What it cannot do: case splits. Facts that need one can be stated with a `distinct` hypothesis instead
(the order of marched points holds once the first step is non-zero), and are on the
[roadmap](roadmap.md).

**Numeric evidence** (`geometry/evidence.ts`) weighs every lemma against figures. Its hypotheses are
extracted and planned like any figure; about two dozen well-spread configurations are sampled, and the
head, extracted too, is measured on each with the relation table's `holds`. The first sample in which
every hypothesis holds with a margin (distinct points at least a thousandth of the figure apart, a
triangle at least a thousandth of its square in area) is the witness. The samples choose their branches
by the same search as a page's (below). The relation table's `holds` also measures
`eq-point`, a relation the figure can evaluate but not impose). The verdict (`geometry/verdict.ts`, above both
the logic and the figures) combines the two: ✓ derived, with the hypotheses witnessed or searched to the
end; ⊥ vacuous; ✗ not derived and refuted by a sampled figure (false); ? not derived, with the
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
(`read`), whether the figure draws it as itself (`depicted`) and how (`draw`, through a pen: a line, a
finite straight line, a circle, an angle as an arc or a square), whether it holds at given positions
(`holds`), and for the solver how far it is from holding (`residual`). Extraction, the model, the
figure, the checks a drawing is held to and numeric evidence all ask the table instead of switching
on names. Every element of the figure keeps the facts that made it (`meta` in `scene.ts`), so bringing
forward what a hovered fact draws is a lookup.

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
while the point is touched. Hovering an element of the figure says where it came from
(`provenance.ts`): each extracted fact keeps the index of the written fact it was unfolded from.

**Planning** (`construction.ts`) turns the model into a straight-line program in which each point is

| step | degrees of freedom | |
|------|-----|---|
| free | 2 | an input |
| on a locus | 1 | a slider along a line, a circle, a perpendicular bisector, a ray at a given angle, an angle's bisector, the parallel through a placed point, a parallel at the height that makes an area, a right angle's perpendicular, or the circle on a right angle's arms |
| where two loci meet | 0 | an intersection, with a choice of branch |

Loci are built from points already placed: the line through two points of a collinear group; a circle
about a placed centre whose radius is any placed segment of equal length (the compass carries a length;
Euclid I.2 shows this is no stronger than the collapsing compass); the perpendicular bisector of two
placed points the new point is equidistant from.

Equal ratios (`eq-ratio`, November 2026) give two: with one length of the four unknown, a circle about
its known end whose radius is the fourth proportional (`proportional`, VI.12); with two lengths from
the point standing as a ratio, the circle of Apollonius (or the perpendicular bisector, the ratio one).

Four points on one circle (`cyclic`, November 2026) put the fourth on the circle through the other
three, once those are placed (`through`); the figure draws that circle with no centre point.

Equal turns give two more (November 2026). A point whose line from a placed point must turn from a
placed line as another pair of lines turns is on one line through that point (`turned`): directed,
there is no second ray to choose. A point from which a placed chord is seen at a known turn is on one
circle through the chord's ends (`seen`): the inscribed angle, directed, is the whole circle (III.21).

Equal angles and supplements give loci too: a point whose angle at a placed vertex must equal a known
angle lies on one of two rays from the vertex (either side of the placed arm), and a point making
equal angles with two placed arms lies on their bisector (the outer bisector for supplements; for a
straight angle, the perpendicular). Of the two rays the drawing keeps the one the point is on, as it
keeps an intersection's branch. An angle condition on a point already on a line through the vertex is
not used: that line meets the rays only at the vertex. More generally, two straight loci through the
same placed point (two copied angles at one vertex, a line and a ray from a point on it) meet only there:
they are one condition between the angles, not two on the point, so only the first counts and another
point takes up the rest; the same locus reached twice counts once. A point with equal base angles
towards two placed points is on their perpendicular bisector (I.6). A point on a ray stays just off
its vertex, and a meeting point already taken by another point is a failure, not a fallback: the
drawing takes distinct names for distinct points. Angles a figure states but cannot use (a theorem,
such as the isosceles triangle's) are checked on every frame.

A parallel gives a locus once a point's partner and the other line are placed: the line through the
partner with the other line's direction. A parallelogram's fourth corner is where two such meet.

An equal area gives one when a triangle's corner is the only point of `eq-area` not yet placed: the
two lines parallel to the side opposite it, one either side, at the height that gives the triangle
the other's area. Of the two the drawing keeps the one the point is on, as for a copied angle. With a
shared base (`eq-area a b c a b d`) one of them is the parallel through c, which is the shear; in
general it is Euclid's I.44, applying an area to a given line, done numerically.

A right angle is read from the equal angles it unfolds to: two angles at one vertex sharing an arm,
whose other arms run either way along a straight line through the vertex (`right a b c` is
`between a b d` and `eq-angle a b c c b d`). It is one equation with two loci. An arm's point is on the
perpendicular at the vertex once the vertex and the other arm are placed; the vertex is on the circle
on the arms' points (Thales) once both are, which is how the foot of a perpendicular from a placed
point to a placed line is found (the Simson line's three feet, the altitudes). The extension point d
then comes after, anywhere on its line beyond the vertex. Nothing names `right`: a right angle written
out by hand is read the same way. The loci are Euclidean, like the rest of the planner's.

Two loci can be one curve because of a theorem the planner cannot see from the facts' shapes: a point
on the circle about the midpoint of a-c makes a right angle at a and c, so its Thales circle is that
circle. Planning carries the plan out on a few samples; if a meeting point's two loci coincide in
every one, the second is set aside for that point and the order is chosen again, the right angle is
checked rather than used, and holds on every frame (a dependency).

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
positions across edits on the same page, unless that would make points coincide, but never another
page's) and keeps the sample that satisfies every fact and reads best, then improves it by a short
local search (`polish`: move every parameter a little, keep a move that still satisfies every fact and
reads better). How well a figure reads (`legibility`) is its worst near-miss: two named points close
together, a named point close to a segment, line or circle drawn through others that it is not on (a
sliver triangle is one of these), or two drawn lines nearly but not exactly equal, parallel or
perpendicular, which would suggest a relation the figure does not have. What is drawn comes from the
relation table's `draw`, as for the figure itself. For each sample, branches are chosen by backtracking (`search`): every choice
nothing decides (which of two meeting points, which of a locus's two curves, which way a slider runs
along a line unbounded both ways) takes its first way, and if a later step fails or a later fact does
not hold, the latest choice at or before that step takes its next way. A choice is often decided only
by a fact about a point placed later: that a windmill's squares stand outside its triangle shows only
where their lines cross. The search is deterministic, and it serves pages, evidence and the facts the
plan does not construct alike. While a figure is redrawn or dragged, the previous positions decide
instead, so a branch never jumps. No numerical solving is needed. **Executing** a plan with given parameters either
yields every point, or stops at the step that cannot be carried out (two circles that do not meet, an
intersection on the wrong side) and says why; the drawing keeps everything before that step.

**Dragging** changes one parameter. A determined point can be dragged too: the planner is asked for an
order of construction in which that point is an input, and the figure switches to it if no equation is
lost. During a drag each intersection stays on the branch nearest to where it was.

If no configuration satisfies every fact, the figure is drawn by the **numerical solver**
(`solver.ts`, Adam gradient descent on an energy) instead, and the page says so: the facts the
plan does not construct (`unconstructed`, those that fail in every sampled drawing), the point each
is said to place, and whether the solved figure meets it (`solution` in `useWorkspace.ts`; how it
looks: design.md, *Constructed or solved*). The solver starts from the construction's own attempt,
which places every point it can on the right side of every order, and then from random starts.

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
beside the construction and the numbers; see the [roadmap](roadmap.md#the-workbench).

## Tests

| File | Covers |
|------|--------|
| `parser.test.ts` | lexer and parser |
| `unfold.test.ts`, `definitions.test.ts` | unfolding, fresh names, which clauses are definitions |
| `structure.test.ts`, `saturate.test.ts`, `forward-closure.test.ts` | recognised structure; the fast and reference engines agreeing |
| `checker.test.ts`, `runtime.test.ts`, `configuration.test.ts` | checking pipeline and page state |
| `lemmas.test.ts` | every proposition in the book, and the engine's regression lemmas (`fixtures/regression.geo`, expected failures listed) |
| `construction.test.ts` | 27 figures (including Euclid I.2 and I.3, kept as fixtures in `fixtures/constructions.geo`, and chains of equal angles): degrees of freedom, solver-free starting positions, 300 random drags each checked against every fact by an independent oracle; no point collapsing onto another |
| `angles.test.ts` | angles and spreads: recognised structure, the chapter's lemmas, the measures |
| `evidence.test.ts` | numeric evidence: every sampled book lemma holds in every sample; verdicts |
| `extraction.test.ts`, `relations.test.ts` | the three readings of an unfolding; the relation table; the plan checking every fact it read |
| `geometry.test.ts` | the figure (each relation's drawing) and the numerical solver |
| `marks.test.ts`, `provenance.test.ts` | marks from statements and proofs, equality chains, merging by the closure, right angles; where an element came from |
| `emphasis.test.ts`, `thumbnails.test.ts` | bringing forward what a hovered fact draws; the contents' miniatures |
| `useKB.test.ts` | source references for bundled clauses |
