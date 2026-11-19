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

# ══ Constructions ════════════════════════════════════════════════════════════════════════════════

# The parallel to a-b through p (Euclid I.31): copy the angle a-b-p to p, on the far side of b-p from a.
# Then a-b-p and q-p-b are equal alternate angles. Its q is p moved as b is moved from a: the same
# construction translates the segment a-b to p.
parallel-through a b p q:
    copy-angle a b p p b q
    between a m q
    collinear b m p

? parallel b a p q: parallel-through a b p q, triangle a b p
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
