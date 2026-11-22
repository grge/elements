# The engine proposal: a review

A review of [engine.md](engine.md) as it stood at 6362555 (November 2026), both halves. It says what
to adopt, what to change, and what the proposal still leaves open. Nothing here is measured beyond
what engine.md and [review-notes.md](review-notes.md) measured.

## In short

- **Adopt both halves.** The diagnosis is measured rather than guessed, the scoping is honest, and
  the negative results (semi-naive evaluation, relevance, backward search, rays, bigger budgets) will
  stop us trying them again.
- **Change one thing: the order of the path.** Build the proof object and the step checker against
  an interface, before the new core, not after it. Proofs are where the power is; the core is speed,
  and its solver half is the least certain part of the plan.
- **Settle three questions before written proofs:** constructed points under the distinct-names
  convention (a soundness question), which moves a construction may use, and how a book adopts a
  proved lemma as a rule.
- **Next:** land the three changes, bring the windmill's two tests back into the suite, then write
  the design for books choosing their tools.

## Part 1: proofs as objects

**What is right.**
- *The proofs are small; the search is not.* 518 proof steps against 1.58 million matches, and
  replay at 6 ms against 74 s of search, settle the direction: a kept proof turns a search into a
  check.
- *The logic never invents points; the plane makes them.* This is the cleanest answer yet to the
  wall the stress tests kept meeting. Forward chaining cannot reach a point no one named. A
  construction read as existential elimination, the planner answering "there is a d", splits the
  work between the logic and the figure where it belongs. It also gives "every plane word
  constructs" a second use: constructions in proofs.
- *One object for three readers* (found, shown, written) is "the page is the product" applied to
  the demonstration. It gives elements Euclid's two missing parts.
- *The syntax.* `?` lines in a body add no form, and principle 5 (a proof never changes what a
  lemma means) is the right guard.

**Settled since the first draft.** Two points of an earlier reading are now in engine.md's open
questions: citing rules by content, so a kept proof survives edits elsewhere; and how big a written
step may be. For the second, one candidate is worth naming as a checking method, not only as a
speed-up: a step is "one rule, after closing order and incidence". Bind the step's head, and let only
the bookkeeping atoms (`between`, `collinear`, `distinct`, `triangle`) be met by a closure under the
order and incidence rules alone. That would check Euclid-sized steps at nearly the cost of
rule-sized ones.

**Still open.**
1. **Constructed points and the distinct-names convention.** The checker takes different names for
   different points. If a constructed d inherits that, a construction that falls on a named point in
   every figure (by some theorem) is a contradiction, and from it anything follows. So a constructed
   point is granted apartness only where the samples show it generically apart from every other
   point, as figures already witness that hypotheses are consistent. This is close to engine.md's
   "is it determined", but not the same question: a determined point can still coincide.
2. **Constructions that may not exist.** "Follows, given its construction" should distinguish:
   - a line through a circle's centre always meets it (`double` is unconditional);
   - two circles meet only sometimes.

   The planner can tell these apart from the loci's shapes. Then the verdict is plain where Euclid
   is safe, and hedged only where his own gap is.
3. **Euclid's moves are too few.** `plan(…, { euclid: true })` has the postulates only. A midpoint is
   already I.10, a problem and not a move. Thales' converse works because `double` needs only
   postulates; the centroid and most of *Beyond the book* will not. A construction step should be
   allowed the book's earned tools: the postulates and the constructions shown on earlier pages.
4. **Proved lemmas as tools.** Citing lemmas per step serves written proofs. But a cold-start
   search cannot use a proved III.21 unless it stays an axiom, and Euclid uses his propositions
   later. engine.md's finding gives the mechanism (lemmas join as rules over primitives, after
   definitions are unfolded); what is missing is how a book says "this proved lemma is now a tool".
   The ledger's axioms that are Euclid's theorems ([consolidation.md](consolidation.md)) are the
   test bed: write their proofs, then demote each axiom to a proved lemma the book adopts.
5. **A misspelled point** in a `?` line silently becomes a construction. The gutter should say
   "constructs x" plainly.

Points 3 and 4 are both "books choose their tools". That design now answers questions for
construction pages and for proofs alike, so it is a prerequisite for written proofs, not a side
project.

## Part 2: cold-start search

**The three changes: yes, first.** Same closures, the book 211 s to 48 s, all 99 lemmas proved, the
windmill back inside the 3 million budget (so its two skipped tests return). The caution on the head
check (exact only when every head variable is pinned to one point) is the one to carry into the
build.

**Signed classes may give more than speed.** An angle in an odd class equals its own supplement:
it is a right angle. So `right` becomes structural, the odd classes. Turns and their reversal are the
same shape: a turn equal to its own reverse is a quarter turn, or nothing. If both are signed
classes, the ledger's "a quarter turn cannot conclude `right`" may come down to one bridge between
odd classes, and that item blocks two of *Beyond*'s nine. A conjecture, to be tried when the flip
structure is designed (engine.md already asks about "an equivalence and its image under an
involution"). `ParityUnionFind` (src/geometry/classes.ts) is the data structure.

**The new core: convincing as a spike.** Identical closures, agreeing verdicts, 10 to 12×, and the
unmeasured 30 to 50× labelled as an estimate. Two risks:
- **The solvers.** A solver atom answered in the middle of a join, and facts fed back between
  rounds, are the subtle semantics, and chapters 3 and 5 to 7 live there. The spike had none.
  Keeping `saturate.ts` as the oracle, every closure compared, is the right net.
- **The budget's unit.** When the core lands, "work" changes meaning, and any verdict near the
  budget can flip. Fix the unit first, probably matches, which are deterministic and mean the same
  in both engines. Then the oracle compares verdicts as well as closures.

"What speed does not buy" is the most useful paragraph in the document: three of *Beyond*'s lemmas
reach a complete closure without their goal. It keeps a faster engine from being mistaken for a
stronger one.

## The path, reordered

engine.md builds the core (step 2) before proofs (steps 3 to 5), so provenance is written once, in
the core. But most of the proof work does not depend on the engine: the proof object, replay, and a
written step checked as one rule with its head bound (a lookup) can all be built against an
interface. Only provenance is engine-specific, and the prototype showed it costs nothing in
`saturate.ts`; doing it there and again in the core is a small price for not blocking.

1. **The three changes** in `saturate.ts` (from `scripts/prototypes/cold-start.patch`), signed
   classes recognised from `supp`'s rules, the relevance trap handled. The windmill's tests return.
2. **The tools design** (points 3 and 4 above), with the construction questions (points 1 and 2).
3. **The proof object and step checker** against an interface; provenance in `saturate.ts`; proofs
   shown and replayed.
4. **Written proofs:** Thales' converse, then the nine-point circle.
5. **The budget's unit fixed, then the new core,** with provenance a requirement from the start and
   `saturate.ts` as the oracle.
