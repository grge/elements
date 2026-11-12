# The book

elements ships with a book: the content of Euclid's plane geometry, rebuilt in an order that suits
writing it as Horn clauses. Not a faithful edition: we keep what Euclid achieves and choose our own
route to it. This page is the plan; chapter 1 exists, and chapter 2 is under way.

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
| 4 | Area | equal area | Pythagoras; squaring rectangles, triangles, then any polygon |
| 5 | Circle | (uses 1–4) | centre, chords, tangents; inscribed angles; circumcircle and incircle |
| 6 | Ratio | equal ratios | similar triangles; dividing segments; fourth and mean proportionals; the golden section |
| 7 | Regular figures | (uses all) | the triangle, square, hexagon, pentagon and fifteen-gon in a circle |

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

### 2. Angle  *(in progress: `book/02-angle.geo`, sections 1–4 written)*

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
   perpendicularity needs no choice of side, and the algebraic lens (roadmap, *Beyond*) will speak in
   spreads.

Left for later: I.13–14 as sums (their supplement form is in 1), I.16–25 (inequalities), the hexagon
closing (the angle sum, chapter 3), the compass-only midpoint (similar triangles, chapter 6).

*Needs:* angle and spread facts as checks in the drawing layer, and Byrne's arcs (done); the copied
angle as a locus (a ray from a point at a given angle, with a choice of side), so that figures *stated*
with equal angles construct rather than fall back to the solver; a right angle's square mark;
symmetry recognition for six-place relations such as `supp` (it stops at five today).

### 3. Direction

`parallel a b c d`. The parallel postulate (in Playfair's form: one parallel through a point),
alternate angles, the angle sum, parallelograms and their diagonals, the midline of a triangle.
Constructions: the parallel through a point, translating a segment.

*Needs:* the parallel through a point as a locus in the planner.

### 4. Area

Equal area of triangles (invariant under any reordering of the vertices): shearing along a parallel
keeps area (I.37), parallelograms and triangles on the same base, Pythagoras by Euclid's windmill, and
the quadrature sequence: any polygon to a triangle of equal area, a triangle to a rectangle, a rectangle
to a square.

*Needs:* a way to add areas (see open questions).

### 5. Circle

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

- **Adding quantities.** The angle sum, additivity of area and products of ratios all add things.
  Horn clauses can do this through auxiliary constructions (as Euclid does), or a generic arithmetic
  component could solve linear equations between quantities (as AlphaGeometry's algebraic reasoning
  does). The latter is not geometry-specific, so it would not break the engine's generality, but it is
  not an abbreviation for Horn clauses either. Decide before chapter 4.
- **What to prove and what to assume.** Hilbert-style axioms keep proofs short; Euclid's propositions
  are more instructive. Likely: assume what Euclid proves by superposition, prove the rest.
- **Lines and circles as objects.** `parallel a b c d` talks about lines through point pairs; a line
  object would read better and suit projective or other geometries. Not needed yet.
- **Comparisons of size**, for the triangle inequality and Euclid I.16–25.
- **Angles or spreads, for chapter 2.** Wildberger's *spread* between two lines (in effect the squared
  sine of the angle) does not tell an angle from its supplement. That sounds like a loss, but rays,
  sides and orientation are exactly what Horn clauses handle worst: which side of a line a point is
  on, supplementary angles, the case splits the engine cannot do. An `eq-spread` relation on pairs of
  lines (four points) avoids most of that, and many of Euclid's results restate cleanly with it.
  Options: `eq-angle` alone (Euclid's own, with sides to manage), `eq-spread` alone, or spreads first
  and angles where orientation matters. Decide before writing chapter 2.
