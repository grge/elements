# Lemma test suite
#
# Verified interactively in the browser and via npm test.
# Conventions:
#   ? head: hyp1, hyp2   — should be PROVABLE given hypotheses
#   ? head: -             — should be PROVABLE from no hypotheses (axiomatic)
#   Negative tests are marked with a comment and should show as ✗
#
# Some predicates used here (midpoint) are defined in this file itself.

midpoint m a b:
    between a m b
    eq-lines a m m b

# ── eq-point ──────────────────────────────────────────────────────────

? eq-point a a: -
? eq-point b a: eq-point a b
? eq-point a c: eq-point a b, eq-point b c

# ── Substitution into eq-lines ────────────────────────────────────────

? eq-lines a b c d: eq-point a x, eq-lines x b c d
? eq-lines a b c d: eq-point b x, eq-lines a x c d

# ── Substitution into between ─────────────────────────────────────────

? between a b c: eq-point a x, between x b c
? between a b c: eq-point b x, between a x c
? between a b c: eq-point c x, between a b x

# ── Substitution into collinear ───────────────────────────────────────

? collinear a b c: eq-point a x, collinear x b c

# ── Degenerate collinearity ───────────────────────────────────────────

? collinear a a b: -
? collinear a b a: -
? collinear b a a: -

# ── eq-lines: reflexivity and symmetry ───────────────────────────────

? eq-lines a b a b: -
? eq-lines b a a b: -
? eq-lines b a c d: eq-lines a b c d
? eq-lines a b d c: eq-lines a b c d
? eq-lines c d a b: eq-lines a b c d
? eq-lines b a d c: eq-lines a b c d

# ── eq-lines: transitivity ────────────────────────────────────────────

? eq-lines a b e f: eq-lines a b c d, eq-lines c d e f
? eq-lines a b c d: eq-lines a b e f, eq-lines e f c d

# ── eq-lines and eq-point interaction ────────────────────────────────

? eq-lines a c b c: eq-point a b
? eq-point a b: eq-lines a c b c
? eq-lines a b c c: eq-point a b

# ── eq-lines: common reorderings ─────────────────────────────────────

? eq-lines a b c d: eq-lines b a d c
? eq-lines a b c d: eq-lines d c b a
? eq-lines a b b c: eq-lines c b b a

# ── betweenness: symmetry ────────────────────────────────────────────

? between c b a: between a b c

# ── betweenness: degenerate ───────────────────────────────────────────

? between a a b: -
? between a b b: -

# ── betweenness: equality propagation ────────────────────────────────

? between x b c: between a b c, eq-point x a
? between a x c: between a b c, eq-point x b
? between a b x: between a b c, eq-point x c

# ── betweenness: transitivity-style closure ───────────────────────────

? between a c d: between a b d, between b c d
? between a b d: between a b c, between a c d

# ── betweenness implies collinearity ─────────────────────────────────

? collinear a b c: between a b c
? collinear a b c: between b c a
? collinear a b c: between c a b

# ── collinear: permutation closure ───────────────────────────────────

? collinear b a c: collinear a b c
? collinear a c b: collinear a b c
? collinear c b a: collinear a b c

# ── collinear: degenerate ─────────────────────────────────────────────

? collinear a a b: -
? collinear a b a: -
? collinear b a a: -

# ── collinear: equality propagation ──────────────────────────────────

? collinear x b c: collinear a b c, eq-point x a
? collinear a x c: collinear a b c, eq-point x b
? collinear a b x: collinear a b c, eq-point x c

# ── collinear: interaction with betweenness ───────────────────────────

? collinear a c d: between a b d, between b c d
? collinear a b d: between a b c, collinear a c d
? collinear a m b: between a m b

# ── eq-lines: collapsing a segment ───────────────────────────────────

? eq-lines a b a a: eq-point a b
? eq-lines a a b a: eq-point a b

# ── collinear: under equality collapse ───────────────────────────────

? collinear a a c: eq-point a b, collinear b a c

# ── betweenness + congruence ─────────────────────────────────────────

? eq-point b c: between a b c, eq-lines a b a c
? eq-point a b: between a b c, eq-lines a c b c

# ── circle predicate ─────────────────────────────────────────────────

? eq-lines o a o p: circle o a p
? eq-lines o p o a: circle o a p

# ── equilateral triangle ─────────────────────────────────────────────

? eq-lines a b a c: eq-triangle a b c
? eq-lines a b b c: eq-triangle a b c
? eq-lines a c b c: eq-triangle a b c

# ── midpoint ─────────────────────────────────────────────────────────

? between a m b: midpoint m a b
? collinear a m b: midpoint m a b
? eq-lines a m m b: midpoint m a b
? eq-lines m a b m: midpoint m a b
? midpoint m a b: between a m b, eq-lines a m m b

# ── equilateral recognition ───────────────────────────────────────────

? eq-triangle a b c: eq-lines a b a c, eq-lines a b b c

# ── small transitive geometric facts ─────────────────────────────────

? eq-lines o p o q: circle o a p, circle o a q
? eq-lines a c b c: eq-triangle a b c
? collinear a c d: collinear a b c, collinear a b d

# ── negative tests (these should NOT be provable — expect ✗) ─────────

? eq-point a b: -
? between a b c: collinear a b c
? eq-lines a b b c: circle a b c
? midpoint m a b: between a m b
? eq-triangle a b c: circle a b c
