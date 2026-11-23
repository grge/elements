# A book's tools: a design

The second step of the engine review's path ([engine-review.md](engine-review.md), *The path,
reordered*), November 2026. It covers two kinds of tool, both used by written proofs
([engine.md](engine.md), *Writing a proof*):
- **construction moves:** what a construction step may use to bring in new points;
- **proved lemmas:** how a lemma a book has proved becomes something later proofs, or the search,
  may use.

The first is decided: every move the planner has, limited per book later. The second is open, and
laid out below for discussion. The measurements were made at 3e1df04; the scripts are not committed,
and each is described where its numbers appear.

## Part 1: construction moves

### Decided

- **The engine supports every valid move the planner has:**
  - the postulates' line and circle, and where they meet;
  - carried lengths and copied angles;
  - perpendiculars, parallels and Thales' circle;
  - areas by their height;
  - turned lines, and circles a chord is seen on;
  - fourth proportionals, Apollonius' circle and quadrance loci.

  A construction step in a written proof may use any of them, as a page's figure may.
- **Which moves a book allows is the book's choice, made later.** A Euclid book would allow the
  postulates and the problems it has already shown. The engine needs only the hook (below).

### A construction step

A `?` step whose atom names points not above it is a construction:

```
? eq-lines o a o b:
    right a b c
    midpoint o a c
    ? double b o d           # constructs d
    ...
```

The new points are built by the planner from the points above. A construction is "let d be such
that…", sound only if the claim does not name d (it says: for any d) and the step says nothing more
of the points above than where d is. Then every figure of what is above has such a d, and the claim,
which does not name it, follows from what is above alone. So a step is held to these checks:
0. **Fresh** (the logic): a point the claim names cannot be constructed.
1. **Conservative.** The step is planned after the figure of what is above it, that figure's steps
   kept exactly (the planner's `after`), so it can only place its new points; every equation it adds
   must be used to place one of them, one left over being a condition on the points above. And its
   facts that name only points above (an order fact, which is no equation) must be shown by the
   logic. Added November 2026, after two probes proved false lemmas: a step that also put a right
   angle on the points above was accepted, and a step could choose a point of the claim
   (review-notes.md, *Written proofs*).
2. **Determined, or freely chosen.** If the step fixes its new points, they are determined ("let d
   be where…"). If some are free, the step chooses ("let a point be taken on…"), as Euclid allows;
   the page says which.
3. **Apart from every other point.** In every sampled figure, every new point stands apart from
   every other point.
   - Only then is it granted the distinct-names convention, which the checker uses to take
     different names for different points.
   - This is the review's soundness point. A constructed point that falls on a named point in every
     figure, by some theorem, would otherwise contradict the convention, and from a contradiction
     anything follows.
   - The planner already refuses such a point: a meeting point that lands on another point is a
     failure, not a figure. So the page can say what happened plainly, as below.
4. **Exists: unconditionally, or as witnessed.** From the planner's step that places each new point:
   - **Unconditional:** a free point; a point on a locus that always exists; or a line through a
     circle's centre meeting that circle (`double`). Whether a locus always exists is said by its
     kind (`locusAlwaysExists`, which every kind must answer): a line or a circle of a length of the
     figure does; a circle of computed radius (a quadrance leg) or through three points may not.
   - **Witnessed only:** two lines (which may be parallel), two circles, or a line and a circle
     whose centre it misses. They exist in every sampled figure, and Euclid's own gap is here: when
     do two circles meet?

**What the measurements showed,** on constructions *Beyond the book* needs. Each case was planned
with the hypotheses and then with the construction added, sampled 24 times, and each new point's
nearest other point measured:

| Construction | New points | Determined | Apart | Existence |
|---|---|---|---|---|
| Thales' converse: `double b o d` | d | yes | yes (6.5%) | unconditional |
| the midline: `double d e f`, then `line-line-intersection d c b f x` | f, x | yes | yes (4.6%) | f unconditional, x witnessed (line meets line) |
| the centroid: `line-line-intersection c f a d h` | h | yes | **no figure** | h is g: the medians concur |
| an equilateral triangle on the hypotenuse: `eq-triangle a c p` | p | yes | yes (5.3%) | witnessed (circle meets circle) |
| the orthocentre: `parallel-through b c a p` (a copied angle) | p, m₁ | yes | yes (10%) | witnessed (circle meets circle; line meets line) |

The percentages are the nearest other point as a share of the figure's size.
- **Copied angles work** as construction steps.
- **The classification is conservative:** an equilateral triangle's two circles always meet, but
  their shapes do not show it, so it is "witnessed".
- **The centroid's case is the review's worry made concrete.** The point where c-f meets a-d is g,
  so the step has no figure.

### What the page says

- **In the gutter:** "constructs d" on a construction step, so that a misspelt point name is not
  silently a construction (the review's point 5).
- **On the lemma, the verdict:**
  - **every construction unconditional:** a plain ✓ (with the convention's "for figures whose
    points are all apart", as now, where it applies);
  - **some only witnessed:** "follows, given its construction", naming the step;
  - **a new point that is never apart from a named one:** the step gets "this point is g in every
    figure", and the proof must use g. That a point is g is an `eq-point` the book cannot derive
    yet; this is the uniqueness gap engine.md names.

### The hook for a book's choice

Each planner locus is a move:
- the postulates' line and circle;
- carried lengths and copied angles;
- perpendiculars and parallels;
- turned lines, and the circles a chord is seen on.

Planning takes the set of moves a book allows. Today's `plan(model, { euclid: true })` is that set
restricted to the postulates. A construction step fails, with the reason, if its points need a move
the book does not allow.

How a book states its moves is open (below). It is not needed until a second book, or a strict Euclid
book, wants a smaller set.

## Part 2: proved lemmas as tools

A proved lemma could be used in three places:
1. **As one step of a written proof.** "This step is lemma L, applied to these points."
2. **By the automatic search,** as if it were a rule of the book.
3. **To make a construction:** a lemma that shows a construction works. That is a construction word
   and its lemmas, which the moves above already cover.

The open question is how far to go with the first two. There are three options.

### Option A: cited in proof steps only

A proved lemma is used only when a written proof has a step that the lemma gives in one go. The
checker looks for it among the lemmas above, as it looks for a rule. The automatic search never
sees lemmas.
- **For:**
  - nothing new to say in the book;
  - no cost to any search;
  - the proof says exactly what it uses, as Euclid's do.
- **Against:**
  - a lemma with no written proof gets no help from what the book has proved, so the search keeps
    re-deriving I.4's consequences from the axioms;
  - to let the search use a theorem, the book has to keep it as an axiom, which is what the ledger
    of axioms that are Euclid's theorems is about.

### Option B: a book adopts chosen lemmas

As A, and in addition a book can mark particular proved lemmas as tools. From then on they are
rules of the search for everything after them. The natural use is the ledger: write the proof of
an axiom that is really Euclid's theorem (side-side-side, III.21 and others), then turn the axiom
into a proved lemma the book adopts, so the search keeps the step and the book stops assuming it.
- **For:**
  - the search gets the book's theorems, but only those the author chose;
  - the axioms taken for now can be paid back without slowing anything.
- **Against:**
  - it needs a way to mark a lemma (a convention, or new syntax);
  - each adopted lemma costs every later search a little.
- **Measured** (every later lemma searched as the checker does):
  - vertical angles (I.15) adopted, for the 71 lemmas after it: 50.9 s to 54.1 s (+6%);
  - five common lemmas adopted (vertical angles, the isosceles triangle, a parallelogram's
    opposite sides and angles, its diagonals bisecting), for the 50 after them: 49.9 s to 51.5 s
    (+3%);
  - no verdict gained or lost, since the book already proves everything.
- **The lemma must join after unfolding.** It joins the search as a rule over primitives. Added as
  an ordinary clause, it can put definitions on a cycle, so that `right`, `square` and the like stop
  being definitions and proofs are lost (engine.md, measured).

### Option C: every proved lemma, as a second pass

The search runs as now. If it fails, it runs again with every proved earlier lemma as a rule.
- **For:** automatic; nothing to mark.
- **Against:**
  - the second pass can be very slow: with every earlier lemma, the windmill's second lemma did not
    finish in 30 minutes;
  - it is unpredictable which lemmas finish;
  - a failing lemma takes the longest of all.

### Where this lands

**My lean is A now, and B when the ledger's axioms are paid back.**
- **A first:** A comes with written proofs at no extra cost.
- **Then B:** B's cost is small and in the author's hands, and it is what turns "an axiom for now"
  into a proved, adopted lemma.
- **Not C:** its cost is what was measured, with no control.

**To decide, if B:**
1. **How a lemma is marked.**
   - A convention: a doc-comment line, or a section heading ("Tools"), read by the parser as prose
     is read now. It keeps the language's two forms, but a comment that changes meaning is new.
   - Or syntax: `!` before a lemma ("proved, and adopted"). It is honest about changing the search,
     but a third form.
2. **Scope.** An adopted lemma serves the lemmas after it: in its chapter, below it, and in later
   chapters. That is the order Euclid uses, and it cannot loop.
3. **What happens if it stops proving.** If an edit breaks the adopted lemma's proof, everything
   that used it is suspect. The lemma's own ✗ shows it, and the rules it lends are withdrawn until
   it proves again.

## How it fits the path

The review's order:
1. **The three changes** (done: engine.md, *The path*).
2. **This design.**
3. **The proof object and step checker,** against an interface. Part 1's checks belong to the step
   checker; Part 2's option A is the step checker looking among lemmas as well as rules.
4. **Written proofs:** Thales' converse first (its construction is unconditional), then the midline
   without its points named, then the nine-point circle.
5. **The new core.**

## Open questions

- **Lemmas as tools:** A, B or C (Part 2), and for B, how a lemma is marked.
- **How a book states its moves,** when one wants fewer than the engine has: a book-level
  declaration (a manifest, or a first page), or per chapter.
- **"Freely chosen" construction steps:** may a written proof take "any point on the line", and then
  conclude something about it? It is sound (the point is arbitrary), but the page should say the
  choice is free.
- **Uniqueness:** the centroid needs "h is g". A construction step that reports it gives the author
  the fact, but proving it needs `eq-point` conclusions the book does not have.
- **Existence beyond the figures:** a plain ✓ for witnessed constructions would need Euclid's
  postulates stated as statements (engine.md's `!` alternative). Not needed unless the book wants
  to be a proof-checked Euclid.
