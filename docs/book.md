# The book

elements ships with a book: the content of Euclid's plane geometry, rebuilt in an order that suits
writing it as Horn clauses. Not a faithful edition: we keep what Euclid achieves and choose our own
route to it. This page is the plan, and notes on what was written: chapters 1 to 4 exist.

## What Euclid's plane geometry achieves

Books I–IV and VI (Book V is the theory of proportion behind VI). Grouped by what they achieve rather
than in Euclid's order:

1. **A construction toolkit.** Equilateral triangle (I.1), transferring a length (I.2–3), bisecting an
   angle (I.9) and a segment (I.10), perpendiculars at and from a point (I.11–12), a triangle from three
   lengths (I.22), copying an angle (I.23), the parallel through a point (I.31), the square on a segment
   (I.46). Book VI adds the arithmetic of lengths: dividing a segment in a given ratio (VI.9–10), fourth
   and mean proportionals (VI.12–13), so ruler and compass can add, subtract, multiply, divide and take
   square roots.
2. **Criteria for sameness.** Congruence: SAS, SSS, ASA (I.4, 8, 26) and the isosceles triangle
   (I.5–6). Similarity (VI.4–8). Equality of area (I.35–41).
3. **The parallel postulate and its consequences.** Alternate angles (I.27–29), the angle sum of a
   triangle (I.32), parallelograms (I.33–34).
4. **Area as a quantity.** Figures on equal bases between the same parallels are equal (I.35–41);
   Pythagoras (I.47) and its converse (I.48); identities of squares and rectangles (II.1–10, an algebra
   done with areas); and the culmination, **squaring any polygon** (I.42–45, II.14).
5. **The circle.** Finding a circle's centre (III.1), chords and their perpendicular bisectors (III.3),
   tangents (III.16–19), the angle at the centre is twice the angle at the circumference (III.20),
   angles in the same segment (III.21), cyclic quadrilaterals (III.22), the angle in a semicircle
   (III.31), intersecting chords and secants (III.35–36).
6. **Regular figures.** Circles in and about triangles (IV.4–5); the inscribed square, pentagon, hexagon
   and fifteen-gon (IV.6–16), the pentagon via the golden section (II.11, VI.30).

## How we organise it

**One new kind of sameness per chapter.** Each chapter introduces one equality, with the axioms that
govern it, then builds the constructions and proves the results it makes possible:

| | Chapter | New sameness | Achieves |
|---|---------|--------------|----------|
| 1 | Length | equal segments (`eq-lines`), with points, order and circles | the compass; equilateral triangle; rhombus; doubling and marching; midpoints |
| 2 | Angle | equal angles (`eq-angle`) | congruence; the isosceles triangle; bisecting angles and segments; perpendiculars; copying angles |
| 3 | Direction | parallel lines | the parallel through a point; alternate angles; the angle sum; parallelograms |
| 4 | Area | equal area (of triangles) | Pythagoras; squaring a polygon, a triangle, a rectangle |
| 5 | Circle | four points on one circle (`cyclic`), and turns in it | chords, tangents (`tangent-from`); angles in a circle as turns; the incircle's step |
| 6 | Ratio | equal ratios (`eq-ratio`), solved as turns are | the intercept theorem; similar triangles by turns; the midline, the medians, crossing chords, the angle bisector, the mean proportional |
| 7 | Regular figures | (uses all) | the square and the hexagon's triangle in a circle; dividing a segment, the fourth proportional, the golden section; the pentagon to come |

This fits the engine: each new equality is a relation whose equivalence, symmetries and substitution
rules are written as ordinary clauses and recognised by the engine (see
[architecture.md](architecture.md#the-knowledge-base)), so a chapter adds knowledge, not engine code.
It also fits the reader: each chapter answers a question ("when are two figures the same size?").

**Neutral first, then Euclidean.** Chapters 1 and 2 do not use the parallel postulate; it enters in
chapter 3. So the book has a natural fork: a hyperbolic or spherical book would share chapters 1–2
and replace chapter 3 onwards (with its own drawing layer).

**Each chapter is a `.geo` file** in `src/language/book/`: its axioms, its constructions (definitions,
which the planner draws) and its propositions (`?` lemmas, checked live). In the app, a construction's
page shows its definition together with the propositions about it, each with its ✓.

### Choices that depart from Euclid

- **The compass carries a length.** The drawing layer can draw a circle about any centre with any
  radius already constructed, so Euclid's I.2 and I.3, which prove that a collapsing compass suffices,
  are not needed.
- **Axioms where Euclid argues by superposition**, as Hilbert does: SAS is an axiom, not a proof.
- **Proofs that suit forward chaining.** Pappus' proof of I.5 (compare triangle *abc* with itself as
  *acb*) instead of Euclid's; statements made with an auxiliary construction instead of arithmetic
  where possible (the angle sum, as in I.32, through the parallel at the apex).
- **Results without inequalities are favoured.** Euclid I.16–25 (exterior angles, the triangle
  inequality) need comparisons of size, which the language does not have yet; constructions rarely need
  them.

## Chapter by chapter

### 1. Length  *(exists: `book/01-length.geo`)*

Points, equality of points, equal segments as an equivalence on unordered pairs, order on a line
(`between`), collinearity, Euclid's common notions 2 and 3 (adding and taking away equal segments),
circles. Constructions: the equilateral triangle, the rhombus of two equilateral triangles, doubling a
segment and marching it along a line, the midpoint as a characterisation (its construction and proof
need chapter 2), the regular hexagon. Then constructions on constructions, whose figures have layers:
reflection in a line, Euclid's collapsing compass (I.2) and cutting off a length (I.3), the midpoint with
a compass alone, and the circumcentre (the last two drawn now, proved in later chapters).

Distinct points: `distinct` with its rules and the reserved `false` for contradictions. With them
the chapter states Euclid's first postulate honestly ("two distinct points determine a line"), proves
that marched points are in order once the first step is non-zero, and constructs the regular hexagon by
stepping the radius around a circle, each vertex "the other intersection". That the hexagon closes (its
sixth side is a radius too) shows in the figure but needs angles to prove: a first task for chapters 2
and 3.

### 2. Angle  *(exists: `book/02-angle.geo`; sections 1–4, spreads set aside)*

Euclid Book I's results that need no parallel postulate, for an engine with equalities but no sums or
inequalities. Angles are the main thread; spreads close the chapter.

1. **Axioms.** `eq-angle a b c d e f` (angle *abc* equals angle *def*): an equivalence on angle
   triples, the same angle read backwards, equal points substituted, unchanged when a point moves along
   an arm away from the vertex. Side-angle-side (I.4) as an axiom, as in Hilbert, since Euclid proves it
   by superposition. **Supplements without addition**: `supp a b c d e f` (the two angles together make a
   straight line), with one axiom, that b between a and d makes a-b-c and c-b-d supplements; angles with
   a common supplement are equal. A **right angle** is one equal to its own supplement, and all right
   angles are equal (Euclid's fourth postulate). Side-side-side (I.8) and angle-side-angle (I.26) are
   axioms too, honestly: their proofs argue about which side of a line a point lies on, which the
   engine cannot do yet.
2. **Triangles.** The isosceles triangle (I.5) by Pappus's proof, and its converse (I.6); the three
   angles of an equilateral triangle; vertical angles (I.15).
3. **Constructions**, all drawn with circles alone: bisecting an angle (I.9), bisecting a segment
   (I.10), the perpendicular at a point (I.11) and from a point (I.12), copying an angle (I.23; with a
   compass that carries lengths, equal radii on both arms and a triangle of three equal sides).
4. **Chapter 1's debts.** The midpoint's construction proven (the rhombus's second diagonal halves its
   first); reflection keeps a figure the same (side-side-side); every point of a segment's
   perpendicular bisector is as far from one end as the other, proven case by case (between the
   rhombus's apexes, beyond one). Joining the cases needs case splits, so the circumcentre is still
   drawn rather than proved.
5. **Spreads.** Wildberger's spread between two lines, the angle up to its supplement, with the bridge
   from equal angles to equal spreads. Vertical and supplementary angles have equal spreads at once,
   perpendicularity needs no choice of side, and the algebraic lens (roadmap, *The workbench*) will speak in
   spreads.

Left for later: I.13–14 as sums (their supplement form is in 1), I.16–25 (inequalities), the hexagon
closing (the angle sum, chapter 3), the compass-only midpoint (similar triangles, chapter 6).

**Added for chapter 4 (November 2026): adding and taking away angles.** Euclid's common notions 2 and
3 for angles, as chapter 1 has them for segments: a point x of the segment a-c cuts the angle a-b-c into
a-b-x and x-b-c; angles cut into equal parts are equal, and equal parts taken from equal angles leave
equal parts. A point on a segment puts the arm inside the angle, so no side of a line is needed; the
parts are never added up. Pythagoras's windmill needs it (each of its two angles at b is a right angle
and the angle a-b-c). The rules are said of a triangle's angle (`triangle a b c` in the body), which
makes them fire far less often; with them, a rule that a crossing keeps a corner off a line (a-d
crosses b-c at y, short of b, so d is off a-b). Together they cost the book's checks about 15%.

*Needs:* angle and spread facts as checks in the drawing layer, Byrne's arcs, and the copied angle and
the angle bisector as loci, so that figures stated with equal angles construct (all done); a right
angle's square mark;
symmetry recognition for six-place relations such as `supp` (it stops at five today).

### 3. Direction  *(exists: `book/03-direction.geo`)*

`parallel a b c d`: the lines a-b and c-d have the same direction, parallel or one line. Taking the
same line as parallel to itself makes `parallel` an equivalence, like `eq-lines` and `eq-angle`, so
the engine recognises it; parallel in Euclid's sense, never meeting, is `parallel` with a `triangle`.

1. **Axioms.** The equivalence: the same line read backwards, equal points substituted, any two
   points of a line naming it. Equal alternate angles make a parallel (I.27), which holds without the
   parallel postulate, in hyperbolic geometry too.
2. **The parallel postulate**, in Playfair's form: through a point, only one parallel to a line. In a
   section of its own, so that a hyperbolic book can fork here with everything before it unchanged.
3. **What the postulate gives.** Parallels make equal alternate angles (I.29) and equal corresponding
   angles; two lines parallel to a third are parallel to each other.
4. **Constructions.** The parallel through a point (I.31), by copying an alternate angle; translating
   a segment, by completing a parallelogram.
5. **Parallelograms.** Opposite sides and angles equal (I.34); the diagonals bisect each other; equal
   and parallel segments make a parallelogram (I.33).
6. **The midline** of a triangle: joining two sides' midpoints, parallel to the third side and half
   of it.
7. **Rectangles and squares.** A rectangle is a parallelogram with a right angle; its angles are all
   right and its diagonals equal. A square is a rectangle with equal sides from one corner, so all
   four are equal.

**Sides of a line without sides.** Alternate angles mean something only when the two points are on
opposite sides of the line crossing the parallels (on the same side, equal unsigned angles make the
lines meet). The engine cannot say which side of a line a point is on, but it can say that a segment
crosses a line: a and d are on opposite sides of e-f when some m has `between a m d` and
`collinear e m f`. That crossing is a hypothesis wherever sides matter.

**As written (November 2026).** The postulate is two axioms: lines parallel to a third are parallel
(I.30, which with the axioms of 1 is Playfair's), and I.29, which Euclid proves by a sum of angles;
Playfair's uniqueness is then a lemma. I.29 needs a true triangle a-e-f: `parallel` includes the
same line, on which its angles at e and f are 0 or straight (without that guard the closure derived a
contradiction from chapter 1's doubling). The parallel through a point is chapter 2's `copy-angle`
with a crossing that picks the far side, and is also the translation of a segment. Proved: Playfair,
I.31 (parallel and equal), I.34 (opposite sides and angles), I.33, and the diagonals bisecting each
other.

**The midline, plain (November 2026).** It is stated as said, a triangle and two midpoints, with a
written proof that constructs its one extra point: d-e doubled to f. The triangles about the vertical
angles at e are congruent, c-f runs the way a-b does and as long as d-b, and d-b-c-f is a
parallelogram (I.33). That it is half as long waits for chapter 6's ratios (the midsegment). III.32
lost its named point the same way: the far end of the diameter is a construction step. Earlier, the
midline named its proof's two points in its figure (f, and where the second parallelogram's diagonals
cross), and followed under the convention once the engine was fast enough. What follows was written
before that. Its proof goes through I.33 on a second parallelogram, and lemmas do not
yet become rules, so the closure redoes that reasoning. Three rules now derive most of the
non-degeneracy it needs (chapter 2: a point between b and d is not a corner off b-d; points on two
sides from a corner make a triangle with it; chapter 3: a parallel through a point off a line stays
off it), which took the diagonals lemma's three extra triangles away. The midline still needs a
crossing for the second parallelogram's diagonals, and twice the checker's budget (nine seconds).
What it lacks is less a rule than room: a fourth rule, that a midpoint of distinct points differs
from its ends, made the heavy lemmas of chapters 1 and 2 twice as slow (every new pair of distinct
points on a line adds `parallel` facts, which the closure walks class by class), and with those
facts given as hypotheses the midline is still over budget. Wanted first: lemma compilation (I.33
as a rule), or a faster closure (roadmap, *Next*).

**Definitions stay simple; lemmas state the sides they need** (decided November 2026). A rectangle is
a parallelogram with a right angle, a square a parallelogram with a right angle and two equal sides
from a corner, as one would say them. Carrying the right angle at a to b is I.29 across a-b, which
needs d-a extended past a to a point x on the other side of a-b from c; the engine cannot see that,
so the lemmas that need it say it (x-c crosses a-b at n), and the definitions do not. A square's
sides need no sides; its angles and diagonals are a rectangle's, with the same crossing, and are not
repeated. The rectangle's lemmas say the angles at a and b are equal rather than that b's is right:
a `right` conclusion needs its own point beyond b, which a lemma's head cannot introduce. They check
in about four seconds. Both figures draw with ruler and compass, so a rectangle written this way
sidesteps the solver's failure on four right angles.

**Same side, as opposite sides twice** (November 2026). Corresponding angles, the angles on one side
of a crossing line (supplements: I.29's third part needs no sum) and their converses (I.28) all need
two points on the same side of a line. That is said through a third point opposite both, as Tarski
defines it: the line d-f continued past f to x, which is across the crossing line from d (at f) and
from a (a-x crosses it at m). Then corresponding angles are alternate angles and vertical angles.

Also left out: the angle sum (I.32), a sum, until the engine can add quantities (open questions).

*Needs:* `parallel` in the drawing layer and the parallel through a point as a locus in the planner:
both done (November 2026). A parallel is drawn as its two finite lines, continuing faint, and lines
the figure knows to be parallel (stated, or proven by a lemma, as I.31's are on its page) carry
arrows, one more for each class, as ticks mark equal segments (design.md, *Marks*). Byrne marks
parallels by colour; arrows are the schoolbook convention, which reads in one colour.

### 4. Area  *(exists: `book/04-area.geo`)*

Euclid never measures an area: he cuts figures into pieces and puts them together again. So the book
does too, with triangles as the pieces, and no arithmetic (decided November 2026; see the roadmap's *Open questions*).

1. **Axioms.** `eq-area a b c d e f`: an equivalence on triangles in any order of their corners, which
   the engine recognises as it is (the same machinery as equal angles). Congruent triangles have equal
   areas (Euclid's common notion 4, said as side-angle-side). Triangles on one base between the same
   parallels are equal (I.37, the shear), and a median halves a triangle (I.38 for bases side by side):
   both axioms, since Euclid gets them from parallelograms by cutting and pasting in cases the engine
   cannot split. Cutting a triangle from a corner (a point e between b and c) gives common notions 2
   and 3 for areas. A triangle with the area of a true triangle is a true triangle.
2. **Parallelograms and triangles.** A diagonal halves a parallelogram (I.34), and all four halves are
   equal; parallelograms on one base between the same parallels (I.35); a parallelogram is double a
   triangle on its base (I.41); a median's two halves.
3. **Pythagoras** (I.47), Euclid's windmill, in split form: the line through the right angle parallel to
   the sides of the square on the hypotenuse cuts it into two rectangles, each equal to the square
   next to it. The windmill is a construction, so the proposition has a page and Euclid's figure; on
   it are proved the windmill's two triangles equal and the square on a-b equal to its rectangle
   (their halves), and, with a whole square, that f-b-c is half the square on a-b. The other rectangle
   is the same with b and c exchanged.
4. **Squaring a figure.** Constructions: dropping a corner of a quadrilateral (a polygon to a triangle,
   a corner at a time; I.45's step), a triangle to a rectangle (I.42 in a right angle), a rectangle to a
   square (II.14). The first two are proved; the third is drawn, its proof waiting for sums.

**As written (November 2026).** Parallelograms, squares and rectangles are compared by their halves,
the triangles a diagonal cuts them into; a quadrilateral by the triangles on a diagonal. Sums are
figures cut into parts: Pythagoras says the square on b-c is cut into parts equal to the squares on
a-b and a-c, never that they add up. That carries I.34–I.47, and stops at II.14: the square on b-h
equals the rectangle because the square on m-h is both the squares on m-b and b-h and the square on
m-b and the rectangle, and taking the square on m-b from both needs two sums of one figure, which
split forms cannot say. I.48 (the converse of Pythagoras) stops in the same place.

Pythagoras is stated by the parts of the squares the proof uses (a square's corner, a side, the side
through a): written with whole squares it proves too, but takes the checker five times its budget (65
seconds). Its three lemmas take 4 to 12 seconds; the rest of the chapter, 1 to 5. Several statements
carry hypotheses that only rule out degenerate figures (`distinct a e` in I.35, `distinct b x`
in the windmill): the closure cannot argue that a point differs from another by contradiction.

I.43, the complements, is in (November 2026): its last cut needs three points apart, which the
convention that different names are different points now gives. Left out: I.36, I.38 for bases apart
and I.39–40 (the converses need same side), I.44 (applying an area to a
line, done by the planner's locus), I.48 and II.1–14 (sums).

*Needs:* `eq-area` and `triangle` in the drawing layer (triangles drawn as their sides, equal areas
hatched alike) and an area locus in the planner: done (November 2026).

### 5. Circle

Waits on sums (roadmap, *Next*). The plan: 5a, writable now (the tangent, defined by its right angle
since "touches without cutting" is a negation; chords and the centre; constructions: find the centre,
the tangent from a point, the circle through three points); 5b, after sums (the angle at the centre,
angles in a segment, cyclic quadrilaterals, the semicircle, the alternate segment, a segment admitting
an angle); 5c, comparisons (the III.3 converse, the incircle; equal tangents need hypotenuse-leg).

The centre of a circle, chords, tangents, the angle in a semicircle, inscribed angles, cyclic
quadrilaterals, the circumcircle (the three perpendicular bisectors meet) and the incircle (the three
angle bisectors meet). Concurrences are good to see in the drawing: the planner uses two of the three
lines and the third becomes a check that always holds.

### 6. Ratio

Equal ratios as an equivalence on pairs of segments. The intercept theorem, similar triangles, dividing
a segment into equal parts, the fourth proportional (multiplication and division) and the mean
proportional (square roots): together, the lengths constructible by ruler and compass. The golden
section.

### 7. Regular figures

The triangle, square, hexagon, pentagon, decagon and fifteen-gon inscribed in and circumscribed about a
circle.

## Open questions

The book's open questions (sums, cases, sides, the axioms taken for now, lines as objects,
comparisons of size) are in the [roadmap](roadmap.md#open-questions), with the rest of what is open.
