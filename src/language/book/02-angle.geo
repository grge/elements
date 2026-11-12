# Chapter 2 — Angle
#
# When are two angles the same? An angle is a vertex and two arms, and an angle stays the same however
# far along its arms we look. With side-angle-side, the first criterion for triangles being the same,
# come the isosceles triangle, vertical angles and right angles; then the constructions Euclid builds
# on them. No parallels yet: everything here holds in hyperbolic geometry too.
#
# The engine has equalities but no sums, so angles that together make a straight line are related
# directly (supplements), never added.

# ══ Axioms ═══════════════════════════════════════════════════════════════════════════════════════

# ── equal angles: an equivalence on angle triples, the vertex in the middle

# Angle a-b-c equals angle d-e-f.
eq-angle a b c a b c: -
eq-angle d e f a b c: eq-angle a b c d e f
eq-angle a b c g h i: eq-angle a b c d e f, eq-angle d e f g h i

# The same angle read backwards.
eq-angle a b c c b a: -
eq-angle c b a d e f: eq-angle a b c d e f

# ── equal points may be exchanged

eq-angle x b c d e f: eq-angle a b c d e f, eq-point x a
eq-angle a x c d e f: eq-angle a b c d e f, eq-point x b
eq-angle a b x d e f: eq-angle a b c d e f, eq-point x c
eq-angle a b c x e f: eq-angle a b c d e f, eq-point x d
eq-angle a b c d x f: eq-angle a b c d e f, eq-point x e
eq-angle a b c d e x: eq-angle a b c d e f, eq-point x f

# ── arms

# An angle is the same wherever its point is taken along an arm: x on the arm from b through a, short
# of a or beyond it.
eq-angle a b c x b c: between b x a, distinct b x
eq-angle a b c x b c: between b a x, distinct b a

# ── triangles

# a, b and c are the corners of a triangle: three points not on one line. Like distinct, it is said
# positively, and its meaning is what it rules out.
triangle b a c: triangle a b c
triangle a c b: triangle a b c
triangle x b c: triangle a b c, eq-point x a
false: triangle a b c, collinear a b c
distinct a b: triangle a b c

# Side-angle-side (Euclid I.4, an axiom here as in Hilbert): two sides and the angle between them
# equal, then the third sides are equal, and so are the angles at a and d.
eq-lines a c d f: eq-lines b a e d, eq-lines b c e f, eq-angle a b c d e f
eq-angle b a c e d f: eq-lines b a e d, eq-lines b c e f, eq-angle a b c d e f

# Side-side-side (Euclid I.8) and angle-side-angle (I.26). Axioms for now: their proofs argue about
# which side of a line a point lies on, which the engine cannot do yet. Angle-side-angle needs a true
# triangle: three points on a line have angles of nothing or a straight line, which fix no lengths.
eq-angle a b c d e f: eq-lines b a e d, eq-lines b c e f, eq-lines a c d f
eq-lines b a e d: eq-angle a b c d e f, eq-angle b c a e f d, eq-lines b c e f, triangle a b c

# ── supplements: two angles that together make a straight line, related without adding them

# Angles a-b-c and d-e-f are supplements.
supp d e f a b c: supp a b c d e f
supp c b a d e f: supp a b c d e f
supp a b c g h i: supp a b c d e f, eq-angle d e f g h i

# On a line: with b between a and d, angles a-b-c and c-b-d make the line.
supp a b c c b d: between a b d, distinct a b, distinct b d

# Angles with a common supplement are equal.
eq-angle d e f g h i: supp a b c d e f, supp a b c g h i

# ── right angles

# A right angle: one equal to its own supplement.
right a b c:
    between a b d
    distinct a b
    distinct b d
    eq-angle a b c c b d

# All right angles are equal (Euclid's fourth postulate), said of angles each equal to its own
# supplement, so that right stays a definition (a clause for eq-angle that mentioned right would make
# right depend on itself).
eq-angle a b c d e f:
    between a b g
    distinct a b
    distinct b g
    eq-angle a b c c b g
    between d e h
    distinct d e
    distinct e h
    eq-angle d e f f e h

# ══ Triangles ════════════════════════════════════════════════════════════════════════════════════

# The isosceles triangle (Euclid I.5): the angles at the base are equal. Pappus's proof: compare a-b-c
# with itself read as a-c-b; two sides and the angle between them agree, so the angles do.
? eq-angle a b c a c b: eq-lines a b a c

# And the converse (I.6), by angle-side-angle on the same pair.
? eq-lines a b a c: eq-angle a b c a c b, triangle a b c

# An equilateral triangle's three angles are equal.
? eq-angle a b c b c a: eq-triangle a b c
? eq-angle b c a c a b: eq-triangle a b c

# Vertical angles are equal (I.15): where lines a-b and c-d cross at e, angles a-e-c and b-e-d share the
# supplement c-e-b.
? eq-angle a e c b e d:
    between a e b
    between c e d
    distinct a e
    distinct e b
    distinct c e
    distinct e d

# ══ Constructions ════════════════════════════════════════════════════════════════════════════════
#
# Each is drawn with circles alone; each is proved by the triangle criteria above.

# Bisecting the angle a-b-c (Euclid I.9), with a nearer b than c is: e on b-c as far from b as a is,
# then the equilateral triangle on a-e; its apex d is on the bisector.
bisect-angle a b c d:
    circle b a e
    between b e c
    eq-triangle a e d

# Triangles a-b-d and e-b-d have three equal sides, and e is on the arm b-c.
? eq-angle a b d d b c: bisect-angle a b c d, distinct a b

# Bisecting the segment a-b (I.10): the second diagonal of the rhombus on a-b cuts it at m.
bisect a b m:
    vesica a b c d
    between c m d
    between a m b
    distinct c m

# This is chapter 1's midpoint, now constructed: the rhombus's halves have equal angles at c (three
# equal sides), so the triangles a-c-m and b-c-m have two sides and the angle between them equal.
? midpoint m a b: bisect a b m

# The perpendicular at c to the line a-c (I.11): double a-c to e, then the equilateral triangle on a-e.
perpendicular a c d:
    double a c e
    eq-triangle a e d

? right a c d: perpendicular a c d, distinct a c

# The perpendicular from p to a line (I.12): a circle about p cuts the line at e and f; bisect e-f at m.
# Then p-m makes equal angles with the line on either side.
drop-perpendicular p e f m:
    circle p e f
    distinct e f
    bisect e f m

? eq-angle e m p p m f: drop-perpendicular p e f m

# Copying the angle a-b-c to the point e (I.23): g as far from e as c is from b, d as far from e as a is
# from b and from g as a is from c. A triangle from three lengths (I.22), and so the same angle.
copy-angle a b c e g d:
    eq-lines e g b c
    eq-lines e d b a
    eq-lines g d c a

? eq-angle a b c d e g: copy-angle a b c e g d

# ══ Chapter 1's debts ════════════════════════════════════════════════════════════════════════════

# Reflection keeps a figure the same: the reflection q of p in the line a-b makes the same angles there.
? eq-angle p a b q a b: reflect a b p q
? eq-angle a p b a q b: reflect a b p q

# Every point of the second diagonal c-d of the rhombus on a-b, the perpendicular bisector of a-b, is as
# far from a as from b. Between c and d:
? eq-lines x a x b: vesica a b c d, between c x d, distinct c x
# and beyond d (beyond c is the same, with c and d exchanged):
? eq-lines x a x b: vesica a b c d, between c d x, distinct c d
#
# Together they cover the whole line, but joining cases is a step the engine cannot take yet; so the
# circumcentre of chapter 1, where two such lines meet, is still drawn rather than proved.
