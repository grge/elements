# Constructions used only as tests: Euclid I.2 and I.3. The book does not need them (its compass
# carries a length), but they exercise auxiliary points, order facts and common notion 3.

# I.2 — from point a, draw a-l equal to b-c: the equilateral triangle d a b, the circle about b
# through c meeting d-b beyond b at g, the circle about d through g meeting d-a beyond a at l.
copy-segment a l b c:
    eq-triangle d a b
    circle b c g
    between d b g
    circle d g l
    between d a l

# I.3 — from a-b, cut off a-x equal to the shorter c-d.
cut-segment a b x c d:
    copy-segment a l c d
    circle a l x
    between a x b
