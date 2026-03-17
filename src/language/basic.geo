# Basic geometry constructions
# This is a geometric logic language
# The only syntax are horn clauses

# ------ tarski axoims

eq-point a b: eq-lines a b c c
# eq-point a b: between a b a
eq-lines a b b a: -
eq-lines a b e f: eq-lines a b c d, eq-lines c d e f
between c b a: between a b c
between a a b: -
between a b b: -

collinear a b c: collinear b a c
collinear a b c: collinear c a b

eq-lines a c ap cp:
    between a b c
    between ap bp cp
    eq-lines a b ap bp
    eq-lines b c bp cp
    eq-lines a b b c
    eq-lines ap bp bp cp

layoff a b c x:
    between c a x
    eq-lines a x b c

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

# P1
eq-triangle a b c:
    circle a b c
    circle b a c


# P2 from a given point a, draw a line a-b equal to a given line c-d
copy-segment a b c d:
    eq-triangle o a c
    collinear o a e
    collinear o a f
    circle c d x
    circle o x b
  
# P3 from a given line a-b, cut off a segment of a-x with length equal to c-d
cut-segment a b x c d:
    copy-segment a y c d
    circle a y x
    between a x b

