# Core inference rules — used for forward chaining to prove lemmas.
#
# Primitives consumed by the geometry pipeline: collinear, between, eq-lines
#
# Rules here deal with symmetry, transitivity, and basic structural
# geometry facts. Not a commitment to any specific axiomatic system.

# ------ eq-lines

eq-point a b: eq-lines a b c c
eq-lines a b b a: -
eq-lines a b e f: eq-lines a b c d, eq-lines c d e f

# ------ between

between c b a: between a b c
between a a b: -
between a b b: -

# ------ collinear symmetry

collinear a b c: collinear b a c
collinear a b c: collinear c a b

# ------ collinear from between

collinear a b c: between a b c
collinear a b c: between b c a
collinear a b c: between c a b
