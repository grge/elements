# The engine: a design proposal

A proposal from November 2026 for the logic engine's next form. It has two halves:
- **proofs as objects**: proofs the engine finds, a reader reads and an author writes, with new
  points brought in by construction;
- **cold-start search**: a much faster search for when there is no proof yet, from three changes to
  today's engine and a new matching core.

A review, with a reordered path and the questions still open, is in
[engine-review.md](engine-review.md).
The design for a book's tools (construction moves, and proved lemmas as tools), the review's second
step, is in [tools.md](tools.md).

Nothing here is in the app yet. Every decision rests on a prototype or a measurement. The numbers
are in [review-notes.md](review-notes.md), in three sections:
- *Proofs and the search*, measured at 2aef82e;
- *Cold-start search*, measured at c5bf848;
- *The matching-core spike*.

The prototypes that were kept are in `scripts/prototypes/`.

## In short

**The engine proves the book, but it has three limits.**
1. **It finds proofs expensively.** The book's proofs are small, but the search that finds them is
   not. The windmill's first lemma has an 11-step proof, essentially Euclid's argument for I.47. The
   search made 405,774 rule matches to find it. A match costs about 14 µs, mostly in generic
   machinery: strings, maps and scans.
2. **It cannot reach proofs that need a point no hypothesis names,** which is where Euclid begins
   a proof: "let the parallel through c be drawn". Forward chaining reasons only about the points it
   has.
3. **It keeps no proofs.** A ✓ says that a lemma follows, never how. An author cannot say how it
   should follow, and a reader cannot see how it was shown.

**The proposal answers them together.**
- **Every ✓ keeps the proof it found.** The page shows it. Once kept, it is replayed, not searched
  again: in the prototype, 86 of the book's 91 proofs replay in 6 ms in all, against 74 s of search.
- **An author may write a proof under a lemma**, as `?` lines in its body: the only syntax added.
  - A step that names new points is a construction. The planner builds it with Euclid's moves, and
    the figures witness that it exists.
  - Steps are checked one rule or one cited lemma at a time, in milliseconds.
  - Thales' converse, unprovable as written, proves once its construction is given.
- **When there is no proof yet, the search is much faster.**
  - Three changes keep every closure exactly as it is: indexes, an early check that a rule's
    conclusion is already known, and supplements as signed classes of equal angles. They take
    the book's checks from 211 s to 48 s, and all 99 lemmas prove.
  - A new matching core on integers, shown on a slice of the book, is 10 to 12 times faster
    again, with identical closures.

**What it does not do.** It does not add logic: sides, case splits and sums of areas stay open
questions of their own. More speed alone proves none of *Beyond the book*'s hardest lemmas: three of
them reach a complete closure without their goal.

## Where the engine stands

`saturate.ts` computes the forward closure of a lemma's unfolded hypotheses until its goal appears
or a budget of work runs out.
- **Structure.** It holds equal points and every recognised equivalence (segments, angles,
  directions, areas) in union-find classes, and keeps symmetric relations in a canonical order.
  All of this is proven from the rules, never declared.
- **Solvers.** Turns, ratios and quadrances are answered by an integer lattice, with equal values
  fed back.
- **Consistency.** A figure of the hypotheses witnesses that they are consistent, so the search for
  `false` runs only when no figure is found.

What it costs and what it reaches:
- **The book (chapters 1 to 7, 99 lemmas)** checks in 211 s. The windmill's two lemmas run past the
  3 million budget.
- ***Beyond the book*** proves 8 of its 18 lemmas; one more (the isosceles trapezoid) is rightly
  refuted. Of the nine that do not prove:

  | Lemma | What blocks it |
  |---|---|
  | Thales' converse | a point no hypothesis names (the rectangle's fourth corner) |
  | the centroid | a point not named (the third median's crossing), then a uniqueness step: two points that cut a median in one ratio are one point |
  | the nine-point circle, both forms | Thales' converse inside it |
  | Euler's line | the budget: unproved at 66 million units (12.6 minutes) |
  | the circumcentre on the bisector, both forms | sides of a line |
  | the altitudes and Thales, as `right` | a quarter turn cannot conclude `right` (consolidation.md) |

## Part 1: proofs as objects

### Why

Euclid's proposition has four parts:
1. the enunciation;
2. the setting-out;
3. the construction;
4. the demonstration, each step citing a postulate, a common notion or an earlier proposition.

elements has the first two (a lemma's head and its hypotheses) and nothing for the other two.

Three readers want the missing parts:
- **a reader** wants to see how a tricky theorem is shown;
- **an author** wants to say how it should be shown, including the construction it needs;
- **a workbench user** wants a ✓ on their own assumptions, quickly, and again after every edit.

One object serves all three: the proof.

The measurements say this is cheap to have:
- **The book's proofs are small.** Its 91 lemmas (at 2aef82e) have proofs of 518 steps in all.
  The median proof is a single rule step.
- **The search is not.** It made 1.58 million matches to find those proofs, about 3,000 per step.

So a kept proof turns an expensive search into a cheap check.

### Principles

1. **A proof is a list of atoms.** It is the same stuff as a body: facts, in order, each following
   from those above it.
2. **One object for three readers.** The engine finds proofs, the page shows them and the author may
   write them, all checked the same way.
3. **Search once, then replay.** A ✓ is backed by a proof that replays in microseconds.
4. **The logic never invents points; the plane makes them.** A construction is shown the way a
   construction page is, by the planner with Euclid's moves.
5. **A proof never changes what a lemma means.** `? H: B` means what it meant; deleting its proof
   leaves its meaning as it was.
6. **Lemmas are cited, never added wholesale.** Measured below.

### The proof object

A proof is a list of steps: a fact and its justification. The justification is one of four things.
- **A rule,** with its source line, so the page can link to the clause and its doc comment.
- **An earlier lemma.**
- **A solver step,** with its certificate: the equations combined and their integer coefficients
  ("adding turns: +1, −1").
- **Structure:** an equality chain (the chains marks already show) or a symmetry.

**How it is built: provenance.**
- Every stored fact, union of tuples and merge of points records the rule instance that made it,
  or the solver step with its certificate.
- A class membership is explained by the shortest path through recorded unions, bounded by time so
  it never goes round a cycle: the proof forest of proof-producing union-find, as in egg's
  explanations.
- The prototype explains all 91 book proofs.
- **Cost:** recording costs no measurable time. The windmill's search does the same 2,920,779 units
  of work with it.
- **Gap:** a solver answer used as a rule's premise needs its certificate taken when it is used. The
  prototype took it too late for five proofs, so those do not replay yet.

**What a reader sees.**
- **Order and incidence steps are folded.** Euclid reads these off the figure; elements proves them,
  and shows them when asked:
  - `collinear b x a` from `between`;
  - an angle read along its arm;
  - a triangle kept off a line by a crossing.
- **A solver step reads as its sum.** Thales as turns is three steps: two isosceles base turns,
  then "adding turns: +1, −1".
- **The figure follows the proof.** Each step lights its points as the reader steps through, as
  hovering a `?` line already does for marks.
- **A proof also says what it rests on.** For example, chapter 3's lemma that a parallelogram's
  diagonals bisect each other was proved through chapter 6's similar triangles. That answers what
  rests on what, from the content rather than from file order.

**Kept and replayed.**
- A proof is kept in the browser, keyed by the knowledge base's fingerprint and the lemma.
- A check replays it first: it asserts each step after checking that its premises hold. The search
  runs only when there is no proof, or the old one no longer holds.
- A workbench user who edits a hypothesis usually keeps most of the old proof: replay what still
  holds, and search from there.
- **"Write it in"** copies the extracted proof's steps into the source as `?` lines, the metric
  steps without the bookkeeping. Then the proof is part of the book.

### Writing a proof

**The syntax.** A lemma's indented body may go on with `?` lines. The plain lines are its
hypotheses, as now. The `?` lines are its proof, read in order:

```
# Thales' converse: the midpoint of the hypotenuse is as far from the right angle as from its ends.
? eq-lines o a o b:
    right a b c
    midpoint o a c
    ? double b o d           # continue b-o past o by its own length, to d
    ? eq-angle a o d c o b   # vertical angles (I.15)
    ? eq-lines a d c b       # side-angle-side
    ? eq-angle a o b c o d   # vertical angles again
    ? eq-lines a b c d       # side-angle-side
    ? eq-lines b d a c       # a-b-c-d is a rectangle: its diagonals are equal
```

The language keeps its two forms (a clause, and a clause with `?`). `?` already means "to be
shown"; inside a body it means "shown next".
- **Step.** A claim shown from the hypotheses and the steps above it. Each step gets its own mark in
  the gutter (✓, ✗, ?), as lemmas do.
- **Construction.** A step whose atom names points not above it. These new points are how a proof
  reaches what forward chaining cannot. In the example, `double b o d` brings in d, the rectangle's
  fourth corner.
- **The head.** The last step, shown from everything above.
- **Citations.** There is no citation syntax: the checker finds which rule or lemma gives each
  step, and the page shows it. Comments carry the reasons, as prose.

**Constructions: new points.**
- **Built by the planner.** The planner builds a construction's new points from the points above,
  with Euclid's moves only (a line through two points, a circle about a point through a point,
  where they meet: `plan(model, { euclid: true })`, as for construction pages).
- **Checked on the figures.** The step must hold in every sampled figure. Its unfolding then joins
  the known facts, with the new points named.
- **Logically this is existential elimination.** The head does not mention the new points, so it
  follows from the hypotheses together with "there is a d such that…". The plane, not the logic,
  answers for "there is".
- **The verdict says so.** Where existence rests on the figures, the verdict reads "follows, given
  its construction". That is Euclid's own standard, his gap included (when do two circles meet?).

**How a step is checked,** the first of these that works:
1. **already known,** by structure: a class, a symmetry, a solver;
2. **one rule or one earlier lemma:** the rule's head is bound to the step and its body is matched
   against what is known. That is a lookup, not a search;
3. **a short search** from the facts and steps so far, with a budget a step can afford.

A step that fails gets ✗ or ?, with its reason. The lemma is ✓ when its steps hold and its head
follows from them.

**What the prototypes showed.**
- **Thales' converse,**
  - **as written:** does not prove;
  - **with `double b o d` added:** proves in 3 s, a 20-step proof;
  - **written as above:** checks in 1.6 s. The vertical angles (cited from chapter 2) and the two
    uses of side-angle-side are one rule each; the diagonals and the head take a short search
    (1.2 s and 0.4 s).
- **The windmill,**
  - **its 11 extracted steps,** each one rule: 5 ms;
  - **its second lemma as Euclid's three steps,** citing its two lemmas, then the shear: 33 ms,
    against 19.5 s of search.
- **Citing against adding.** The windmill's second lemma, with its two cited lemmas given as rules,
  took 4.8 s instead of 19.5 s. With every earlier lemma added as a rule, it did not finish in 30
  minutes.
- **Lemmas must join after unfolding.** Added as ordinary clauses, lemmas put `right`, `square`,
  `parallelogram` and `windmill` on a cycle, so those stopped being definitions. Lemmas must join the
  engine as rules over primitives, after definitions are unfolded.

**What written proofs could unlock in *Beyond the book***, of the nine that do not prove:
- **Thales' converse:** yes, measured.
- **The nine-point circle:** probably, by citing Thales' converse once it is proved. Not tried.
- **The centroid:** partly. Its construction is the third median's crossing, but it then needs a
  uniqueness step, an `eq-point`, which the book barely derives.
- **Euler's line:** possibly. Given steps would replace a search that ran out at 66 million units;
  it also waits on ratios and the centroid.
- **The altitudes as `right`, and the circumcentre on the bisector:** no. They need the logic (the
  quarter turn and `right`, and sides), not points.

For the book itself, statements written for the engine could go back to their plain forms, with
the points moved into a written proof:
- the midline names its proof's two points in its figure;
- III.32 names the far end of a diameter.

**Alternatives weighed:**
- **A `by` keyword, or a separate proof block.** Clear, but a third form for one purpose.
- **Head-only points read as existential** (`? double b o d: distinct b o` as "there is a d").
  Head-only points already mean "for any", and chapter 3's `eq-turn a b e f c d e f` uses that.
- **A `!` form for existence statements,** the roadmap's parked sketch. Worth it only if the book
  wants to state Euclid's postulates. The planner's moves already are those postulates.
- **A proof as a page,** its facts the figure and its ground `?` queries the steps. Close to Euclid,
  but it proves one configuration, not a lemma.

## Part 2: cold-start search

When there is no proof to replay (a new lemma, a changed knowledge base, a workbench user's own
assumptions), the search still runs, and it is too slow.

### Where the time goes

A CPU profile of the windmill's first lemma (out of budget at 6.4 million units, 36 s):

| Share | What |
|---|---|
| 41% | scanning facts and unifying arguments |
| 21% | string keys for canonical forms |
| 10% | garbage collection |
| the rest | joins, solvers, the store |

A rule match costs about 14 µs. The same rule done as a plain join on integers costs 0.019 µs a
match. That was the common-supplement rule, over the windmill's 6,936 `supp` facts. It leaves out
equal points, conclusions and symmetry breaking, so it bounds the overhead rather than predicting a
whole engine.

Two other things the measurements found:
- **Overlap.** On the windmill's plain search, `supp` was 6,936 of 7,766 stored facts. They name
  only 1,197 pairs of geometric angles. `supp` and `eq-angle` say one thing twice: a supplement is
  an equal angle on the other side.
- **Repeats.** Lemmas with identical hypotheses recompute one closure: 15 sets, 21 s of the book's
  66 s at 2aef82e.

### Three changes to today's engine

Each change keeps every closure exactly as it is. On the whole book (99 lemmas, at the default
budget):

| Engine | Time | Work | Proved |
|---|---|---|---|
| today | 211 s | 28.3 M | 97 (both windmill lemmas out of budget) |
| + signed angle classes | 146 s | 24.8 M | 97 |
| + indexes and the early head check | 80 s | 15.8 M | 99 |
| all three | 48 s | 9.6 M | 99 |

1. **Signed angle classes.**
   - `supp` is kept as parity inside `eq-angle`'s classes. An odd class is an angle equal to its own
     supplement. This is how marks.ts already reads supplements.
   - `supp`'s four structural rules then never fire, and no `supp` fact is stored.
   - Full closures are identical. The windmill's matches fall from 461,440 to 34,704 with all three
     changes.
   - To build it properly, the structure is recognised from `supp`'s own rules, as equivalences are,
     never wired to the names.
   - A trap: the relevance cut must learn that `supp` feeds the angle classes. Otherwise it drops
     the only rule that makes supplements.
2. **Indexes.** A stored relation is indexed by (position, value), and an equivalence by (position in
   a block, value), so a bound argument is a lookup. Alone they gain 17%.
3. **The early head check.** A partial match is abandoned once the rule's conclusion is bound and
   already holds. Alone it brings the windmill back inside its budget.
   - A caution for the real build: the check is exact only when every head variable is bound to one
     value. Where a variable stands for a class at a position that does not admit substitution,
     the conclusion is many facts, and holding for one says nothing of the others.

### A new matching core

After the three changes, what is left in the profile is the generic machinery:
- unification;
- canonical forms built as strings;
- allocation, and the garbage collection it causes.

So the core should do the same work in a different representation.

**What it is.** It runs the same prepared rules (structure, definitions as abbreviations, rule
symmetries), computes the same closure rule by rule and round by round, and keeps the same interface
(`assert`, `holds`, `run`, `allFacts`, `work`).
- **Integers.** Points are small integers, and a tuple is a packed number (position 0 first, so
  numeric order is lexicographic order). A canonical form is the least packed image under its
  relation's group.
- **Compiled rules.** Each rule is compiled once: its variables are numbered slots in typed arrays,
  bound and undone by a trail, never copied as a map. The atoms still to match are a bit mask. There
  are no generators.
- **Indexes everywhere.** Every stored relation is indexed by (position, value), every equivalence by
  (position in a block, value).
- **The subtle part of the semantics, carried over exactly.** A variable bound where equal points
  substitute stands for its whole class, until a position that does not substitute pins it to one
  point. `supp` has such positions, so the slice exercised it.

**The spike** (`scripts/prototypes/fastcore.ts`, about 650 lines; its test is
`fastcore-compare.ts`).
- **The slice:** chapters 1 to 4 without the words that need a solver (`eq-turn`, `quad-sum`,
  `eq-ratio`, `cyclic`): 143 of 175 rules and 68 lemmas. Both engines ran the same rules on the same
  hypotheses.
- **Correctness:**
  - **full closures:** 64 of 64 identical, fact for fact both ways. That includes the rectangle's
    diagonals, an 8,522-fact closure run to the end;
  - **goal searches, as the checker runs them:** 68 of 68 verdicts agree.
- **Speed:**

  | What | Today | Core | Gain |
  |---|---|---|---|
  | full closures (64) | 110.0 s | 11.0 s | 10.0× |
  | goal searches (68) | 65.3 s | 5.3 s | 12.4× |
  | the 13 heavy searches | 63.5 s | 5.0 s | 12.8× |
  | the windmill's first lemma | 13.7 s | 0.83 s | 16.5× |

- **Where the gain came from.** The first cut gave 7 to 8×; taking allocation out of the inner loops
  gave the rest. What remains is matching itself, about 2.5 µs per match against 14. The bar set
  before the spike was 10×, and it clears it.
- **The changes compound.** The core makes each match cheaper; the three changes make fewer matches.
  They should multiply: an estimate of 30 to 50× on the book, not yet measured.

### Smaller wins

- **One closure per set of hypotheses,** for the lemmas that share one (32% of the book's time at
  2aef82e).
- **The turn solver's answers cached** per version of the store (16% of the windmill's time after
  the three changes).
- **A page's lemmas checked in parallel workers,** since they are independent.

### What speed does not buy

With 20 times the budget, none of *Beyond*'s four out-of-budget lemmas proves:
- the centroid, the altitudes as `right` and the nine-point circle reach a complete closure without
  their goal (at 2.6, 3.9 and 3.1 million units). They wait on a construction or on the logic;
- Euler's line is still unproved at 66 million units.

So speed makes the book fast and the workbench responsive. Power comes from Part 1 (constructions,
cited steps) and from the logic (sides, `right`, sums), not from a bigger budget.

### Tried, and not the answer

- **Semi-naive evaluation.** A full closure matches each rule instance only 2 to 3 times across
  rounds, so it can save at most that. It was built once before and measured no faster.
- **Relevance by predicate.** Every goal reaches nearly every rule.
- **A backward search guided by the figure.** It proved the isosceles triangle in one step, but ran
  out of budget at depth 2 on the windmill. Order and incidence facts hold for too many choices of
  points.
- **Every earlier lemma as a rule.** It did not finish (above).
- **A structure for angles along their arms (rays).** There are only 1.5 names per geometric angle
  (726 for 473 in the windmill, 951 for 633 in Euler's figure), so the lever is small.

## How the two halves fit

- **The cache is the first line.** A check replays a kept proof. Only when there is none does the
  search run: the three changes and the new core. The search's result is a proof, kept for next
  time.
- **Provenance belongs in the new core, not in `saturate.ts`.** The integer core records each
  fact's reason as an integer record, and solver certificates as coefficient lists.
- **A written proof's steps are checked by the same core:** one rule with its head bound (a lookup),
  else a short search.
- **The budget changes meaning.** It is counted in work, and a faster core does more per unit, so
  `MAX_WORK` is re-tuned when the core lands. Until then a faster engine proves nothing more.

## The path

Each step is useful alone and measured with `scripts/bench.ts` and the prototypes' harnesses.
1. **The three changes in `saturate.ts`.** Landed (November 2026; review-notes.md, *Landed*):
   - signed angle classes, recognised from the rules as a flip;
   - indexes;
   - the head check bound to exact heads.

   Then one search per set of hypotheses (resumable runs: a lemma carries on the last search with
   the same hypotheses and goal predicate, with the verdict a fresh search gives) and the solver
   cache: the book in 34.5 s (review-notes.md, *Shared searches*). Step 1 is done.
2. **The new core: solvers, then the whole book.**
   - The lattice for differences and sums, with a solver atom answered in the middle of a join.
   - The interface the checker and the marks closure use.
   - The three changes inside it.
   - Then it replaces `saturate.ts`, which stays in the tests as the oracle: every closure compared.
3. **Proofs found and shown.** Provenance in the core, with certificates taken when a solver answer
   is used. Explanation, and the proof on the page, folded.
4. **The cache.** Replay before search, in the worker.
5. **Written proofs.**
   - The parser accepts `?` lines in a lemma's body.
   - The three ways of checking a step, with per-step verdicts.
   - Constructions built with Euclid's moves.
   - Tried on *Beyond*: Thales' converse, then the nine-point circle, the centroid and Euler's line.
6. **Statements back to their plain forms,** where a written proof can carry the points they now
   name (the midline, III.32).

## Open questions

**Proofs:**
- **How big a written step may be.**
  - Rule-sized steps check at once but are many: 11 for the windmill.
  - Euclid-sized steps read well, but hide the order and incidence bookkeeping, which today costs a
    search of 1 to 5 s a step.
  - Ways to close the bookkeeping cheaply, to be measured once real proofs are written:
    - a closure under the order and incidence rules alone, before each step;
    - facts the figure shows, offered as steps to accept, never used silently;
    - rays (small, above).
- **What a construction must satisfy.**
  - Its new points must be determined by the points above, or free in a stated way ("any point on
    the line"), not merely drawable.
  - The planner's Euclid mode answers "can it be drawn". Something must also answer "is it
    determined", perhaps the count of conditions the planner already makes.
  - Constructions were added by hand in the prototype. Building them is new work.
- **Existence beyond the figures.** Should the book state Euclid's postulates (the `!` form), so
  that "follows, given its construction" can become a plain ✓? Only if the book wants to be a
  proof-checked Euclid (README, *What the book is for*).
- **Uniqueness.** Concurrence proofs (the centroid, Euler's line) end in `eq-point`, which the book
  barely derives: that two points cutting one segment in one ratio are one point. A gap in the
  logic that a proof cannot fill by itself.
- **Folding.** Which steps count as bookkeeping on the page, decided without naming relations.
  Candidates: steps whose conclusion the figure makes obvious, or steps of rules with no metric
  relation.
- **Keeping proofs as the book changes.** A kept proof cites rules by content, so an edit to an
  unrelated chapter need not invalidate it. Whether the key should be the fingerprint of the
  rules a proof uses, rather than of the whole knowledge base.

**Search:**
- **The solvers in the new core.** A bound solver atom is answered by the solver in the middle of a
  join, and solvers feed facts back between rounds. The spike had none: the least certain part of
  the build.
- **Signed classes in general.** `supp` is one case of "an equivalence and its image under an
  involution". Turns and their reversal may be another. Recognised from the rules, they need a
  proof shape in `structure.ts` (the four rules of a flip) and a relevance rule.
- **Order sensitivity.** A goal-stopped search's cost swings with small changes to the rules or
  the engine. On the old engine with chapter 7's rules, the supplement rules did almost nothing on
  the windmill; on the current engine they dominate. Cached proofs make this matter less; the
  benchmark should report full closures as well as goal searches, since those are stable.
- **The budget's unit.** Work, matches or time? Work is deterministic, but its meaning changes
  with the engine.

**Not in this proposal:**
- **cases:** a written proof is their natural home later, with steps under each case and a
  covering lemma;
- **sides of a line;**
- **sums of areas and lengths.**

## Decisions, in brief

| Decision | Why | Evidence |
|---|---|---|
| Proofs as objects, kept and replayed | proofs are small, search is large | 518 steps against 1.58 M matches; replay 6 ms against 74 s |
| `?` lines in a lemma's body, no new form | the language stays two forms; `?` already means "to be shown" | — |
| Constructions built by the planner, witnessed by figures | the logic cannot make points; the plane can, as it already witnesses consistency | Thales' converse proves with its construction |
| Lemmas cited per step, never added wholesale | adding all is far slower; adding them as clauses breaks definitions | 30 minutes, unfinished; definitions lost |
| Signed angle classes, indexes, head check | same closures, a quarter of the time | the book 211 s to 48 s, all 99 proved |
| A new matching core | the cost is per match, not in reasoning | the spike: identical closures, 10 to 12× |
| Not: semi-naive evaluation, relevance, backward search, rays, bigger budgets | measured, and small or no gain | review-notes.md |
