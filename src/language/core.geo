# Core inference rules — the content of the primitive relations.
#
# Primitives consumed by the geometry pipeline: collinear, between, eq-lines
#
# These are ordinary Horn clauses and they are the whole meaning. The engine recognises some of
# their structure by proving it from them (eq-point is an equivalence with substitution into the
# other primitives, eq-lines is an equivalence on unordered pairs, between and collinear are
# symmetric) and implements that structure with union-find and canonical forms instead of firing
# these rules one by one. See src/kb/structure.ts.

# ------ equality of points

eq-point a a: -
eq-point b a: eq-point a b
eq-point a c: eq-point a b, eq-point b c

# ------ equality of segments: an equivalence on unordered pairs

eq-lines a b b a: -
eq-lines a b e f: eq-lines a b c d, eq-lines c d e f
eq-lines c d a b: eq-lines a b c d
eq-lines a b c d: eq-lines b a c d
eq-lines a b c d: eq-lines a b d c

# ------ zero-length segments

eq-lines a b c c: eq-point a b
eq-point a b: eq-lines a b c c

# ------ symmetries

between c b a: between a b c
collinear b a c: collinear a b c
collinear a b c: collinear c a b

# ------ substitution of equal points

eq-lines x b c d: eq-lines a b c d, eq-point x a
eq-lines a x c d: eq-lines a b c d, eq-point x b
eq-lines a b x d: eq-lines a b c d, eq-point x c
eq-lines a b c x: eq-lines a b c d, eq-point x d
between x b c: between a b c, eq-point x a
between a x c: between a b c, eq-point x b
between a b x: between a b c, eq-point x c
collinear x b c: collinear a b c, eq-point x a
collinear a x c: collinear a b c, eq-point x b
collinear a b x: collinear a b c, eq-point x c

# ------ degenerate configurations

between a a b: -
between a b b: -
collinear a a b: -

# ------ collinear from between

collinear a b c: between a b c
collinear a b c: between b c a
collinear a b c: between c a b

# ------ order on a line

between a b d: between a b c, between a c d
between a c d: between a b d, between b c d

# ------ betweenness and congruence

eq-point b c: between a b c, eq-lines a b a c
eq-point a b: between a b c, eq-lines a c b c

# ------ common notion 2: equals added to equals are equal
# If a-b-c and d-e-f are ordered, ab = de and bc = ef, then ac = df.

eq-lines a c d f: between a b c, between d e f, eq-lines a b d e, eq-lines b c e f

# ------ common notion 3: equals taken from equals
# If d-a-l and d-b-g are both ordered, da = db and dl = dg, then al = bg.

eq-lines a l b g: between d a l, between d b g, eq-lines d a d b, eq-lines d l d g
