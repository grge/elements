# Angles and spreads, as an engine test (not book content). Chapter 1's rules come with it.

# ── equal angles: an equivalence on angle triples, the vertex in the middle

# Angle a-b-c equals angle d-e-f.
eq-angle a b c a b c: -
eq-angle d e f a b c: eq-angle a b c d e f
eq-angle a b c g h i: eq-angle a b c d e f, eq-angle d e f g h i
# The same angle read backwards.
eq-angle a b c c b a: -
eq-angle c b a d e f: eq-angle a b c d e f

eq-angle x b c d e f: eq-angle a b c d e f, eq-point x a
eq-angle a x c d e f: eq-angle a b c d e f, eq-point x b
eq-angle a b x d e f: eq-angle a b c d e f, eq-point x c
eq-angle a b c x e f: eq-angle a b c d e f, eq-point x d
eq-angle a b c d x f: eq-angle a b c d e f, eq-point x e
eq-angle a b c d e x: eq-angle a b c d e f, eq-point x f

# An angle is unchanged when a point moves along its arm, away from the vertex.
eq-angle a b c x b c: between b x a, distinct b x
eq-angle a b c x b c: between b a x, distinct b a

# Side-angle-side (an axiom, as in Hilbert): the third sides and the other angles are equal.
eq-lines a c d f: eq-lines b a e d, eq-lines b c e f, eq-angle a b c d e f
eq-angle b a c e d f: eq-lines b a e d, eq-lines b c e f, eq-angle a b c d e f

# ── equal spreads: an equivalence on pairs of lines, each line a pair of points

# The spread between lines a-b and c-d equals that between e-f and g-h.
eq-spread a b c d a b c d: -
eq-spread e f g h a b c d: eq-spread a b c d e f g h
eq-spread a b c d i j k l: eq-spread a b c d e f g h, eq-spread e f g h i j k l
eq-spread b a c d e f g h: eq-spread a b c d e f g h
eq-spread a b d c e f g h: eq-spread a b c d e f g h
eq-spread c d a b e f g h: eq-spread a b c d e f g h

eq-spread x b c d e f g h: eq-spread a b c d e f g h, eq-point x a
eq-spread a x c d e f g h: eq-spread a b c d e f g h, eq-point x b
eq-spread a b x d e f g h: eq-spread a b c d e f g h, eq-point x c
eq-spread a b c x e f g h: eq-spread a b c d e f g h, eq-point x d
eq-spread a b c d x f g h: eq-spread a b c d e f g h, eq-point x e
eq-spread a b c d e x g h: eq-spread a b c d e f g h, eq-point x f
eq-spread a b c d e f x h: eq-spread a b c d e f g h, eq-point x g
eq-spread a b c d e f g x: eq-spread a b c d e f g h, eq-point x h

# A line is the same line through any two distinct points of it.
eq-spread a x c d a b c d: collinear a b x, distinct a x

# ── the bridge: equal angles make equal spreads (not conversely: a spread does not tell an angle
# from its supplement)
eq-spread b a b c e d e f: eq-angle a b c d e f

# ── lemmas

# The isosceles triangle (Euclid I.5), by Pappus: compare a-b-c with itself read as a-c-b.
? eq-angle a b c a c b: eq-lines a b a c
? eq-spread b a b c c a c b: eq-lines a b a c
# Symmetries.
? eq-angle c b a f e d: eq-angle a b c d e f
? eq-spread c d a b g h e f: eq-spread a b c d e f g h
# Arms.
? eq-angle x b c a b c: between b x a, distinct b x
? eq-spread b x b c b a b c: between b x a, distinct b x
# Equilateral triangles have equal angles.
? eq-angle a b c b c a: eq-triangle a b c
? eq-spread b a b c c b c a: eq-triangle a b c
# Not provable: a spread does not give back the angle.
? eq-angle a b c d e f: eq-spread b a b c e d e f
