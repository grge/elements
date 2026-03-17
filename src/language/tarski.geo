# Tarski axioms

eq-point a b: eq-lines a b c c
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
