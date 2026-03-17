# Euclidean geometry — constraint layer and constructions

# ------ constraint layer

circle a b c: eq-lines a b a c
collinear a b c: between a b c
collinear a b c: between b c a
collinear a b c: between c a b

# ------ 0-dof constraints

circle-circle-intersection o a p b i:
    circle o a i
    circle p b i

line-line-intersection a b c d i:
    collinear a b i
    collinear c d i

circle-line-intersection o a b c i:
    circle o a i
    collinear b c i

# ------ Constructions / Postulates

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
