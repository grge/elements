# Chapter 3 — Direction
#
# When do two lines run the same way? Lines that never meet are parallel; taking a line as parallel to
# itself makes "the same direction" an equivalence, as equal lengths and equal angles are. Equal
# alternate angles make lines parallel without any postulate. The converse, that parallels make equal
# alternate angles, is Euclid's fifth postulate at work: everything after it holds in Euclid's plane
# and not in the hyperbolic one.
#
# Which side of a line a point lies on is not something the engine can say. That two points are on
# opposite sides of a line it can: the segment between them crosses the line at some point.

# ══ Axioms ═══════════════════════════════════════════════════════════════════════════════════════

# ── the same direction: an equivalence on pairs of points, each pair naming a line

# Line a-b runs the same way as line c-d: they are parallel, or one line. (A pair of equal points names
# no line, and has the same direction only as another such pair.)
parallel a b a b: -
parallel c d a b: parallel a b c d

# The same line read backwards.
parallel b a c d: parallel a b c d

# ── equal points may be exchanged

parallel x b c d: parallel a b c d, eq-point x a
parallel a x c d: parallel a b c d, eq-point x b
parallel a b x d: parallel a b c d, eq-point x c
parallel a b c x: parallel a b c d, eq-point x d

# ── lines

# Any two points of a line name it.
parallel a b a c: collinear a b c, distinct a b, distinct a c

# Two lines through one point that run the same way are one line.
collinear a b c: parallel a b a c

# So a line through d running the same way as a-b, and through c off a-b, keeps d off a-b too.
triangle a b d: parallel a b d c, triangle a b c, distinct d c

# ── alternate angles

# Equal alternate angles make parallels (Euclid I.27): the line e-f crosses e-a at e and f-d at f, with
# a and d on opposite sides of it (the segment a-d crosses e-f at m), and the angles a-e-f and d-f-e are
# equal. No postulate is needed: this holds in hyperbolic geometry too.
parallel e a f d:
    eq-angle a e f d f e
    between a m d
    collinear e m f
    distinct e f
    distinct e a
    distinct f d

# ══ The parallel postulate ═══════════════════════════════════════════════════════════════════════
#
# From here on the plane is Euclid's. A hyperbolic book shares everything above and parts here.

# Lines that run the same way as a third run the same way as each other (I.30). With the axioms
# above this is Playfair's postulate: through a point, only one parallel to a line.
parallel a b e f: parallel a b c d, parallel c d e f

# Parallels make equal alternate angles (I.29), the converse of I.27. Euclid proves it from his fifth
# postulate by an argument about angles that together fall short of two right angles, a sum the engine
# cannot make; here it is taken with the postulate. The two lines must be two: a-e-f a true triangle
# (on one line, e-a and f-d would be the same line, and its angles at e and f 0 or straight).
eq-angle a e f d f e:
    parallel e a f d
    between a m d
    collinear e m f
    triangle a e f
    distinct f d

# Playfair's form: through c, only one line runs the same way as a-b.
? collinear c d e: parallel a b c d, parallel a b c e

# ── corresponding angles, and angles on the same side
#
# Below, the line e-g crosses e-a at e and f-d at f, in the order e, f, g, and d is on the same side of
# it as a. Same side is said as opposite sides twice: the line d-f continued past f to x has x on the
# far side from d (it crosses at f) and on the far side from a (a-x crosses e-f at m).

# Parallels make equal corresponding angles (I.29): a-e-f and x-f-e are alternate, and x-f-e and d-f-g
# are vertical angles.
? eq-angle a e f d f g:
    parallel e a f d
    between e f g
    between d f x
    between a m x
    collinear e m f
    triangle a e f
    distinct f d
    distinct f x
    distinct f g

# And the angles they make on the same side together make a straight line (I.29), supplements, so no
# sum is needed.
? supp a e f e f d:
    parallel e a f d
    between d f x
    between a m x
    collinear e m f
    triangle a e f
    distinct f d
    distinct f x

# The converses (I.28). Euclid proves them from I.27, without the postulate; the engine's proofs pass
# through I.30 only to call the line f-x by the name f-d.
? parallel e a f d:
    eq-angle a e f d f g
    between e f g
    between d f x
    between a m x
    collinear e m f
    triangle a e f
    distinct f d
    distinct f x
    distinct f g
? parallel e a f d:
    supp a e f e f d
    between d f x
    between a m x
    collinear e m f
    triangle a e f
    distinct f d
    distinct f x

# ══ Constructions ════════════════════════════════════════════════════════════════════════════════

# The parallel to a-b through p (Euclid I.31): copy the angle a-b-p to p, on the far side of b-p from a.
# Then a-b-p and q-p-b are equal alternate angles. Its q is p moved as b is moved from a: the same
# construction translates the segment a-b to p.
parallel-through a b p q:
    copy-angle a b p p b q
    between a m q
    collinear b m p

? parallel a b p q: parallel-through a b p q, distinct a b, distinct b p
? eq-lines p q a b: parallel-through a b p q

# ══ Parallelograms ═══════════════════════════════════════════════════════════════════════════════

# A parallelogram a-b-c-d: opposite sides run the same way, and its diagonals a-c and b-d cross (which
# follows from the parallels, by an argument about sides the engine cannot make).
parallelogram a b c d:
    parallel a b d c
    parallel a d b c
    between a m c
    between b m d
    triangle a b c
    triangle c d a

# Opposite sides are equal (I.34): the diagonal a-c makes two triangles with equal alternate angles at
# both ends of a common side.
? eq-lines a b c d: parallelogram a b c d
? eq-lines a d b c: parallelogram a b c d

# And opposite angles.
? eq-angle a b c c d a: parallelogram a b c d

# Equal sides that run the same way make a parallelogram (I.33): the diagonal a-c makes two triangles
# with two sides and the angle between them equal, so the other alternate angles are equal too.
? parallel a d b c:
    parallel a b d c
    eq-lines a b d c
    between b m d
    collinear a m c
    triangle a b c
    triangle c d a

# The diagonals bisect each other: the triangles on a-b and c-d have equal alternate angles at both ends
# of equal sides. The parallelogram is written out, to name where its diagonals cross.
? midpoint m a c:
    parallel a b d c
    parallel a d b c
    between a m c
    between b m d
    triangle a b c
    triangle c d a
? midpoint m b d:
    parallel a b d c
    parallel a d b c
    between a m c
    between b m d
    triangle a b c
    triangle c d a

# ══ Rectangles and squares ═══════════════════════════════════════════════════════════════════════

# A rectangle a-b-c-d: a parallelogram with a right angle.
rectangle a b c d:
    parallelogram a b c d
    right d a b

# Its angles at a and b are equal, and opposite angles are equal, so all four are right angles. The
# angle at a is carried to b by alternate angles at a-b, which needs d-a extended past a to x on the
# far side of a-b from c (x-c crosses a-b at n): a fact about sides the engine cannot see, so it is
# said here.
? eq-angle d a b a b c: rectangle a b c d, between d a x, distinct a x, between x n c, collinear a n b

# Its diagonals are equal: the triangles d-a-b and c-b-a have two sides and the angle between them equal.
? eq-lines a c b d: rectangle a b c d, between d a x, distinct a x, between x n c, collinear a n b

# A square: a parallelogram with a right angle and two sides from a corner equal. Its sides are all
# equal (opposite sides of a parallelogram are). It is a rectangle, so its angles are right and its
# diagonals equal, with the same fact about sides.
square a b c d:
    parallelogram a b c d
    right a b c
    eq-lines a b b c

? eq-lines b c c d: square a b c d
? eq-lines c d d a: square a b c d

# ══ The midline ══════════════════════════════════════════════════════════════════════════════════

# The midline of a triangle a-b-c: d and e halve a-b and a-c, and d-e runs the way b-c does, half as
# long. Its proof draws two more points, and they are part of the figure here, since a lemma's
# hypotheses can only name points the figure has: d-e doubled to f, and x, where d-c and b-f cross.
# e halves both a-c and d-f, so a-d-c-f is a parallelogram (its diagonals halve each other), and c-f
# runs the way a-d does and as long. So c-f also runs the way d-b does and as long, and d-b-c-f is a
# parallelogram too (I.33, with its diagonals crossing at x).
midline a b c d e f x:
    triangle a b c
    midpoint d a b
    midpoint e a c
    between d e f
    eq-lines d e e f
    between d x c
    between b x f

? parallel d e b c: midline a b c d e f x
? eq-lines d f b c: midline a b c d e f x

# ══ Turns ════════════════════════════════════════════════════════════════════════════════════════
#
# The turn from one line to another: how far the first must turn, always the same way round, to lie
# along the second. A turn is directed: the turn back is the other way. A half turn brings a line back
# to itself, so lines that run the same way turn by nothing. Turns are about directions alone, so they
# belong to Euclid's plane: that turns add up, as below, is the parallel postulate at work.

# ── an equivalence on pairs of lines

# The turn from line a-b to line c-d is the turn from line e-f to line g-h.
eq-turn a b c d a b c d: -
eq-turn e f g h a b c d: eq-turn a b c d e f g h
eq-turn a b c d i j k l: eq-turn a b c d e f g h, eq-turn e f g h i j k l

# A line read backwards is the same line.
eq-turn b a c d e f g h: eq-turn a b c d e f g h
eq-turn a b d c e f g h: eq-turn a b c d e f g h

# ── equal points may be exchanged

eq-turn x b c d e f g h: eq-turn a b c d e f g h, eq-point x a
eq-turn a x c d e f g h: eq-turn a b c d e f g h, eq-point x b
eq-turn a b x d e f g h: eq-turn a b c d e f g h, eq-point x c
eq-turn a b c x e f g h: eq-turn a b c d e f g h, eq-point x d
eq-turn a b c d x f g h: eq-turn a b c d e f g h, eq-point x e
eq-turn a b c d e x g h: eq-turn a b c d e f g h, eq-point x f
eq-turn a b c d e f x h: eq-turn a b c d e f g h, eq-point x g
eq-turn a b c d e f g x: eq-turn a b c d e f g h, eq-point x h

# ── turns are of directions

# A turn depends only on which way its lines run: a line may be swapped for any line running its way,
# itself named by other points included.
eq-turn i j c d e f g h: eq-turn a b c d e f g h, parallel a b i j

# Lines that run the same way turn by nothing.
eq-turn a b c d e f e f: parallel a b c d, distinct e f

# ── turns add

# If a-b turns to c-d as e-f turns to g-h, then a-b turns to e-f as c-d turns to g-h: both say the
# same four directions differ alike. With the equivalence, this is all of adding turns: a-b to c-d and
# on to e-f is a-b to e-f.
eq-turn a b e f c d g h: eq-turn a b c d e f g h

# ── bridges to angles

# A right angle: its arms turn to each other the same either way round, a quarter turn.
eq-turn b a b c b c b a: right a b c

# All right angles turn alike: each is a quarter turn, and round a half turn a quarter turn either way
# is the same (Euclid's fourth postulate, directed).
eq-turn b a b c e d e f: right a b c, right d e f

# The base of an isosceles triangle: its legs turn to it as it turns back to them, the turns at b
# and c mirror images. (I.5, directed.)
eq-turn b a b c c b c a: eq-lines a b a c

# ── turns in a circle

# Angles in the same segment (III.21), as turns: from any point of a circle, a chord a-b is seen at
# one turn. Directed, there is no "same segment": from the other arc the angle is the supplement, and
# the turn is the same. Euclid proves it from the angle at the centre (III.20), halving the angle there,
# which needs to know which side of the chord the centre lies. With turns that halving is not sound
# (twice a quarter turn and twice no turn are both no turn), and sides cannot be said. So here it is
# taken as an axiom of turns, as the full-angle method takes it: a theorem in Euclid, given here.
# (Its converse, that equal turns put four points on a circle, would need a centre the figure does
# not name.)
eq-turn c a c b d a d b: circle o a b, circle o a c, circle o a d

# ── propositions

# Parallels are turned to alike by any line: corresponding angles, without sides.
? eq-turn a b e f c d e f: parallel a b c d

# Turning back undoes a turn.
? eq-turn c d a b g h e f: eq-turn a b c d e f g h

# Turns add: a-b to c-d and on to e-f is a-b to e-f.
? eq-turn a b e f g h k l: eq-turn a b c d g h i j, eq-turn c d e f i j k l

# The opposite angles of a quadrilateral in a circle (III.22), as turns: seen from b and from d, the
# turn from the side to a to the side to c is the same. Euclid: the angles make two right angles; the
# same, directed.
? eq-turn b a b c d a d c: circle o a b, circle o a c, circle o a d

# The angle in a semicircle is right (III.31): the turn at b to the diameter's ends is its own reverse.
? eq-turn b a b c b c b a: circle o a b, circle o a c, between a o c
