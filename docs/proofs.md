# Proofs

A diagnosis of the logic engine's power and efficiency, and a design for proofs as things the engine
finds, a reader reads and an author writes (November 2026). It is a proposal: nothing here is built.
Each decision rests on a prototype, measured on the book and *Beyond the book* at 2aef82e
(review-notes.md, *Proofs and the search*, has the numbers in full).

## In short

- **The proofs are small; the search is not.** The 91 book lemmas of chapters 1 to 6 have
  proofs of 518 steps in all, rule and solver steps together. The median proof is one rule step,
  and the longest is 33. The search made 1.58 million rule matches to find them: about 3,000 per
  step. The windmill's first lemma has an 11-step proof,
  essentially Euclid's argument for I.47. To find it, the search made 405,774 matches, stored 7,768
  facts and took 20 s.
- **A proof, once found, costs nothing to check.** Replaying a proof means asserting each step after
  checking that its premises hold. 86 of the 91 book proofs replay, in 6 ms for all of them; their
  searches took 74 s.
- **The cost is breadth, not depth.** One round of the rules over the windmill's facts is 375,000
  units of work. Most of it goes to relations that overlap, and to theories the goal never needs:
  - the common-supplement rule is a quarter of the windmill's work, for 16 new facts, and is in
    none of its proofs;
  - chapter 6's ratios-from-turns rules take a fifth of the work, on a lemma about areas.
- **The main wall to power is the one Euclid climbs with a construction.** Thales' converse does not
  prove as written. Add its construction, `double b o d` (complete the rectangle), and it proves in 3
  s. Written as a construction and five steps, its proof checks in 1.6 s. Of *Beyond*'s nine unproved lemmas, the
  missing construction blocks three or four. The others need sides, or wait on `right` against the
  quarter turn (the ledger).
- **So: make the proof an object.**
  - Every ✓ carries the proof the engine found.
  - The page shows it, Euclid's way.
  - An author may write one: a construction and steps, as `?` lines inside a lemma's body, the only
    syntax added.
  - The engine checks a written proof step by step, and builds a construction with Euclid's moves.
  - Once found, a proof is kept and replayed, so the search runs once.

## What the engine does now

`saturate` computes the forward closure of the unfolded hypotheses until the goal appears or the
budget of work runs out.
- **Structure.** It holds equality and the recognised equivalences in union-find, and reads
  symmetric relations in canonical order.
- **Solvers.** It answers turns, ratios and quadrances with the integer lattice, and feeds equal
  values back.
- **No record of why.** A fact, a union and a merge record nothing about how they came to be.

So a ✓ says that the goal follows, but not how. Nothing lets an author say how it should follow,
either: the checker is handed a claim and searches. Euclid's proposition has four parts:
1. the enunciation;
2. the setting-out;
3. the construction ("let the parallel through c be drawn");
4. the demonstration, each step citing a postulate, a common notion or an earlier proposition.

elements has the first two (a lemma's head and its hypotheses) and nothing for the other two.

## Diagnosis

### Power: what does not prove

The book itself proves: every lemma of chapters 1 to 6 has a ✓, as the app checks it, with a
witness and the non-degeneracy convention. Eighteen of them hold only for figures whose points are
all apart. *Beyond the book* proves 8 of its 18 lemmas, and rightly refutes the isosceles trapezoid.
The nine that do not prove:

| Lemma | What blocks it |
|---|---|
| Thales' converse | a point no hypothesis names (the rectangle's fourth corner). **With the construction given, it proves** (3 s, a 20-step proof) |
| the centroid | a point not named (the third median's crossing), then uniqueness: two points that cut a median in one ratio are one point, an `eq-point` the book barely derives |
| the nine-point circle, both forms | Thales' converse inside it (above), then the budget |
| Euler's line | ratios, and the budget (32 s, out) |
| the circumcentre on the bisector, both forms | sides |
| the altitudes, Thales, as `right` | the quarter turn cannot conclude `right` (consolidation.md); their turn forms prove |

So a written construction unblocks three or four of the nine directly, and it is the only cure for
points not named, because forward chaining reasons about the points it has. Sides and `right` are
the logic's business, not a proof's. The budget is efficiency, below.

### Efficiency: where the time goes

- **Proofs against matches.** The whole book: 518 proof steps for 1.58 million matches. The heaviest:

  | Lemma | Search | Matches | Facts | Proof |
  |---|---|---|---|---|
  | windmill, `eq-area a b d f b c` | 20 s | 405,774 | 7,768 | 11 steps |
  | the midline's half | 10 s | 434,887 | 5,862 | 1 solver step |
  | `bisector-feet` | 2.8 s | 86,743 | 2,779 | 1 solver step |
  | I.43, the complements | 1.6 s | 11,043 | 556 | 33 steps |
- **One round is the unit of cost.** On the windmill, checking Euclid's step "the angles at b are
  equal" by search takes 2 rounds and 990,000 units of work. Checking the triangles' equality
  after it takes 1 round and 375,000, though that step is a single rule application. The search
  matches every rule against every fact, whatever it is looking for.
- **Overlap.** On the windmill's two lemmas:
  - the common-supplement rule (`eq-angle d e f g h i: supp a b c d e f, supp a b c g h i`) does
    24% of the work, makes 691,036 matches for 16 new facts, and is in no proof. `supp` and
    `eq-angle` say the same thing twice: a supplement is an equal angle on the other side, which is
    how marks.ts already reads it, as classes with parity;
  - side-angle-side's two rules take 28%;
  - chapter 6's four similarity-by-turns rules take 19% on a lemma about areas.
- **Since chapter 7 (86c839c)** the windmill's two lemmas run past the 3 million budget altogether,
  and are out of the suite.
- **Which rules proofs use.** The book's proofs use 51 of the 77 live rules. Searching first with
  only those takes the book from 74.7 s to 18.4 s, but misses 2 lemmas. A heuristic for a first
  pass, sound with a fallback, not a cut.
- **Tried, and not the answer** (measured here or before):
  - **Semi-naive evaluation and relevance** (roadmap): the cost is many matches of different rule
    instances, not re-matching old facts, and every goal reaches nearly every rule.
  - **Adding every earlier lemma as a rule:** the windmill's second lemma did not finish in 30
    minutes. Citing only the two lemmas Euclid uses took it from 19.5 s to 4.8 s.
  - **A backward search guided by the figure:** to show a fact, take a rule that concludes it, and
    choose the rest of its points among those of the figure where its body holds. The isosceles
    triangle took one step. The windmill ran out of its budget at depth 2. Order and incidence
    facts hold of too many tuples, so the figure prunes too little.
- **Provenance is nearly free.** The prototype records a reason for every stored fact, union and
  merge. Its searches cost the same work and time as today's to within noise (the windmill 19.5 to
  21 s against 19 to 20 s).

## Design

### Principles

1. **A proof is a list of atoms.** It is the same stuff as a body: facts, in order, each following from
   those above it. A construction is atoms with new points.
2. **One proof object for three readers.** The engine finds proofs, the page shows them, the author
   may write them. Each is the same object, checked the same way.
3. **Search once, then replay.** A ✓ is backed by a proof that replays in microseconds. Search runs
   when there is no proof, or when the one there no longer holds.
4. **The logic never invents points; the plane makes them.** A construction step is shown the way a
   construction page is: the planner builds its new points with Euclid's moves, and the figures
   witness that they exist, as figures already witness that hypotheses are consistent.
5. **A proof never changes what a lemma means.** `? H: B` means what it meant. Its proof is how it is
   shown. Deleting the proof leaves the lemma's meaning, and perhaps its ✓, as they were.
6. **Lemmas are cited, never added wholesale.** A step may be shown by an earlier lemma. The search
   does not get every lemma as a rule (measured above).

### The proof object

A proof is a list of steps. Each step is a fact and its justification, the facts above it that it
uses being its premises. A justification is one of:
- **a rule**, naming its source line, so the page can link to the clause and its doc comment;
- **an earlier lemma**;
- **a solver step**, with its certificate: the equations combined and their integer coefficients
  ("adding turns: +1, −1");
- **structure**: an equality chain (the chains marks already show), or a symmetry.

Order and incidence steps are kept, but folded on the page:
- `collinear b x a` from `between`;
- an angle read along an arm;
- a triangle kept off a line by a crossing.

Euclid reads these off the figure. elements proves them, and shows them when asked. The extracted
proof of I.47's first half, folded:

```
1. eq-angle a b d f b c    the right angles at b, each with the angle a-b-c (fourth postulate; angle sums)
2. eq-lines a d f c        side-angle-side                                     02-angle:87
3. eq-area a b d f b c     congruent triangles                                 04-area:42
```

That is folded by hand here; the prototype does not fold. Unfolded it is 11 steps, which also say
where x, y and the arms come in.

**Built from provenance.**
- Every fact the store keeps, every union of tuples and every merge of points records the rule
  instance that made it, or the solver step with its certificate taken when the solver handed the
  fact back.
- A fact is explained by its record.
- A membership in a class is explained by the shortest path through recorded unions: the
  proof-forest method of proof-producing union-find, as in egg's explanations. Explanations are
  bounded by time, so they never go round a cycle.
- In the prototype this explains every book proof. Five do not yet replay, because a solver answer
  matched as a premise needs its certificate taken at the moment it was used. That is a small
  addition.

### Writing a proof: the syntax

A lemma's indented body may go on with `?` lines. The plain lines are its hypotheses, as now. The
`?` lines are its proof, read in order:

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

The lines mean this:
- **A step** is a claim to be shown from the hypotheses and the steps above it. `?` already means
  "to be shown". Here it is "shown next". Each step gets its own mark in the gutter (✓, ✗, ?), as
  lemmas do.
- **A construction** is a step whose atom names points not above it. Its new points are built by the
  planner from the points above, with Euclid's moves only (`plan(model, { euclid: true, free })`,
  which the roadmap already has). The step holds in every sampled figure, and its unfolding joins the
  facts with the new points named.
  - Logically this is existential elimination. The head does not mention d, so it follows from the
    hypotheses together with "there is a d such that…", and the plane, not the logic, answers for
    the "there is".
  - Where existence rests on the figure, the verdict says so: "follows, given its construction".
    That is Euclid's own standard, his gap included (when do two circles meet?).
- **The head** is the last step, shown from everything above.

That is the whole addition. Nothing else changes:
- no keyword and no citation syntax: the checker finds which rule or lemma gives each step, and the
  page shows it;
- comments carry the reasons, as prose;
- a lemma without `?` lines is what it was.

**Alternatives weighed:**
- **A `by` keyword, or a separate proof block:** clear, but a third form for one purpose.
- **Head-only points read as existential** (`? double b o d: distinct b o` as "there is a d"):
  this would make existence statements lemmas. But head-only points already mean "for any", and
  one lemma (chapter 3's `eq-turn a b e f c d e f`) uses that.
- **A `!` form for existence statements** (the roadmap's parked sketch): worth having only if the
  book wants to state Euclid's postulates as statements. The planner's moves already are the
  postulates.
- **A proof as a page**, its facts the figure and its ground `?` queries the steps: close to Euclid,
  but it proves a configuration, not a lemma.

### Checking a written proof

For each step, in order, the first of these that works:
1. **Already known**, by structure: a class, a symmetry, a solver.
2. **One rule or one earlier lemma.** The head is bound to the step and the body matched against
   what is known, with no search. This is microseconds:
   - the windmill's 11 extracted steps check this way in 5 ms;
   - the windmill's second lemma, written as Euclid's three steps citing its two lemmas and the
     shear, checks in 33 ms, against 19.5 s of search.
3. **A search** from the facts and steps so far, with a budget a step can afford. In Thales'
   converse above:
   - the two vertical angles (cited from chapter 2) and the two uses of side-angle-side are one
     rule each;
   - the rectangle's diagonals and the head each take a short search (1.2 s and 0.4 s);
   - the whole proof checks in 1.6 s.

   The prototype took the construction as given. Building it with Euclid's moves is what
   `plan(…, { euclid: true })` already does for pages: a circle about o through b, meeting b-o
   continued.

A step that fails gets ✗ or ?, with the reason (a figure that breaks it, or no proof found). The
lemma is ✓ if the steps above it hold and its head follows from them.

**Granularity is the open question,** and real proofs should settle it.
- Rule-sized steps check at once but are many: 11 for the windmill.
- Euclid-sized steps read well, but each hides the order and incidence bookkeeping, so the search
  does the work, about 1 to 5 s a step on the windmill.

Candidates for closing that bookkeeping cheaply, to be measured:
- a recognised structure for an angle read along its arm (rays), which would also cut the search's
  work;
- a closure under the order and incidence rules alone, before each step;
- facts the figure shows, offered as steps to accept, never used silently.

### Proofs on the page and in the cache

- **The reader sees the proof under each ✓ lemma, folded.**
  - Each step links to its rule, or to the lemma it cites, and that lemma's page.
  - A solver step reads as its sum.
  - The figure lights each step's points as the reader steps through, as hovering a `?` line
    already does for marks.
  - A proof also says what it rests on. The prototype's proof of chapter 3's midpoint of a
    parallelogram's diagonals goes through chapter 6's similar triangles: the question of what
    rests on what, answered from the content.
- **"Write it in"** puts the extracted proof's steps into the source as `?` lines: the metric steps,
  the bookkeeping left out. Then the proof is part of the book, read as prose, and checked in
  milliseconds.
- **A cache.** An extracted proof is kept, in the browser, keyed by the knowledge base's fingerprint
  and the lemma. A page checks by replaying it, and searches only if the replay fails or the
  hypotheses changed. Searching once, at 74 s for the book, then becomes replays, at 6 ms for all
  of them. A workbench user who edits a hypothesis usually keeps most of the old proof: replay what
  still holds, and search from there.

### The search, made cheaper

The workbench user wants a ✓ on their own assumptions, and for them the search still matters. In
order of what the measurements promise:
1. **Replay first** (above): most checks stop searching.
2. **Supplements as equal angles with a flip.**
   - Recognise from `supp`'s own rules that it is `eq-angle` with one block flipped, and keep
     angles in classes with parity, as marks.ts does. This is recognition by proof, as for every
     other structure.
   - The common-supplement rule then needs no firing: a quarter of the windmill's work, and the
     same overlap is in turns and their reversal.
3. **A first pass with the rules proofs use**, from statistics over extracted proofs, then
   everything. Sound, since the fallback keeps it complete. 4× on the book, measured, before any
   tuning.
4. **Cited lemmas per step**, never all of them.

Not recommended: the figure-guided backward search, as the core strategy (measured above). The
figure's real lever on power is the construction, not pruning.

## The path

Each step is useful alone.
1. **Proofs found, and shown.**
   - Provenance in `saturate`: reasons on facts, unions and merges, and solver certificates when
     handed back and when used.
   - Explanation, and the proof on the page, folded.
   - Test: every book proof explains and replays.
2. **The cache.** Replay before search, in the worker. Test: a page's second check of every lemma
   is a replay.
3. **Written proofs.** The parser accepts `?` lines in a lemma's body. The checker tries the three
   ways in order, with per-step verdicts, and builds constructions with Euclid's moves.
   - Test on *Beyond*: Thales' converse, the centroid (with the uniqueness step it needs) and the
     midline without its points named.
   - Then the windmill as Euclid writes it.
4. **The search, cheaper.** Signed classes for supplements, then the staged first pass.
5. **The bookkeeping question,** once a few proofs have been written: rays, an order and incidence
   closure, or the figure's facts as candidate steps.

Not in this design:
- **cases**: a proof is a natural home for them later, as steps under each case and a covering
  lemma;
- **sides**: their own theory (roadmap);
- **existence postulates as statements** (the `!` form above).
