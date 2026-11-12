# Chapter 1 — Length
#
# When are two points the same, when do two segments have the same length, and when does a point
# lie between two others? From these, circles, and the first constructions: the equilateral
# triangle, the rhombus, the midpoint, doubling and marching a segment, the regular hexagon. Then
# constructions built from those: reflection, Euclid's I.2 and I.3, the midpoint with a compass
# alone, the circumcentre.
#
# The chapter opens with its axioms, as Euclid's Book I opens with postulates and common notions.
# They are ordinary clauses. The engine recognises their structure (equality of points, equality
# of segments as an equivalence on unordered pairs, the symmetries of between and collinear) and
# uses it to run them fast; see docs/architecture.md.

# ══ Axioms ═══════════════════════════════════════════════════════════════════════════════════════

# ── equal points

# Two names for the same point.
eq-point a a: -
eq-point b a: eq-point a b
eq-point a c: eq-point a b, eq-point b c

# ── equal segments: an equivalence on unordered pairs of points

# The segments a-b and c-d have the same length.
eq-lines a b b a: -
eq-lines a b e f: eq-lines a b c d, eq-lines c d e f
eq-lines c d a b: eq-lines a b c d
eq-lines a b c d: eq-lines b a c d
eq-lines a b c d: eq-lines a b d c

# A segment of no length joins a point to itself.
eq-lines a b c c: eq-point a b
eq-point a b: eq-lines a b c c

# ── order and collinearity

# b lies on the segment from a to c.
between c b a: between a b c
between a a b: -
between a b b: -

# a, b and c lie on one line.
collinear b a c: collinear a b c
collinear a b c: collinear c a b
collinear a a b: -
collinear a b c: between a b c
collinear a b c: between b c a
collinear a b c: between c a b

# Order on a line.
between a b d: between a b c, between a c d
between a c d: between a b d, between b c d

# The only point between a point and itself is that point.
eq-point a b: between a b a

# ── equal points may be exchanged

eq-lines x b c d: eq-lines a b c d, eq-point x a
eq-lines a x c d: eq-lines a b c d, eq-point x b
eq-lines a b x d: eq-lines a b c d, eq-point x c
eq-lines a b c x: eq-lines a b c d, eq-point x d
between x b c: between a b c, eq-point x a
between a x c: between a b c, eq-point x b
between a b x: between a b c, eq-point x c
collinear x b c: collinear a b c, eq-point x a
collinear a x c: collinear a b c, eq-point x b
collinear a b x: collinear a b c, eq-point x c

# ── length along a line

# A point strictly between two others is nearer to each than they are to each other.
eq-point b c: between a b c, eq-lines a b a c
eq-point a b: between a b c, eq-lines a c b c

# Common notion 2, equals added to equals: if a-b-c and d-e-f, ab = de and bc = ef, then ac = df.
eq-lines a c d f: between a b c, between d e f, eq-lines a b d e, eq-lines b c e f

# Common notion 3, equals taken from equals: if d-a-l and d-b-g, da = db and dl = dg, then al = bg.
eq-lines a l b g: between d a l, between d b g, eq-lines d a d b, eq-lines d l d g

# ── distinct points

# a and b are different points. Nothing is both equal and distinct: `false` marks a contradiction,
# and a lemma whose hypotheses lead to it holds vacuously.
distinct b a: distinct a b
distinct x b: distinct a b, eq-point x a
false: eq-point a b, distinct a b

# A segment as long as one joining distinct points joins distinct points.
distinct a b: eq-lines a b c d, distinct c d

# Past a point distinct from a, every point is distinct from a.
distinct a c: between a b c, distinct a b

# Two distinct points determine a line (Euclid's first postulate).
collinear a c d: collinear a b c, collinear a b d, distinct a b

# Order on a line, when the inner points differ.
between a b d: between a b c, between b c d, distinct b c
between a c d: between a b c, between b c d, distinct b c

# A point on the line through distinct points a and c, and between a and some point of that line,
# lies on it too.
? collinear a b d: between a b c, collinear a c d, distinct a c

# ══ Circles ══════════════════════════════════════════════════════════════════════════════════════

# The circle about a through b passes through c.
circle a b c: eq-lines a b a c

# Points on one circle are equally far from its centre.
? eq-lines o p o q: circle o a p, circle o a q

# Where two circles meet, where two lines meet, where a circle meets a line.
circle-circle-intersection o a p b i:
    circle o a i
    circle p b i

line-line-intersection a b c d i:
    collinear a b i
    collinear c d i

circle-line-intersection o a b c i:
    circle o a i
    collinear b c i

# ══ Constructions ════════════════════════════════════════════════════════════════════════════════

# The equilateral triangle on a-b (Euclid I.1): c is where the circle about a through b meets the
# circle about b through a.
eq-triangle a b c:
    circle a b c
    circle b a c

# All three sides are equal, and that is all it takes.
? eq-lines a b b c: eq-triangle a b c
? eq-lines a c b c: eq-triangle a b c
? eq-triangle a b c: eq-lines a b a c, eq-lines a b b c
? eq-triangle b c a: eq-triangle a b c

# Two equilateral triangles on a-b. Drawn on opposite sides (the clauses allow either), they make
# a rhombus a-c-b-d.
vesica a b c d:
    eq-triangle a b c
    eq-triangle a b d

# Its four sides are equal.
? eq-lines a c b d: vesica a b c d
? eq-lines a c a d: vesica a b c d
? eq-lines c a c b: vesica a b c d

# The midpoint of a-b. It is where a-b meets the rhombus's other diagonal c-d; proving that needs
# angles (chapter 2).
midpoint m a b:
    between a m b
    eq-lines a m m b

# Doubling a-b: extend it beyond b by its own length.
double a b c:
    circle b a c
    between a b c

# Doubling and the midpoint are the same thing seen from either end.
? midpoint b a c: double a b c
? double a b c: midpoint b a c

# Doubling a segment between distinct points gives a new point.
? distinct a c: double a b c, distinct a b

# Marching a compass along a line: five equally spaced points.
march a b c d e:
    double a b c
    double b c d
    double c d e

# The steps are equal, and two steps make a double step (common notion 2).
? eq-lines a b d e: march a b c d e
? eq-lines a c c e: march a b c d e
? eq-lines a c b d: march a b c d e

# If the first step goes somewhere, the points are in order along the line.
? between a c e: march a b c d e, distinct a b
? between a b e: march a b c d e, distinct a b

# The regular hexagon in the circle about o through a: step the radius around the circle. Each new
# vertex is where the circle meets the circle about the last vertex, at the point other than the one
# before.
hexagon o a b c d e f:
    eq-triangle o a b
    eq-triangle o b c
    distinct c a
    eq-triangle o c d
    distinct d b
    eq-triangle o d e
    distinct e c
    eq-triangle o e f
    distinct f d

# Every vertex is on the circle, and every side is a radius.
? circle o a f: hexagon o a b c d e f
? eq-lines e f o a: hexagon o a b c d e f
#
# That the sixth side, f-a, is a radius too is true, as the figure shows, but the proof needs angles.

# ══ Constructions on constructions ═══════════════════════════════════════════════════════════════
#
# Each of these is built from the ones before, so its figure has layers: its own lines and circles
# in front, the constructions it uses fainter behind, and theirs fainter still.

# The reflection of p in the line a-b: where the circle about a through p meets the circle about b
# through p again.
reflect a b p q:
    circle a p q
    circle b p q
    distinct p q

# a and b are each as far from q as from p.
? eq-lines a p a q: reflect a b p q
? eq-lines b p b q: reflect a b p q

# Placing at a a segment equal to b-c, with a compass that collapses when lifted (Euclid I.2). Build
# the equilateral triangle a-b-d, extend d-b to g on the circle about b through c, then extend d-a
# to l on the circle about d through g. Our compass carries lengths, so the book does not need
# this; it shows that Euclid's weaker compass does just as well.
transfer a b c l:
    eq-triangle a b d
    between d b g
    circle b c g
    between d a l
    circle d g l

# d-l and d-g are equal and so are d-a and d-b, so what is left, a-l and b-g, are equal
# (common notion 3); and b-g is b-c.
? eq-lines a l b c: transfer a b c l

# Cutting off from a-d a segment a-e equal to b-c (Euclid I.3): transfer b-c to a, then swing it
# onto a-d. Three layers deep: this, the transfer, and the equilateral triangle inside that.
cut a b c d e:
    transfer a b c l
    circle a l e
    between a e d

? eq-lines a e b c: cut a b c d e

# The midpoint of a-b with a compass alone (Mohr and Mascheroni). Step the radius three times around
# the circle about b to c, opposite a. The circle about c through a meets the circle about a through
# b at d and e; the circles about d and e through a meet again at m, the midpoint. Proving that
# needs similar triangles (chapter 6); for now, see it.
compass-midpoint a b m:
    eq-triangle b a p
    eq-triangle b p q
    distinct q a
    eq-triangle b q c
    distinct c p
    circle c a d
    circle a b d
    circle c a e
    circle a b e
    distinct d e
    circle d a m
    circle e a m
    distinct m a

# Where the second diagonals of the rhombuses on a-b and on b-c meet: the centre of the circle through
# a, b and c. That o is as far from a as from b needs congruent triangles (chapter 2); drag a, b or c and
# watch it hold.
circumcentre a b c o:
    vesica a b p q
    vesica b c r s
    line-line-intersection p q r s o
