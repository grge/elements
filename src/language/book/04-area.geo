# Chapter 4 — Area
#
# When do two figures take up the same room? Euclid never measures an area. He cuts figures into
# pieces and puts the pieces together again, and figures are equal when that can be done. Here the
# pieces are triangles: two have the same area when they are congruent, when they stand on one base
# between the same parallels, or when a median cuts them from one triangle; and triangles cut into
# equal pieces are equal. A parallelogram is compared by its halves, the triangles a diagonal cuts it
# into. A sum is shown as a figure cut into its parts, never added up.
#
# Everything here leans on the parallel postulate, through the parallels the shear slides along: this
# is Euclid's plane, not the hyperbolic one.

# ══ Axioms ═══════════════════════════════════════════════════════════════════════════════════════

# ── equal area: an equivalence on triangles, whatever the order of their corners

# Triangle a-b-c has the same area as triangle d-e-f.
eq-area a b c a b c: -
eq-area d e f a b c: eq-area a b c d e f
eq-area a b c g h i: eq-area a b c d e f, eq-area d e f g h i

# The same triangle, its corners taken in another order.
eq-area b a c d e f: eq-area a b c d e f
eq-area b c a d e f: eq-area a b c d e f

# ── equal points may be exchanged

eq-area x b c d e f: eq-area a b c d e f, eq-point x a
eq-area a x c d e f: eq-area a b c d e f, eq-point x b
eq-area a b x d e f: eq-area a b c d e f, eq-point x c
eq-area a b c x e f: eq-area a b c d e f, eq-point x d
eq-area a b c d x f: eq-area a b c d e f, eq-point x e
eq-area a b c d e x: eq-area a b c d e f, eq-point x f

# A triangle with the area of a true triangle is a true triangle: its area is not nothing.
triangle d e f: triangle a b c, eq-area a b c d e f

# ── what has the same area

# Congruent triangles (Euclid's common notion 4: things that coincide are equal): two sides and the
# angle between them equal, which side-side-side and angle-side-angle (chapter 2) also give.
eq-area a b c d e f:
    eq-angle a b c d e f
    eq-lines b a e d
    eq-lines b c e f

# Triangles on one base between the same parallels (I.37): a-b-c and a-b-d, with c-d parallel to a-b.
eq-area a b c a b d: parallel a b c d

# A median halves a triangle (I.38, for bases side by side): with b the midpoint of a-d, the halves
# c-a-b and c-b-d of the triangle c-a-d have equal bases under one apex.
eq-area c a b c b d: between a b d, eq-lines a b b d

# Euclid proves these two from parallelograms (I.35, I.36), by cutting and pasting pieces that depend on
# where the apexes fall: a split into cases the engine cannot make. So they are axioms here. Equal bases
# apart on one line (the rest of I.38) would need a third triangle, translated from one to the other,
# which the engine cannot make either.

# ── cutting a triangle from a corner

# Common notions 2 and 3, for areas: a point e between b and c cuts the triangle a-b-c into a-b-e and
# a-e-c. Triangles cut into equal pieces are equal; from equal triangles, equal pieces taken away leave
# equal pieces. The cut point apart from the ends, and a true triangle, are said for the engine's sake:
# without them these two rules make the book's checks six times slower (November 2026), though they
# derive nothing false.
eq-area a b c x y z:
    between b e c
    distinct b e
    distinct e c
    triangle a b c
    eq-area a b e x y w
    eq-area a e c x w z
    between y w z
eq-area a e c x w z:
    between b e c
    distinct b e
    distinct e c
    triangle a b c
    eq-area a b e x y w
    eq-area a b c x y z
    between y w z

# ══ Parallelograms and triangles ═════════════════════════════════════════════════════════════════

# A diagonal cuts a parallelogram into two equal triangles (I.34): their sides are equal.
? eq-area a b c c d a: parallelogram a b c d

# The other diagonal's halves are the same size: a-b-c and a-b-d stand on a-b between the parallels a-b
# and d-c. So all four halves are equal.
? eq-area a b c a b d: parallelogram a b c d

# Parallelograms on one base between the same parallels are equal (I.35): a-b-c-d and e-b-c-f on b-c,
# with a, d, e and f on one line. Their halves on b-c stand between the same parallels.
? eq-area b c d b c f: parallelogram a b c d, parallelogram e b c f, collinear a d e, distinct a e

# A parallelogram is double a triangle on its base between the same parallels (I.41): e-b-c, with e on
# the line a-d, is half of a-b-c-d.
? eq-area a b c e b c: parallelogram a b c d, collinear a d e, distinct a e

# The two halves a median cuts a triangle into: a-b-m and a-m-c, with m halving b-c.
? eq-area a b m a m c: midpoint m b c, triangle a b c

# The complements (I.43): through a point k on the diagonal a-c of a parallelogram a-b-c-d, the
# parallels to its sides cut it into two parallelograms about the diagonal and two complements,
# e-b-f-k and h-k-g-d. The line e-k-g runs the way a-d does, from a-b to d-c, and h-k-f the way a-b
# does, from a-d to b-c.
complements a b c d k e f g h:
    parallelogram a b c d
    between a k c
    between a e b
    between d g c
    between e k g
    parallel e g a d
    between a h d
    between b f c
    between h k f
    parallel h f a b

# The complements are equal, shown by their halves e-b-f and k-g-d. The diagonal halves the whole and
# both parallelograms about it; take the halves of those two from the halves of the whole, and the
# complements' halves are left (common notion 3).
? eq-area e b f k g d: complements a b c d k e f g h

# ══ Pythagoras ═══════════════════════════════════════════════════════════════════════════════════
#
# In a right triangle, the square on the side opposite the right angle equals the squares on the other
# two sides (Euclid I.47). Euclid's proof, the windmill: the line through the right angle's vertex a,
# parallel to the sides of the square on b-c, cuts that square into two rectangles, and each equals the
# square on the side next to it. That is the theorem as this book can say it: the square cut into parts
# equal to the two squares, without adding them up.

# The windmill: Euclid's figure for Pythagoras, on a right triangle a-b-c with its right angle at a.
#
# The square a-b-f-g on a-b, its side g-a running on along a-c (which makes the right angle at a), and
# the square c-b-d-e on b-c. l is on the line through a parallel to b-d, which cuts the square on b-c
# in two (Euclid's l is where it meets the far side). The squares stand outside the triangle, which is
# said with the points where the windmill's lines cross: f-c crosses a-b at x, and a-d crosses b-c at y.
windmill a b c f g d e l x y:
    triangle a b c
    square a b f g
    between g a c
    square c b d e
    parallel b d a l
    between f x c
    between a x b
    distinct b x
    between a y d
    between b y c
    distinct b y

# The windmill's two triangles are equal: a-b-d and f-b-c have b-a = b-f and b-d = b-c, and their angles
# at b are each a right angle and the angle a-b-c together.
? eq-area a b d f b c: windmill a b c f g d e l x y

# f-b-c is half the square on a-b: it stands on f-b between the parallels f-b and g-a-c.
? eq-area f b c f b a: square a b f g, between g a c

# The square on a-b equals the rectangle on b-d that reaches the line through a parallel to b-d: their
# halves a-b-f and l-b-d are equal, for l anywhere on that line. a-b-f is f-b-c (on f-b between
# parallels), which is a-b-d (the windmill), which is l-b-d (on b-d between parallels).
? eq-area a b f l b d: windmill a b c f g d e l x y

# ══ Squaring a figure ════════════════════════════════════════════════════════════════════════════
#
# Euclid's culmination: any figure with straight sides can be turned into a square of the same area
# (I.45, II.14). Three constructions do it: a polygon loses a corner at a time until it is a triangle,
# a triangle becomes a rectangle, and a rectangle becomes a square.

# Dropping the corner d of a quadrilateral a-b-c-d, the triangles a-b-c and a-c-d on its diagonal a-c:
# the parallel through d to the diagonal meets b-c, continued past c, at e. The triangle a-b-e has the
# quadrilateral's area.
drop-corner a b c d e:
    triangle a b c
    triangle a c d
    parallel a c d e
    between b c e

# a-c cuts a-b-e into a-b-c, the quadrilateral's part on one side of the diagonal, and a-c-e, which
# equals its part on the other side, a-c-d: they stand on a-c between the parallels a-c and d-e.
? eq-area a c e a c d: drop-corner a b c d e

# A triangle a-b-c to a rectangle e-c-g-f (Euclid I.42, in a right angle): e halves b-c, and the
# rectangle on e-c reaches the parallel to b-c through a.
triangle-to-rectangle a b c e f g:
    triangle a b c
    midpoint e b c
    rectangle e c g f
    parallel b c f a

# The rectangle is the triangle's size: its half f-e-c stands on e-c between the parallels b-c and f-a,
# with the triangle's half a-e-c, which the median makes equal to the other half a-b-e.
? eq-area f e c a b e: triangle-to-rectangle a b c e f g

# A rectangle a-b-c-d to a square (II.14): continue a-b past b by b-c, to e; halve a-e at m; the circle
# about m through a meets c-b, continued past b, at h. The square b-h-j-k on b-h has the rectangle's
# area.
rectangle-to-square a b c d e m h j k:
    rectangle a b c d
    between a b e
    eq-lines b e b c
    midpoint m a e
    circle m a h
    between c b h
    square b h j k
#
# Why it does is Pythagoras as a sum: the square on m-h is the squares on m-b and b-h together, and
# also the square on m-b and the rectangle together (II.5), so taking the square on m-b from both
# leaves the square on b-h equal to the rectangle. Two sums and a difference of them is more than a
# figure cut into its parts can say; it waits for the book to add.

# ══ Quadrance ════════════════════════════════════════════════════════════════════════════════════
#
# The quadrance of a segment is its length squared (Wildberger's word). Quadrances add where lengths
# do not: Pythagoras says the quadrances of a right triangle's legs make its hypotenuse's. So equal
# lengths follow by adding and taking away quadrances, which the engine does with a solver once it has
# recognised, from the rules below, that quad-sum is a sum (kb/structure.ts). quad-sum is machinery:
# what follows is said in equal lengths, as Euclid says it.

# quad-sum a b c d e f: the quadrances of a-b and c-d together make that of e-f. The parts may be
# taken in either order, and each segment either way round.
quad-sum c d a b e f: quad-sum a b c d e f
quad-sum b a c d e f: quad-sum a b c d e f
quad-sum a b d c e f: quad-sum a b c d e f
quad-sum a b c d f e: quad-sum a b c d e f

# A segment as long as a part, or as the whole, may stand for it.
quad-sum x y c d e f: quad-sum a b c d e f, eq-lines a b x y
quad-sum a b c d x y: quad-sum a b c d e f, eq-lines e f x y

# The parts make one whole: two segments made of the same parts are equal. And taking away: two
# segments that make the same whole with the same part are equal.
eq-lines e f g h: quad-sum a b c d e f, quad-sum a b c d g h
eq-lines c d g h: quad-sum a b c d e f, quad-sum a b g h e f

# Pythagoras (I.47) in quadrances: a right angle at b makes the legs' quadrances the hypotenuse's.
# This chapter's I.47 is for areas (the windmill); for quadrances it is taken here, as an axiom. Said
# through right's definition (an angle equal to the one beside it along a line), not right: a clause
# here that mentioned right would put right's definition on a cycle, through equal lengths.
quad-sum b a b c a c: between a b d, distinct a b, distinct b d, eq-angle a b c c b d, distinct b c

# And from a quarter turn (chapter 3): lines through b turning to each other alike either way round,
# with a, b and c not on one line, make a right angle at b. A turn knows no sides, so this reaches
# where the angle form cannot: the right angle at the foot of a perpendicular, towards either end.
quad-sum b a b c a c: eq-turn b a b c b c b a, triangle a b c

# Two right triangles, at b and at e, with the hypotenuses equal and a leg equal.
right-triangles a b c d e f:
    right a b c
    right d e f
    eq-lines a c d f
    eq-lines a b d e

# Hypotenuse-leg: their other legs are equal too. Euclid does not state it; here it is Pythagoras
# twice, and taking away.
? eq-lines b c e f: right-triangles a b c d e f
