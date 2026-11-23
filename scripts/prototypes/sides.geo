# Sides of a line: the first build (November 2026; docs/foundations.md, *Sides: the first build*).
#
# System E's same-side, Pasch and inside axioms, said with points, as tried in chapter 2 after the
# triangle section, with a relation entry for each word (relations.ts: holds is the sign of each
# point's distance from the line; read only keeps a and b apart). Not in the book: as plain rules
# they cost too much. Kept to be measured again once the engine has lines as classes and sides as
# signed classes per line.

# ── sides of a line

# p and q are on the same side of the line a-b; p and q are on opposite sides of it. Either says that a
# and b are two points and p and q are off their line. (Avigad, Dean and Mumma's System E, said with
# points: a line is two of its points. docs/foundations.md.)
same-side q p a b: same-side p q a b
same-side p q b a: same-side p q a b
opposite q p a b: opposite p q a b
opposite p q b a: opposite p q a b
triangle a b p: same-side p q a b
triangle a b p: opposite p q a b

# Any two points of the line name it.
same-side p q a c: same-side p q a b, collinear a b c, distinct a c
opposite p q a c: opposite p q a b, collinear a b c, distinct a c

# Equal points may be exchanged.
same-side x q a b: same-side p q a b, eq-point x p
same-side p q x b: same-side p q a b, eq-point x a
opposite x q a b: opposite p q a b, eq-point x p
opposite p q x b: opposite p q a b, eq-point x a

# A line has two sides. Points off it on the same side are an equivalence; opposite crosses from one
# side to the other, and twice across is back. Nothing is on both.
same-side p p a b: triangle a b p
same-side p r a b: same-side p q a b, same-side q r a b
opposite p r a b: same-side p q a b, opposite q r a b
same-side p r a b: opposite p q a b, opposite q r a b
false: same-side p q a b, opposite p q a b

# Pasch's axiom, in the pieces System E breaks it into.
# A segment with both ends on one side stays on that side.
same-side p x a b: between p x q, same-side p q a b
# A segment from a point of the line to a point off it is on one side of the line.
same-side x q a b: between p x q, collinear a b p, triangle a b x
# A segment crossing the line joins opposite sides.
opposite p q a b: between p x q, collinear a b x, triangle a b p
# Where the segment joining opposite sides meets the line, it crosses it.
between p x q: opposite p q a b, collinear a b x, collinear p x q
# And, read the other way round: a segment with one part across the line is across it as a whole.
opposite p q a b: between p x q, opposite p x a b

# x is inside the angle a-b-c: on a's side of b-c and on c's side of b-a.
inside x a b c:
    same-side x a b c
    same-side x c b a
