
## Basic
* `?eq-point a a : -`
* `?eq-point b a : eq-point a b`
* `?eq-point a c : eq-point a b, eq-point b c`

## Substitution-style
* `?eq-lines a b c d : eq-point a x, eq-lines x b c d`
* `?eq-lines a b c d : eq-point b x, eq-lines a x c d`
* `?between a b c : eq-point a x, between x b c`
* `?between a b c : eq-point b x, between a x c`
* `?between a b c : eq-point c x, between a b x`
* `?collinear a b c : eq-point a x, collinear x b c`

## Degenerate consequences

Depending on your intended theory:

* `?collinear a a b : -`
* `?collinear a b a : -`
* `?collinear b a a : -`

## Segment reflexivity / symmetry / reversal

* `?eq-lines a b a b : -`
* `?eq-lines b a a b : -`
* `?eq-lines b a c d : eq-lines a b c d`
* `?eq-lines a b d c : eq-lines a b c d`
* `?eq-lines c d a b : eq-lines a b c d`
* `?eq-lines b a d c : eq-lines a b c d`

## Transitivity

* `?eq-lines a b e f : eq-lines a b c d, eq-lines c d e f`
* `?eq-lines a b c d : eq-lines a b e f, eq-lines e f c d`

## Interaction with point equality

* `?eq-lines a c b c : eq-point a b`
* `?eq-point a b : eq-lines a c b c`
* `?eq-lines a b c c : eq-point a b`

## Common reorderings

* `?eq-lines a b c d : eq-lines b a d c`
* `?eq-lines a b c d : eq-lines d c b a`
* `?eq-lines a b b c : eq-lines c b b a`

## Betweeness Symmetry

* `?between c b a : between a b c`

## Degenerate betweenness

* `?between a a b : -`
* `?between a b b : -`
* `?between a b a : eq-point a b` or perhaps always false, depending on our conventions

## Equality propagation

* `?between x b c : between a b c, eq-point x a`
* `?between a x c : between a b c, eq-point x b`
* `?between a b x : between a b c, eq-point x c`

## Useful closure patterns

* `?between a c d : between a b d, between b c d`
* `?between a b d : between a b c, between a c d`

## Betweenness implies collinearity

* `?collinear a b c : between a b c`
* `?collinear a b c : between b c a`
* `?collinear a b c : between c a b`

## Permutation closure

* `?collinear b a c : collinear a b c`
* `?collinear a c b : collinear a b c`
* `?collinear c b a : collinear a b c`

## Degenerate collinearity

* `?collinear a a b : -`
* `?collinear a b a : -`
* `?collinear b a a : -`

## Equality propagation

* `?collinear x b c : collinear a b c, eq-point x a`
* `?collinear a x c : collinear a b c, eq-point x b`
* `?collinear a b x : collinear a b c, eq-point x c`

## Interaction with betweenness

* `?collinear a c d : between a b d, between b c d`
* `?collinear a b d : between a b c, collinear a c d`

## From midpoint-style facts

* `?collinear a m b : between a m b`
* `?eq-lines a m m b : eq-lines a m m b`
* `?eq-lines m a b m : eq-lines a m m b`

## Equality collapsing a segment

* `?eq-lines a b a a : eq-point a b`
* `?eq-lines a a b a : eq-point a b`

## Collinearity under collapse (what should happen?)

* `?collinear a a c : eq-point a b, collinear b a c`

## Betweenness plus congruence

These are useful if you want a richer core:

* `?eq-point b c : between a b c, eq-lines a b a c`
* `?eq-point a b : between a b c, eq-lines a c b c`

# 6. Named construction unfolding tests

* `?eq-lines o a o p : circle o a p`
* `?eq-lines o p o a : circle o a p`

## Equilateral triangle

* `?eq-lines a b a c : eq-triangle a b c`
* `?eq-lines a b b c : eq-triangle a b c`
* `?eq-lines a c b c : eq-triangle a b c`

Assuming:
`midpoint m a b: between a m b, eq-lines a m m b`

* `?between a m b : midpoint m a b`
* `?collinear a m b : midpoint m a b`
* `?eq-lines a m m b : midpoint m a b`
* `?eq-lines m a b m : midpoint m a b`

## Midpoint recognition

* `?midpoint m a b : between a m b, eq-lines a m m b`

## Equilateral recognition

* `?eq-triangle a b c : eq-lines a b a c, eq-lines a b b c`

# 8. Small transitive geometric facts

* `?eq-lines o p o q : circle o a p, circle o a q`

* `?eq-lines a c b c : eq-triangle a b c`

* `?collinear a c d : collinear a b c, collinear a b d`


# 9. Negative / non-provability tests

These are just as important. A good test bed should include queries that should **not** be derivable.

Examples:

* `?eq-point a b : -`
* `?between a b c : collinear a b c`
* `?eq-lines a b b c : circle a b c`
* `?midpoint m a b : between a m b`
* `?eq-triangle a b c : circle a b c`

These help catch accidental overstrength in the rule base.

