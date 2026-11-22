# Beyond the book
#
# The stress test (roadmap, step 2): theorems beyond Euclid's first books, written with the book's
# vocabulary and no help for the engine, to probe the system rather than fill the book. Each page is
# a figure with its theorem beneath. All of them draw; none proves as written. Each page says what
# blocks it (review-notes.md, The stress test). Non-degeneracy no longer does: the checker takes
# different names as different points where it must. Not part of the book: these lemmas are checked on
# their pages but never taken as proven elsewhere.

# ── triangle centres

# The triangle midpoint theorem: the segment joining two sides' midpoints is parallel to the third.
#
# Proves, by chapter 6: the midpoints cut the two sides in one ratio, and the intercept theorem's
# converse makes d-e parallel to b-c. (Chapter 3's midline, without ratio, needs its proof's points
# named; chapter 6's midsegment says it plainly, half as long too.)
midline-plain a b c d e:
    triangle a b c
    midpoint d a b
    midpoint e a c

? parallel d e b c: midline-plain a b c d e

# The medians meet in one point: those from a and b meet at g, and the third passes through it.
#
# Blocked by the midline, and by points no hypothesis names.
centroid a b c d e f g:
    triangle a b c
    midpoint d b c
    midpoint e c a
    midpoint f a b
    between a g d
    between b g e

? collinear c g f: centroid a b c d e f g

# The circumcentre is on each side's perpendicular bisector: the line from it to a side's midpoint is
# perpendicular to that side.
#
# Blocked by sides: the circumcentre is on the line through each vesica's two points, and which side
# of them it lies on decides the angle there. With the construction written out and o between the
# vesica's points, it proves at once.
circumcentre-bisector a b c o m:
    circumcentre a b c o
    midpoint m a c
    distinct m o

? right a m o: circumcentre-bisector a b c o m

# As turns: still blocked. The quarter turn at m comes from congruent triangles o-m-a and o-m-c and the
# sides of the circumcentre's construction, which turns do not touch.
? eq-turn m a m o m o m a: circumcentre-bisector a b c o m

# The altitudes meet in one point: those from a and b meet at h, and the line from c through h, meeting
# a-b at f, is perpendicular to it.
#
# Blocked by points no hypothesis names (the textbook proof draws the triangle through the corners
# parallel to the opposite sides), or by angles in a circle (chapter 5).
orthocentre a b c d e h:
    triangle a b c
    collinear b c d
    right a d b
    collinear c a e
    right b e c
    collinear a d h
    collinear b e h

altitudes a b c d e h f:
    orthocentre a b c d e h
    collinear c h f
    collinear a b f
    distinct c f
    distinct a f

? right c f a: altitudes a b c d e h f

# As turns: c-f turns to f-a as f-a turns back, a quarter turn. Proves: a-b-d-e and c-d-h-e are cyclic,
# their right angles standing on a-b and c-h, and turns are chased round them; rules see turns the
# solver finds. (It once seemed to prove through a fault since fixed: a degenerate right angle became
# a turn equal to every turn, and false claims proved too.)
? eq-turn f c f a f a f c: altitudes a b c d e h f

# Euler's line: the circumcentre o, the centroid g and the orthocentre h are collinear.
#
# Blocked by ratios (g cuts o-h in two to one), which need sums; and the search runs out of budget.
euler-line a b c o g h:
    centroid a b c d e f g
    circumcentre a b c o
    orthocentre a b c p q h

? collinear o g h: euler-line a b c o g h

# The nine-point circle: the foot k of the altitude from a is on the circle through the sides'
# midpoints d, e and f.
#
# Blocked by Thales' converse (the midpoint of a hypotenuse is as far from all three corners), which
# needs Apollonius' median law, a quadrance candidate.
nine-point a b c d e f n k:
    triangle a b c
    midpoint d b c
    midpoint e c a
    midpoint f a b
    circle n d e
    circle n d f
    collinear b c k
    right a k b

? circle n d k: nine-point a b c d e f n k

# As turns: k sees d-e at the turn f does, which is to be on the circle through d, e and f. Not proved:
# its proof needs the midpoint of a right triangle's hypotenuse equally far from all three corners
# (Thales' converse), which needs Apollonius' median law (a quadrance candidate). (It once seemed to
# prove through the fault noted at the altitudes.)
? eq-turn k d k e f d f e: nine-point a b c d e f n k

# ── circles

# Thales: the angle in a semicircle is right.
#
# Blocked by the angle sum (I.32): the angle at b is the sum of the base angles of two isosceles
# triangles, o-a-b and o-b-c. Sums.
thales a b c o:
    circle o a b
    circle o a c
    between a o c
    distinct b a
    distinct b c

? right a b c: thales a b c o

# The same, as turns (chapter 3): the arms at b turn to each other alike either way round. Proves: the
# base turns of the isosceles triangles o-a-b and o-b-c, the diameter one line, added by the solver for
# turns (structure.ts, differences), which sees directions no line of the figure has.
? eq-turn b a b c b c b a: thales a b c o

# Thales' converse: the midpoint of the hypotenuse is as far from the right angle as from its ends.
#
# Blocked by a point no hypothesis names (the rectangle's fourth corner), or by sums.
thales-converse a b c o:
    right a b c
    midpoint o a c

? eq-lines o a o b: thales-converse a b c o

# Written out (engine.md, *Writing a proof*), it proves: continue b-o past o by its own length, to d,
# and a-b-c-d is a rectangle. Two pairs of triangles are congruent by side-angle-side, about the
# vertical angles at o; then the rectangle's diagonals are equal, and o halves both.
? eq-lines o a o b:
    thales-converse a b c o
    ? double b o d
    ? eq-angle a o d c o b
    ? eq-lines a d c b
    ? eq-angle a o b c o d
    ? eq-lines a b c d
    ? eq-lines b d a c

# The perpendicular from the centre to a chord bisects it.
#
# Proves, without angle-angle-side: Pythagoras in quadrances on both sides of the foot, reached from
# the quarter turn there, which knows no sides (chapters 2 and 4).
chord-bisector o a b m:
    circle o a b
    collinear a m b
    right o m a
    distinct o m

? eq-lines a m m b: chord-bisector o a b m

# Tangents from a point to a circle are equal: now in the book (chapter 5, tangents), by quadrance.

# The Simson line: the feet of the perpendiculars from a point p on the circumcircle to the sides are
# collinear.
#
# Proves, as stated below: through turns and the circles its right angles stand on (chapter 3).
simson a b c o p d e f:
    circle o a b
    circle o a c
    circle o a p
    triangle a b c
    collinear b c d
    right p d b
    collinear c a e
    right p e c
    collinear a b f
    right p f a

? collinear d e f: simson a b c o p d e f
# Proves (42 s): the turn form below gives d-e and d-f turning by nothing, and the solver hands equal
# directions back as parallels (chapter 3), so one line.

# As turns: d-e and d-f turn by nothing, one line. Proves: p-b-d-f and p-c-d-e are cyclic by their
# right angles, p being off b-c and a-b (a line meets the circumcircle at most twice, chapter 2), and
# turns are chased round them and the circumcircle. (It once seemed to prove through the fault noted at
# the altitudes.)
? eq-turn d e d f d e d e: simson a b c o p d e f

# ── quadrilaterals

# Varignon: the midpoints of a quadrilateral's sides make a parallelogram.
#
# Proves, by chapter 6's midline: both sides are parallel to the diagonal a-c, so to each other.
varignon a b c d p q r s:
    triangle a b c
    triangle a c d
    midpoint p a b
    midpoint q b c
    midpoint r c d
    midpoint s d a

? parallel p q s r: varignon a b c d p q r s

# An isosceles trapezoid's diagonals are equal. False as written, and rightly: equal legs between
# parallels also describe a parallelogram, whose diagonals need not be equal. That it is not a
# parallelogram cannot be said: a case.
isosceles-trapezoid a b c d:
    parallel a b c d
    eq-lines a d b c
    triangle a b c
    triangle a b d

? eq-lines a c b d: isosceles-trapezoid a b c d

# ── what cannot be said
#
# Ceva: lines from the corners through a common point cut the sides in ratios whose product is one. A
# ratio cannot be said.
#
# Hyperbolic geometry: a triangle's angles sum to less than two right angles, and through a point off
# a line pass many lines that do not meet it. Neither can be said: sums cannot be written, and the
# figure layer is the Euclidean plane, whose figures refute the second.

# ── chapter 5's debts

# Equal chords are equally far from the centre (III.14), their halves given equal: Pythagoras in
# quadrances. Proves, but has no figure: building a chord with a given midpoint needs a fact the
# hypotheses imply and do not state (that midpoint is the foot of the perpendicular from the centre),
# and the planner plans from stated facts only. Euclid's own form, the distances measured along the
# perpendiculars, would draw, but its proof halves the equal chords: the quarter, a candidate.
equal-chord-halves o a b c d m n:
    circle o a b
    circle o a c
    circle o a d
    eq-lines a m c n
    midpoint m a b
    midpoint n c d

? eq-lines o m o n: equal-chord-halves o a b c d m n

# ── chapter 7's debts

# The golden triangle (IV.10): the isosceles triangle a-b-d, a-b = a-d, its base b-d equal to the
# golden part a-c of a-b; its base angles are twice its apex, the pentagon's triangle (IV.11). Euclid:
# a-b·b-c = b-d², so b-d touches the circle through a, c, d (III.37, the converse of III.36), and the
# angles follow. Not proved: III.37 is not in the book, and the search runs past its budget.
golden-triangle a b c d m p e f:
    golden-section a b c m p e f
    circle a b d
    eq-lines b d a c

? eq-lines c d c a: golden-triangle a b c d m p e f

