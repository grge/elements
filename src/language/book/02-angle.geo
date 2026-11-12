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

# All right angles are equal (Euclid's fourth postulate).
eq-angle a b c d e f: right a b c, right d e f

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
