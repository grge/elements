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
