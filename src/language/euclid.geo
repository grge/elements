# Euclidean constructions — expanded via backward chaining to primitives.
#
# Primitives: collinear, between, eq-lines
# The circle predicate is defined here in terms of eq-lines.

# ------ circle constraint

circle a b c: eq-lines a b a c

# ------ intersection constructions
# Note: these may be removed once the planner/solver no longer need them
# as named predicates; currently kept for KB browsing and scratchpad use.

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

# P1 — equilateral triangle
eq-triangle a b c:
    circle a b c
    circle b a c

# P2 — from point a, draw line a-b equal to line c-d
copy-segment a b c d:
    eq-triangle o a c
    collinear o a e
    collinear o a f
    circle c d x
    circle o x b

# P3 — from line a-b, cut off segment a-x with length equal to c-d
cut-segment a b x c d:
    copy-segment a y c d
    circle a y x
    between a x b
