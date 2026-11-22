# Chapter 7 — Regular figures
#
# Euclid's fourth book: figures inscribed in a circle and about it, and the ruler-and-compass arithmetic
# of his sixth that the pentagon needs. The square and the hexagon's triangle come from the circle's
# chords (chapter 5); dividing a segment and the fourth proportional from the intercept theorem
# (chapter 6); the golden section from a tangent and its secant. The pentagon itself (IV.10 to IV.11)
# and the fifteen-gon (IV.16) are not here yet: the golden triangle's proof needs III.37, that a line
# whose square is the rectangle of a secant's parts is a tangent, and runs past its budget (Beyond the
# book, chapter 7's debts).

# ══ In a circle ══════════════════════════════════════════════════════════════════════════════════

# The square in a circle (IV.6): two diameters at right angles, a-c and b-d, their ends the corners.
inscribed-square o a b c d:
    circle o a b
    circle o a c
    circle o a d
    between a o c
    between b o d
    right a o b

# Its sides are equal (the four triangles at the centre are equal), and its angles right (each is the
# angle in a semicircle, as turns).
? eq-lines a b b c: inscribed-square o a b c d
? eq-turn b a b c b c b a: inscribed-square o a b c d

# The triangle in a circle (IV.2, the equilateral case): every other corner of the hexagon (chapter 1).
inscribed-triangle o a b c d e f:
    hexagon o a b c d e f

# Its sides are equal: each stands on two of the hexagon's equal triangles at the centre.
? eq-lines a c c e: inscribed-triangle o a b c d e f

# ══ The arithmetic of ruler and compass ════════════════════════════════════════════════════════

# A segment a-b cut in three (VI.9): from a, three equal steps a-x, x-y, y-z along another line, then
# parallels to z-b through x and y.
trisect a b x y z d e:
    triangle a b z
    between a x y
    between x y z
    eq-lines a x x y
    eq-lines x y y z
    between a d e
    between d e b
    parallel x d z b
    parallel y e z b

# The three parts are equal: the parallels cut a-b as they cut a-z.
? eq-lines a d d e: trisect a b x y z d e
? eq-lines d e e b: trisect a b x y z d e

# The fourth proportional (VI.12): on two lines from a, b then c on one and d on the other; the
# parallel to b-d through c meets the second at e. Multiplication and division by ruler and compass.
fourth-proportional a b c d e:
    triangle a b d
    between a b c
    between a d e
    parallel b d c e

# d-e is the fourth proportional: a-b is to b-c as a-d is to d-e.
? eq-ratio a b b c a d d e: fourth-proportional a b c d e

# The golden section (II.11, VI.30): a-b cut at c so that the whole is to the greater part as the
# greater to the less. At b the perpendicular b-d, half of a-b (m its midpoint); the circle about d
# through b meets a-d at e and, beyond d, at f; the circle about a through e cuts a-b at c.
golden-section a b c m d e f:
    right a b d
    midpoint m a b
    eq-lines b d b m
    between a e d
    eq-lines d e d b
    between e d f
    eq-lines d f d b
    between a c b
    eq-lines a c a e

# a-b touches the circle at b, so its square is the rectangle of a-e and a-f (III.36: crossing chords'
# limit, a tangent and a secant); and a-f is a-c and a-b together.
? eq-ratio a b a e a f a b: golden-section a b c m d e f

# So a-b is to a-c as a-c is to c-b: extreme and mean ratio (by dividendo).
? eq-ratio a b a c a c c b: golden-section a b c m d e f
