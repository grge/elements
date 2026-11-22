# Chapter 6 — Ratio
#
# Euclid's sixth book, with the theory of proportion of his fifth behind it: a-b is to c-d as e-f is
# to g-h. Equal ratios are an equivalence on pairs of segments, and more: a ratio is a difference of
# lengths' logarithms, as a turn is a difference of lines' directions, and the engine recognises it
# from the rules below as it recognised turns (kb/structure.ts), so ratios are multiplied and divided
# by the same solver. The bridge from direction to ratio is the intercept theorem (VI.2), taken here as
# an axiom, as Euclid's proof of it needs areas compared by his fifth book; and similar triangles are
# said by turns, which, as in a circle, need no sides.

# ══ Axioms ═══════════════════════════════════════════════════════════════════════════════════════

# ── equal ratios: an equivalence on pairs of segments

# a-b is to c-d as e-f is to g-h.
eq-ratio a b c d a b c d: -
eq-ratio e f g h a b c d: eq-ratio a b c d e f g h
eq-ratio a b c d i j k l: eq-ratio a b c d e f g h, eq-ratio e f g h i j k l

# A segment read backwards is the same segment.
eq-ratio b a c d e f g h: eq-ratio a b c d e f g h
eq-ratio a b d c e f g h: eq-ratio a b c d e f g h

# ── equal points may be exchanged

eq-ratio x b c d e f g h: eq-ratio a b c d e f g h, eq-point x a
eq-ratio a x c d e f g h: eq-ratio a b c d e f g h, eq-point x b
eq-ratio a b x d e f g h: eq-ratio a b c d e f g h, eq-point x c
eq-ratio a b c x e f g h: eq-ratio a b c d e f g h, eq-point x d
eq-ratio a b c d x f g h: eq-ratio a b c d e f g h, eq-point x e
eq-ratio a b c d e x g h: eq-ratio a b c d e f g h, eq-point x f
eq-ratio a b c d e f x h: eq-ratio a b c d e f g h, eq-point x g
eq-ratio a b c d e f g x: eq-ratio a b c d e f g h, eq-point x h

# ── ratios of lengths

# Alternando (V.16): if a-b is to c-d as e-f is to g-h, then a-b is to e-f as c-d is to g-h.
eq-ratio a b e f c d g h: eq-ratio a b c d e f g h

# A segment as long as another may stand for it.
eq-ratio i j c d e f g h: eq-ratio a b c d e f g h, eq-lines a b i j

# Equal segments are in the ratio of any segment to itself; and segments in that ratio are equal.
eq-ratio a b c d a b a b: eq-lines a b c d, distinct a b, distinct c d
eq-lines a b c d: eq-ratio a b c d a b a b, distinct a b, distinct c d

# ── ratios of sums, along lines

# Componendo (V.18) and dividendo (V.17), the sums and differences along lines: a-b-c in a row and
# d-e-f in a row, a-b is to b-c as d-e is to e-f exactly when a-c is to b-c as d-f is to e-f. A ratio
# of a sum in general cannot be said (it is no difference of logarithms); along a line, its parts named,
# it can.
eq-ratio a c b c d f e f: between a b c, between d e f, eq-ratio a b b c d e e f
eq-ratio a b b c d e e f: between a b c, between d e f, eq-ratio a c b c d f e f

# ── the intercept theorem

# A line parallel to one side of a triangle cuts the other two in one ratio (VI.2): d on a-b, e on a-c,
# d-e parallel to b-c. Said in four forms, so that no ratio of a sum is needed: the near parts to the
# wholes, the near parts to the far, the far parts to the wholes, and the parallel side to the third
# side as the near parts to the wholes (the triangle cut off is like the whole, VI.4).
eq-ratio a d a b a e a c: triangle a b c, between a d b, between a e c, parallel d e b c
eq-ratio a d d b a e e c: triangle a b c, between a d b, between a e c, parallel d e b c
eq-ratio d b a b e c a c: triangle a b c, between a d b, between a e c, parallel d e b c
eq-ratio d e b c a d a b: triangle a b c, between a d b, between a e c, parallel d e b c

# And its converse: a line cutting two sides in one ratio is parallel to the third.
parallel d e b c: triangle a b c, between a d b, between a e c, eq-ratio a d d b a e e c

# ── similar triangles, by turns

# Two triangles whose turns are equal at two corners have their sides in one ratio; and so a triangle
# and the mirror image of one, its turns reversed. Said by turns, as the circle's angles are, so that
# no side need be said: the triangles may lie anyhow.
eq-ratio a b d e b c e f: eq-turn b a b c e d e f, eq-turn c b c a f e f d, triangle a b c, triangle d e f
eq-ratio b c e f c a f d: eq-turn b a b c e d e f, eq-turn c b c a f e f d, triangle a b c, triangle d e f
eq-ratio a b d e b c e f: eq-turn b a b c e f e d, eq-turn c b c a f d f e, triangle a b c, triangle d e f
eq-ratio b c e f c a f d: eq-turn b a b c e f e d, eq-turn c b c a f d f e, triangle a b c, triangle d e f

# ══ Parallels and midpoints ═════════════════════════════════════════════════════════════════════

# Two lines parallel to the side b-c of a triangle, d-e and then f-g, cutting a-b and a-c.
three-parallels a b c d e f g:
    triangle a b c
    between a d f
    between d f b
    between a e g
    between e g c
    parallel d e b c
    parallel f g b c

# Parallels cut any two lines proportionally: the pieces between them are in one ratio.
? eq-ratio d f f b e g g c: three-parallels a b c d e f g

# The midpoints d and e of two sides of a triangle.
midsegment a b c d e:
    triangle a b c
    midpoint d a b
    midpoint e a c

# The line joining them is parallel to the third side (chapter 3's midline, here by ratios), and half
# as long: d-e is to b-c as a-d to a-b.
? parallel d e b c: midsegment a b c d e
? eq-ratio d e b c a d a b: midsegment a b c d e

# ══ Similar triangles ════════════════════════════════════════════════════════════════════════════

# The medians a-d and b-e of a triangle, crossing at g.
medians a b c d e g:
    triangle a b c
    midpoint d b c
    midpoint e c a
    between a g d
    between b g e

# They cut each other in one ratio, that of the half side to the side: g-d to g-a as c-d to c-b, one to
# two (the triangles g-d-e and g-a-b are alike, their sides parallel).
? eq-ratio g d g a c d c b: medians a b c d e g

# Two chords a-b and c-d of the circle about o, crossing at p.
crossing-chords o a b c d p:
    circle o a b
    circle o a c
    circle o a d
    between a p b
    between c p d

# The parts of one are in the ratio of the parts of the other, reversed (III.35: the rectangles under
# the parts are equal): the triangles p-a-c and p-d-b are alike, by the angles in a circle.
? eq-ratio p a p c p d p b: crossing-chords o a b c d p

# The line a-d halving the angle at a of the triangle a-b-c, meeting b-c at d; and the point its proof
# needs, e, where the parallel to it through c meets b-a continued.
bisector-cut a b c d e:
    triangle a b c
    eq-turn a b a d a d a c
    between b d c
    between b a e
    parallel a d e c

# It cuts b-c in the ratio of the sides (VI.3): a-c-e is isosceles, its base turns mirror images, and
# a-d cuts b-e and b-c alike.
? eq-ratio b d d c a b a c: bisector-cut a b c d e

# ══ The mean proportional ════════════════════════════════════════════════════════════════════════

# The semicircle on a-b about o, a point c on it, and the foot d of the perpendicular from c to a-b.
mean-proportional a b o c d:
    circle o a c
    circle o a b
    between a o b
    between a d b
    right c d a

# c-d is the mean proportional between a-d and d-b (VI.13): a-d is to d-c as d-c is to d-b. Ruler and
# compass take square roots.
? eq-ratio a d d c d c d b: mean-proportional a b o c d
