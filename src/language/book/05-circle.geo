# Chapter 5 — The circle
#
# Euclid's third book: chords, tangents, and the angles a circle makes. Its heart is that a chord is
# seen at one angle from every point of the circle (III.21), and Euclid gets there by halving the angle
# at the centre, which needs to know which side of the chord the centre lies on. Here the circle's
# angles are turns (chapter 3), directed, which need no sides; and the circle's lengths come by
# quadrance (chapter 4), which needs no comparing of sizes. So each proposition below is said as Euclid
# says it, in equal lengths and right angles, or as a turn where Euclid's angle would need a side.

# ══ Axioms ═══════════════════════════════════════════════════════════════════════════════════════

# ── four points on one circle

# Four points on one circle: a, b, c and d are cyclic. Said without its centre, since the circles
# a proof finds (two corners and the feet of two altitudes, standing on one side) have none the figure
# names. A circle about a centre makes its points cyclic, in any order.
cyclic a b c d: eq-lines o a o b, eq-lines o a o c, eq-lines o a o d
cyclic b a c d: cyclic a b c d
cyclic a c b d: cyclic a b c d
cyclic a b d c: cyclic a b c d

# Three points not on a line fix a circle: two that share them are one.
cyclic a b d e: cyclic a b c d, cyclic a b c e, triangle a b c

# Angles in the same segment (III.21), as turns: from any point of a circle, a chord a-b is seen at
# one turn. Directed, there is no "same segment": from the other arc the angle is the supplement, and
# the turn is the same. Euclid proves it from the angle at the centre (III.20), halving the angle there,
# which needs to know which side of the chord the centre lies. With turns that halving is not sound
# (twice a quarter turn and twice no turn are both no turn), and sides cannot be said. So here it is
# taken as an axiom of turns, as the full-angle method takes it: a theorem in Euclid, given here.
eq-turn c a c b d a d b: cyclic a b c d, distinct c a, distinct c b, distinct d a, distinct d b

# And its converse (III.21's, which Euclid leaves unsaid until III.22 and the circle through three
# points): where a chord is seen at one turn from two points off its line, the four are on a circle.
cyclic a b c d: eq-turn c a c b d a d b, triangle a b c, triangle a b d

# ══ Chords ═══════════════════════════════════════════════════════════════════════════════════════

# The line from the centre to a chord's midpoint is perpendicular to it (III.1, III.3): the triangles
# o-m-a and o-m-b have their sides equal.
? right a m o: circle o a b, midpoint m a b, distinct o m

# And the perpendicular from the centre bisects the chord (III.3's converse): Pythagoras on both sides
# of its foot, in quadrances, the quarter turn there reaching both ends whichever side of m they lie.
? eq-lines a m m b: circle o a b, collinear a m b, right o m a, distinct o m

# Equal chords stand on equal angles at the centre (III.26 to III.29): side-side-side.
? eq-angle a o b c o d: circle o a b, circle o a c, circle o a d, eq-lines a b c d

# ══ Tangents ═════════════════════════════════════════════════════════════════════════════════════

# The tangent from p (III.17). The circle about o through p; o-p meets the given circle at e; the
# perpendicular to o-p at e meets the big circle at f; o-f meets the given circle at b. Then p-b
# touches the circle at b: the triangles o-e-f and o-b-p are equal (side-angle-side).
tangent-from o e p b f:
    circle o e b
    circle o p f
    between o e p
    right o e f
    between o b f

? right o b p: tangent-from o e p b f

# Two tangents from one point are equal (hypotenuse-leg, by quadrance: Pythagoras twice).
? eq-lines p a p b: circle o a b, right o a p, right o b p

# And the line from that point to the centre halves the angle between them.
? eq-angle a p o b p o: circle o a b, right o a p, right o b p

# A point on the line halving an angle is as far from both its sides (the incircle's centre is such a
# point for all three angles, IV.4): the feet of the perpendiculars from it make triangles with two
# angles and a side equal (angle-angle-side).
? eq-lines i e i f: eq-angle b a i i a c, between a e b, right i e a, between a f c, right i f a, triangle a b c

# ══ Turns in a circle ═══════════════════════════════════════════════════════════════════════════

# Angles in the same segment (III.21), the axiom above said of a circle about a centre.
? eq-turn c a c b d a d b: circle o a b, circle o a c, circle o a d

# The opposite angles of a quadrilateral in a circle (III.22), as turns: seen from b and from d, the
# turn from the side to a to the side to c is the same. Euclid: the angles make two right angles; the
# same, directed.
? eq-turn b a b c d a d c: circle o a b, circle o a c, circle o a d

# The angle in a semicircle is right (III.31): the turn at b to the diameter's ends is its own reverse.
? eq-turn b a b c b c b a: circle o a b, circle o a c, between a o c

# The angle between a tangent and a chord is the angle in the other segment (III.32): the tangent a-t
# turns to the chord a-b as the chord is seen from c. Its proof's point is named: e, the far end of the
# diameter through a, so that a-b-e is the angle in a semicircle.
? eq-turn a t a b c a c b: circle o a b, circle o a c, right o a t, between a o e, circle o a e
