# Euclidean constructions.
#
# Each predicate here has a single clause, so it is a definition (read as if-and-only-if): a fact
# such as `eq-triangle a b c` is unfolded into its body, both when checking lemmas and when drawing.
# Variables that appear only in a body (the d and g of copy-segment) are the construction's
# auxiliary points. The primitives (collinear, between, eq-lines, eq-point) are in core.geo.

# ------ circle constraint

circle a b c: eq-lines a b a c

# ------ named intersections (convenient in the scratchpad)

circle-circle-intersection o a p b i:
    circle o a i
    circle p b i

line-line-intersection a b c d i:
    collinear a b i
    collinear c d i

circle-line-intersection o a b c i:
    circle o a i
    collinear b c i

# ------ constructions

# I.1 — on the segment a-b, the equilateral triangle a b c.
eq-triangle a b c:
    circle a b c
    circle b a c

# I.2 — from point a, draw a segment a-l equal to the segment b-c.
#
# Build the equilateral triangle d a b on the segment from a to b. Draw the circle about b
# through c; it meets the line d-b, extended beyond b, at g. Draw the circle about d through g;
# it meets the line d-a, extended beyond a, at l. Then a-l = b-g = b-c.
#
# `between` (not mere collinearity) chooses the extension of each line, which is what makes the
# construction work wherever a, b and c happen to lie.
copy-segment a l b c:
    eq-triangle d a b
    circle b c g
    between d b g
    circle d g l
    between d a l

# I.3 — from the segment a-b, cut off a-x equal to the shorter segment c-d.
cut-segment a b x c d:
    copy-segment a l c d
    circle a l x
    between a x b

# Doubling a segment: extend a-b beyond b to c with b-c = a-b.
double a b c:
    circle b a c
    between a b c

# Two equilateral triangles on opposite sides of a-b: the four sides a-c, b-c, a-d, b-d are equal.
vesica a b c d:
    eq-triangle a b c
    eq-triangle a b d

# Marching a compass along a line: five equally spaced points in order.
march a b c d e:
    double a b c
    double b c d
    double c d e
