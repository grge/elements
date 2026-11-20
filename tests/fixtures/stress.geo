# Stress test (roadmap, Next, step 2): theorems beyond Euclid's first books, written as a user would
# write them with the book's vocabulary, with no help for the engine. Not part of the book. Each is
# sorted by scripts/stress.ts: draws (by construction, or only by solving) and proves now; needs sums;
# needs cases; needs points the hypotheses do not name; cannot be said. The tally is in review-notes.md.

# ── triangle centres

# The triangle midpoint theorem (the midline): the segment joining two sides' midpoints is parallel to
# the third. Chapter 3 states it but has not proven it.
? parallel d e b c: triangle a b c, midpoint d a b, midpoint e a c

# The medians meet in one point: two meet at g, and the third passes through it.
centroid a b c d e f g:
    triangle a b c
    midpoint d b c
    midpoint e c a
    midpoint f a b
    between a g d
    between b g e

? collinear c g f: centroid a b c d e f g

# The circumcentre is on each side's perpendicular bisector.
? right a m o: circumcentre a b c o, midpoint m a c, distinct m o

# The altitudes meet in one point: those from a and b meet at h, and the line from c through h is
# perpendicular to a-b.
orthocentre a b c d e h:
    triangle a b c
    collinear b c d
    right a d b
    collinear c a e
    right b e c
    collinear a d h
    collinear b e h

? right c f a: orthocentre a b c d e h, collinear c h f, collinear a b f, distinct c f, distinct a f

# Euler's line: the circumcentre, centroid and orthocentre are collinear.
? collinear o g h: centroid a b c d e f g, circumcentre a b c o, orthocentre a b c p q h

# The nine-point circle: the foot of an altitude is on the circle through the sides' midpoints.
? circle n d k: triangle a b c, midpoint d b c, midpoint e c a, midpoint f a b, circle n d e, circle n d f, collinear b c k, right a k b

# ── circles

# Thales: the angle in a semicircle is right.
? right a b c: circle o a b, circle o a c, between a o c, distinct b a, distinct b c

# Its converse: the midpoint of the hypotenuse is as far from the right angle as from its ends.
? eq-lines o a o b: right a b c, midpoint o a c

# The perpendicular from the centre to a chord bisects it.
? eq-lines a m m b: circle o a b, collinear a m b, right o m a, distinct o m

# Tangents from a point to a circle are equal.
? eq-lines p t p s: circle o t s, right o t p, right o s p, distinct t s

# The Simson line: the feet of the perpendiculars from a point on the circumcircle to the sides are
# collinear.
? collinear d e f: circle o a b, circle o a c, circle o a p, triangle a b c, collinear b c d, right p d b, collinear c a e, right p e c, collinear a b f, right p f a

# ── quadrilaterals

# Varignon: the midpoints of a quadrilateral's sides make a parallelogram.
? parallel p q s r: triangle a b c, triangle a c d, midpoint p a b, midpoint q b c, midpoint r c d, midpoint s d a

# An isosceles trapezoid's diagonals are equal. Equal legs between parallels also describe a
# parallelogram, whose diagonals need not be equal: which of the two is meant is a case.
? eq-lines a c b d: parallel a b c d, eq-lines a d b c, triangle a b c, triangle a b d

# ── beyond the plane's ruler and compass

# Ceva: lines from the corners through a common point cut the sides in ratios whose product is one.
# A ratio cannot be said in the language, so it is not written.

# Hyperbolic geometry: a triangle's angles sum to less than two right angles, and through a point off
# a line pass many lines that do not meet it. Neither can be said: sums cannot be written, and the
# figure layer is the Euclidean plane, whose figures refute the second.
