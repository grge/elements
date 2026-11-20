# North star

Where the core of elements should go, from the review of November 2026. The core here is the
language, the book's structure, the logic engine, the construction planner and executor, the drawing
and the numerical solver. Read this before changing any of them, so that each fix moves towards one
design rather than around the last one.

The evidence is in two places: [review-notes.md](review-notes.md), on what writing the book showed,
and *What the review measured* at the end of this page. `scripts/bench.ts` reproduces the main numbers.
The [roadmap](roadmap.md) keeps the plan and takes its direction from here.

## In short

**The original design holds.**
- Horn clauses are still the whole meaning.
- Structure recognised by proof is still what makes the engine fast enough at all.
- The relation table is still the one place where the logic meets the figure.
- The figure still never silently disagrees.

In four chapters the language has not got in the way.

**What has not kept up is the machinery around that core, and its trouble has one shape: it flattens
the book.** The book is layered: chapters build on chapters and definitions on definitions,
propositions cite propositions, and constructions are used inside larger ones. The machinery reads
all of it as one flat set:

- every lemma is checked against every chapter's rules;
- every definition fires as a rule, whether or not anything can use what it recognises;
- every proof starts again from the axioms;
- every figure is planned over all its points, including its definitions' auxiliary points;
- every page's marks come from a closure of everything on the page.

So a page costs what the whole book has grown to, not what the page says. The book has begun to bend
to that cost. Pythagoras is stated by the squares' parts, guards are written for the join, and steps
are split into lemmas (review-notes.md).

**The North Star: the machinery follows the book's own structure, and each part does what it is best
at.**

- **The logic proves.** One evaluator, over primitives only, within the scope of the file a lemma is
  written in, building on what earlier files proved.
- **The figure witnesses.** A figure of the hypotheses shows they are consistent. Today a search
  establishes that instead, and the search takes four fifths of all checking time.
- **The geometry interprets.** A plug-in gives each primitive its meaning in the plane: how to test
  it, how to construct it and how to sample it. Then the planner and the solver know no relation by
  name.
- **The drawing shows what the author wrote.** It draws through the unfolding, with marks from the
  same closure the checks use.

None of this needs a rewrite or new syntax. *The path* below takes it in eight steps, each useful on
its own and each measured. The second step is small, and it should take the book's checks from about
135 s to about 30 s. That is an estimate: the search it replaces takes 105 of the 132 s in the
benchmark.

## What holds up

- **The language.** It has predicates over points, definitions recognised as if-and-only-if, and `?`
  lemmas whose meaning is a least model (language.md). The strains below are in what the machinery does
  with it.
- **Structure by proof.** Every sameness so far (points, segments, angles, directions, areas) was
  recognised as an equivalence from its own rules and implemented with union-find, with no engine
  change. This is what makes the closure affordable. The plain reference engine, which is semi-naive
  with argument indexes but has no structure, is 1.3 to 7 times slower than `saturate` on the five
  lemmas tried. Structure stays, and the evaluator below is built on it.
- **Unfolding.** One mechanism serves checking and drawing, with fresh names for a definition's
  auxiliary points.
- **The relation table** is the boundary between the logic and the figure, and every fact is checked
  on every frame.
- **The planner.** All 29 pages of defined predicates construct with ruler and compass. Planning takes
  at most a third of a second, and realising tens of milliseconds.
- **Numeric evidence and the five verdicts**, which make a ✓ something a reader can rely on.
- **The book's plan**: one new sameness per chapter, and neutral geometry first.

## Where the machinery flattens the book

| The book already says | The machinery does instead | Measured |
|---|---|---|
| Chapters build on earlier ones, and chapters 1 and 2 hold without the parallel postulate | One flat set of rules for every check | Chapter 1's searches for `false` take 17.0 s with the whole book and 2.1 s with its own rules. "Holds in hyperbolic geometry" is checked by nothing |
| A definition abbreviates its body | Its defining clause fires as a rule, recognising every construction the facts allow | The windmill's closure stores 22,456 facts with definitions and 3,622 without; all 64 verdicts are the same without them |
| A proposition cites earlier ones | Every proof starts from the axioms | Pythagoras with whole squares needs five times the budget (review-notes.md) |
| A construction is a step in a larger one | The planner searches the orders of every point | Search time about doubles with each point (2.7 s at 18). At 19 the greedy fallback fails on a figure the search builds |
| A figure of the hypotheses is a model of them | Consistency is looked for by a second full closure, from scratch | 80% of checking time; 12 lemmas' ✓ rest on that search running out of budget |
| A page states one proposition | Marks come from a closure of everything on the page, for every member of every class | `rectangle-to-square` takes 43.9 s of closure for its marks, and draws 46 arcs, 27 ticks and 16 arrows |

Four findings are not about flattening.

- **The evaluator is naive.** This confirms causes 1 to 3 in review-notes.md, on the whole book. Of
  4.96 million derivations, 9.9% add a fact. On the windmill's search for `false`, joins take 9.9 of
  the 10.8 s over only three rounds. Each of side-angle-side's two rules takes 2 s for under 4,000
  matches, about half a millisecond a match. That is most likely the cost of scanning where an index
  would look up.
- **Names have leaked into the geometry.**
  - `lociFor` and `countEquations` in `construction.ts` switch on relation names.
  - The relation table mixes the model (`read`, `holds`, `residual`) with the depiction (`depicted`,
    `draw`). It holds `circle` and `right`, which are defined, only to draw them.
- **Two samplers disagree.** Evidence samples with `configurations`, which never varies branches,
  while pages use `realise`, which does. So the windmill's page constructs, but its two lemmas get no
  sampled figure.
- **Layers point the wrong way in one place.** `kb/verdict.ts` imports the editor's `EditorMark` from
  `components/CodeEditor.vue` and `Evidence` from `geometry/`, so the logic depends on the interface.
  A verdict weighs a proof against evidence, so it belongs above both.

## The North Star

### Principles

The roadmap's four principles stand unchanged:
- keep the engine general;
- prefer conventions over syntax;
- the rules are the meaning;
- the figure never silently disagrees with the facts.

This review adds four more.

- **Follow the book's structure.** What the book builds on, the machinery builds on:
  - a lemma is checked in the scope of the files up to its own;
  - a proved lemma is a rule for what comes after it;
  - a construction is planned once and used as a step;
  - a figure is drawn through its unfolding.

  A page should cost what the page says, not what the book says.
- **The logic proves; the figure witnesses.** Entailment is the logic's question; consistency is the
  model's. A lemma whose goal is derived and whose hypotheses have a figure is ✓, with no search for
  `false`. The logic looks for `false` only when no figure can be found. Each checks the other: every
  fact the closure derives must hold in the figure, or the page raises the alarm.
- **Primitives are the interface.** Axioms speak only of primitives, the open predicates. A
  definition abbreviates a conjunction of them and is never a rule of the closure. A geometry
  interprets primitives and nothing else. Defined relations are for the reader: the drawing may know
  them, but the engine and the model never need to.
- **One evaluator, in stages.** One engine computes every closure: checks, marks, and plans from
  proofs. It is semi-naive over the union-find store, and a closure grows in stages:
  1. a scope's compiled rules;
  2. the stated facts;
  3. what the figure shows.

  Each fact keeps its stage, so what was stated and what was assumed are never confused. The
  reference closure stays, as the tests' oracle.

### The shape it gives the system

```
 the book: .geo files in order             a file's scope: its clauses and the files before it
      │  parse · recognise definitions, and structure per scope · ✓ lemmas become rules
      ▼
 one evaluator, over primitives            semi-naive on the union-find store, indexed
      │  one closure per page, in stages:   scope → stated facts → what the figure shows
      │  goals and marks are queries:       a defined one is matched by its unfolding
      ▼                                     ▲
 a geometry, a plug-in per primitive        │  witness: a figure of the hypotheses
      │  reading · holds and residual · loci and the conditions they impose · (polynomials)
      │  plan, composed by definition → sample → execute; the solver for what is left
      ▼
 depiction, per written relation           draw · marks · its turn in the unfolding
```

**The book: files as modules.** A book is an ordered list of `.geo` files. Each file sees itself and
the files before it, which is its *scope*. This is a convention, not syntax, and it is how the book
already reads.

- **Structure per scope.** This matters at once. `parallel` is an equivalence only from I.30 on, and
  I.30 is the postulate. In the neutral scope it must stay a symmetric relation, as it is in
  hyperbolic geometry. Today the whole book's union-find applies it everywhere.
- **The postulate gets a file of its own.** Chapter 3 is split at its heading. Then the neutral book is
  a prefix of files, and a sibling book shares it unchanged.
- **Each ✓ reports the earliest scope it holds in.** Two things then become checked facts rather than
  comments. One is the claim that chapters 1 and 2 hold in hyperbolic geometry. The other is I.28's
  note that its proofs "pass through I.30 only to call the line f-x by the name f-d".
- **No axiom mentions a defined predicate.** This is checked, and it is true of all 105 axioms today.
  An axiom that breaks it gets a warning on its line.

**The engine: one evaluator.**

- **Semi-naive over the union-find store.** After merges, rebuild: re-canonicalise the tuples a merge
  touched, and treat the ones that changed as new (egglog's design). Index argument positions and
  class membership. Then a bound atom is a lookup, and a partly bound atom of an equivalence visits
  only the classes that can match. Count the budget in facts added, not in derivations.
- **Relevance.** Fire only rules that can reach what is asked: the goal, `false` or the marks' queries.
  The predicate-level graph is the one `mayDerive` already builds.
- **Definitions as abbreviations.**
  - Hypotheses unfold, as now.
  - A defined goal is a query: its unfolding is matched against the store, with its auxiliary points
    existential.
  - Defining clauses never fire.

  Tried on the book: the same 64 verdicts, with 3 to 6 times fewer facts in the heaviest runs and
  27 times fewer at the median. This replaces the roadmap's "use definitions in both directions":
  with nothing defined in the store, there is no direction to choose.
- **Lemmas as rules.**
  - **Which lemmas.** A derived lemma becomes a rule for the lemmas after it: in later files, and
    below it in its own file. That is Euclid's order, and it cannot loop.
  - **The meaning is unchanged.** A proved lemma is an admissible rule: it adds no fact the axioms do
    not already give. So the least model is unchanged, and the rules are still the meaning.
  - **Defined heads.** A defined head contributes the conjuncts of its unfolding that need no
    auxiliary point.
- **One closure per page.**
  - It is extended as hypotheses, figure facts and queries arrive, rather than each worker saturating
    from scratch.
  - One unfolding per page serves the check, the figure and the marks, so all three name the same
    points.
  - The worker keeps the scope's compiled rules, rather than receiving every rule with every request.

**Verdicts: a proof and a witness.**

| Derived | A figure of the hypotheses | In the figures | Verdict |
|---|---|---|---|
| yes | yes | the claim holds | ✓ |
| yes | yes | the claim, or any derived fact, fails | ! an axiom is false, or a bug |
| yes | none found | | search for `false`: ⊥ if found; ✓ if the closure completes; "follows; consistency not shown" if the budget runs out |
| no | yes | the claim fails | ✗ |
| no | yes | the claim holds | ? probably true |
| no | none found | | ? with the reason, or ⊥ |

The third row is what today's ✓ means for twelve lemmas, without saying so. After step 2 of the
path those twelve have witnesses, and the row is left for lemmas that have none.

A figure is a witness only if every hypothesis holds in it, whether the model reads that hypothesis
or not (`distinct`, `triangle`). A hypothesis that cannot be evaluated means no witness. A
constructed figure is a witness up to rounding. A solved figure is a weaker witness, and the verdict
says so.

**The geometry: a plug-in, and a separate depiction.** The model table holds primitives only. For each
primitive it gives:
- its reading by the model;
- the numeric lens: `holds`, and a `residual` with its gradient;
- the constructive lens: the loci it gives a point once others are placed, and how many conditions it
  imposes;
- later, the algebraic lens: its polynomials.

A geometry also gives its kinds of locus and how they meet: lines and circles in Euclid's plane, arcs
and circles in the Poincaré disk. The planner, the sampler and the solver ask the table and switch on
nothing.

Counting conditions is the plug-in's job. Today the planner counts two loci as two conditions unless
it knows otherwise. It knows about two lines through one placed point. It does not know about two
parallels to one line, which is why Playfair's hypotheses never draw (*What the review measured*).
The principled count is made on a witness: the rank of the conditions at a sampled configuration.
This is the witness method of Michelucci and Foufou, which architecture.md already cites for
leftover equations.

Depiction is a second table, keyed by any relation an author writes, defined or not. It says how the
relation draws, what marks it makes, and its *turn* in the bottom-up drawing (roadmap, *what a
construction draws*). `circle` and `right` move there.

**Construction: plans that compose.**

- **A definition is planned once for each mode** (which of its points are given) and used as a step.
  The search then runs over a page's own points and its definitions' steps, not over every auxiliary
  point. The search stays flat only inside a definition, or where outside facts tie a definition's
  points together. This removes the cliff at 18 points instead of moving it.
- **One sampler** serves pages and evidence. It searches branches and slider directions
  systematically, and chooses a branch as soon as an order fact can decide it. Today `realise`
  retries at random after 40 failures.
- **Loci come from the plug-in**, including a perpendicular locus for `right`. The plug-in offers that
  locus as a recognised pattern of `right`'s unfolding, so the planner still sees only primitives. It
  is checked like every fact.
- **The sampler prefers figures that read well**: spread out, with no slivers (review-notes.md).

**The drawing: through the unfolding, from the shared closure.**

- **Marks come from the page's staged closure.** A mark that needs the figure's stage (distinct
  names as distinct points) is known to need it. So the difference between the marks and the checker
  becomes something the page can say, not a silent difference.
- **The same difference offers candidate hypotheses.** A lemma that fails only for want of facts the
  figure shows (distinctness now, sides later) is told which facts. They are never used as proof.
- **A page's statement chooses what is marked first**, and its sub-constructions recede.

**The solver stays as the fallback.**

- It reads the plug-in's residuals.
- It solves only what a plan cannot construct (the roadmap's hybrid figures).
- It warm-starts from several of the sampler's attempts.

No book page needs it today, which is as it should be: it is there for the author's experiments.

## The path

Every step keeps all 64 verdicts, or makes them more honest. Each is measured with `scripts/bench.ts`
against the baseline below, and each is worth having even if the next step never comes. Expected
effects are estimates unless they are marked as measured.

1. **Baseline. Small.** The benchmark and the README's corrected test time came with this page.
   Still to do:
   - Move `verdict.ts` out of `kb/`.
   - Let the worker keep a snapshot of the rules.
2. **One sampler, then witnesses. Small to medium.**
   - Fold `configurations` into `realise`'s search.
   - Fix the count for parallel loci (Playfair).
   - Have the checker take evidence's figures first. Evidence already samples every lemma, at about
     6 ms each. Skip the search for `false` whenever a figure exists.
   - Check every derived fact against the figure.

   Expected: the checks fall from about 135 s to about 30 s, and every lemma in the book is
   witnessed, so no ✓ rests on a budget. Today 63 lemmas are witnessed by one sampler or the other,
   and Playfair's waits on the fix.
3. **Scopes. Small.**
   - Check each lemma in its scope, and recognise structure per scope.
   - Split the postulate into its own file.
   - Report the earliest scope of each ✓.

   Measured: chapter 1's searches for `false` fall from 17.0 s to 2.1 s, though step 2 removes most
   of them anyway. The gain here is meaning.
4. **Definitions as abbreviations. Small.**
   - Stop firing defining clauses, and answer defined goals as queries.
   - Check that axioms mention only primitives.

   Measured: the same 64 verdicts, with 3 to 6 times fewer stored facts in the heaviest closures and
   27 times fewer at the median. Time falls only a tenth, because the joins over primitives remain.
5. **The evaluator. The large piece.**
   - Semi-naive with rebuild, indexes, a budget in facts added, and relevance.
   - One engine for checks, marks and structure proofs.

   Targets, to be measured rather than promised: the goal phase falls from 26 s to a few seconds,
   and Pythagoras with whole squares proves within the default budget. Do it after step 2, so that it
   is measured on the work that remains.
6. **One closure per page, in stages. Needs steps 4 and 5.**
   - Marks come from it.
   - The figure's facts form their own stage, and the page shows what rests on them.
   - Candidate hypotheses.

   Target: marks in under a second on every page. `rectangle-to-square` takes 43.9 s today.
7. **The geometry plug-in. Can run beside steps 5 and 6.**
   - Put loci, condition counts, residuals and the sampler behind per-primitive entries.
   - Split off the depiction table.

   This comes before the hyperbolic book and the algebraic lens.
8. **Plans that compose, then lemmas as rules. Needs steps 3 to 5 and 7.**
   - Plan per definition and mode.
   - Make ✓ lemmas into rules for later lemmas.

   This removes the 18-point cliff, and lets Pythagoras be stated with whole squares.

After that, undo what was done only for speed. That means the statements by parts, and the guards
whose only reason was the join, each rechecked. Then the mathematics (*Open decisions*).

## What to avoid

- **Relation names in the engine, the planner, the sampler or the solver.** Names belong in the book
  and in the two tables.
- **A second engine.** The reference closure is the tests' oracle, not a code path.
- **Speed bought with meaning.** No guard whose reason a reader cannot see, and no budget presented as
  a proof.
- **Piecemeal tuning of the naive loop.** Replace the evaluator once, measured, not rule by rule.
- **Figure facts as proof.** What the figure shows is offered as a hypothesis, never used silently.
- **New syntax** for scopes, sides, sums or cases before a convention has been tried.

## Open decisions

The North Star makes each of these easier, and decides none of them.

- **Cases.** Horn clauses cannot split cases, and the least-model meaning depends on that. Several
  things wait on case splits:
  - the circumcentre;
  - the shear and the median, which are axioms because Euclid's proofs split on where the apexes
    fall;
  - every trivial case that a `distinct` hypothesis excludes.

  There are two ways forward.
  - Stay with Horn clauses, and state the cases as lemmas joined by a covering one.
  - Extend to coherent logic: disjunctions and existentials in heads, proved by splitting cases.
    Geometric axioms naturally fall into this fragment, and provers such as ArgoCLP use it. But a
    lemma's meaning would then no longer be one least model.

  This is the one fork that changes what a lemma means, so take it deliberately or not at all.
- **Sides.** There are two options.
  - A file of their own: `same-side` and `opposite-side`, with the diagrammatic axioms of system E.
    "On the same side of a line" is a sameness with two classes, so it fits the book's plan as a
    chapter's sameness.
  - Spreads or full angles, which the roadmap suggests trying first.

  Either way, candidate hypotheses meanwhile give the author the side facts the figure shows.
- **Sums.** The common notions' shape is written three times. It could be recognised as making a
  relation additive: proven from the rules as equivalences are, then solved by linear arithmetic over
  the relation's classes, as equivalences are by union-find. II.14, I.32 and I.48 wait on it, and so
  does a hyperbolic area chapter (area as angle defect).
- **What the book is for.** It could be a proof-checked Euclid. Then the axioms taken "for now" are
  debts to pay as sides, sums and cases arrive: side-side-side, angle-side-angle, the shear, the median,
  and I.29 with the postulate. Or it could be Euclid's content in a form an engine can carry, and then
  they are fine as they are. Keeping them in one list would make either choice visible.
- **Hidden points.** A definition's auxiliary points cannot be named from outside, so lemmas about
  them write the definition out. For example, the parallelogram is written out twice, to name where
  its diagonals cross. The choice is between wider signatures where lemmas need the point, and leaving
  things as they are.

## What the review measured

**The book as measured:**
- four files and 136 rules: 105 axioms, and 31 clauses for defined predicates (definitions and the
  theorems about them);
- structure makes 56 of the 136 rules redundant;
- 64 lemmas.

**How it was measured:** Node 22 on four CPUs, November 2026, at commit 6c9913b. Times vary by about a
tenth between runs; counts do not. `scripts/bench.ts` reproduces the checking table and the pages.
The other figures come from one-off probes, each described where it appears.

**Checking.** The real checker takes 134.7 s and proves all 64 lemmas. The phases come from the
benchmark (131.6 s in all). The benchmark always runs the search for `false` after a proof, whereas
the checker skips it when `false` is unreachable. That is why chapter 1's columns add up to more than
its checker time.

| Chapter | Lemmas | Checker | Goal | Search for `false` | Out of budget |
|---|---|---|---|---|---|
| 1, length | 23 | 13.7 s | 0.2 s | 17.0 s | 2: `march`'s order |
| 2, angle | 14 | 7.9 s | 2.1 s | 5.7 s | 0 |
| 3, direction | 17 | 53.5 s | 10.0 s | 40.9 s | 5: I.28's first converse, two of the rectangle, two of the square |
| 4, area | 10 | 59.6 s | 13.9 s | 41.7 s | 5: I.35, both windmill lemmas, f-b-c as half the square, the triangle to a rectangle |
| all | 64 | 134.7 s | 26.2 s | 105.4 s | 12 |

The heaviest lemmas, as goal phase plus search for `false`:

| Lemma | Goal | Search for `false` |
|---|---|---|
| the windmill's `eq-area a b d f b c` | 5.9 s | 9.6 s |
| the windmill's `eq-area a b f l b d` | 5.7 s | 9.5 s |
| the rectangle's diagonals | 4.1 s | 7.1 s |
| the rectangle's angle | 0.65 s | 6.7 s |
| I.35 | 0.65 s | 6.3 s |

There were 4,964,030 derivations in all, of which 489,873 (9.9%) added a fact.

**Scopes** (`--scoped`). 119.6 s in all, and all 64 lemmas still proved.
- Chapter 1's searches for `false` take 2.1 s instead of 17.0 s, and `march`'s two no longer run out
  of budget.
- Chapters 3 and 4 take about the same, since they use nearly every rule anyway.

**The windmill's search for `false`, rule by rule.**
- It took 10.8 s and ran out of budget in its third round.
- It stored 22,456 facts.
- It walked an equivalence's classes with the block not fully bound 3,457 times.
- Joins took 9.9 s.

| Rule | Time | Matches |
|---|---|---|
| side-angle-side, its third side | 2,155 ms | 3,884 |
| side-angle-side, its angle | 2,042 ms | 3,892 |
| angle-side-angle | 1,134 ms | 534 |
| angles taken away | 810 ms | 5,466 |
| angles added | 721 ms | 5,078 |
| supplements: substitution | 381 ms | 155,360 |
| the definition of a line-line intersection | 378 ms | 35,040 |
| a common supplement | 300 ms | 88,704 |

**Definitions as abbreviations.** The probe removed the clauses for defined predicates from the
closure, except `false`'s, and answered defined goals by matching their unfolding.
- All 64 verdicts agree.
- Stored facts fall sharply. In the heaviest closures they fall 3 to 6 times: the windmill's from
  22,456 to 3,622, and the rectangle's from 14,897 to 4,766. In others the fall is far greater: the
  hexagon's from 11,129 to 109, and `vesica`'s from 3,413 to 59. At the median the fall is 27 times.
- Time for the full closures falls only from 108.3 s to 96.6 s.

**Structure against semi-naive.** The reference `forwardClosure` (semi-naive with argument indexes)
against `saturate` (naive, with structure), in the goal phase:

| Lemma | `saturate` | reference |
|---|---|---|
| the equilateral triangle's angles | 18 ms | 23 ms |
| `bisect-angle` | 107 ms | 570 ms |
| the midpoint, constructed | 503 ms | 1,183 ms |
| the parallelogram's opposite sides | 194 ms | 1,399 ms |
| the parallelogram's halves | 91 ms | 584 ms |

**Pages** (`pages`). All 29 defined predicates construct, and none falls back to the solver. Planning
takes at most a third of a second (`rectangle-to-square`, 13 points), and realising tens of
milliseconds. The closure that merges marks is the slowest thing on any page:

| Page | Marks closure |
|---|---|
| `rectangle-to-square` | 43.9 s |
| `windmill` | 12.3 s |
| `triangle-to-rectangle` | 7.7 s |
| `compass-midpoint` | 4.2 s |
| `cut` | 4.2 s |
| `square` | 4.1 s |
| `march` | 3.9 s |

**The planner's growth.** The probe added to a page until it passed 18 points.

| Figure | Points | Plan | |
|---|---|---|---|
| `windmill` | 10 | 36 ms | constructed |
| `windmill` and the square on a-b | 13 | 198 ms | constructed |
| `windmill` and both squares | 16 | 770 ms | constructed |
| `rectangle-to-square` and four equilateral triangles | 17 | 1,654 ms | constructed |
| … and a fifth | 18 | 2,736 ms | constructed |
| … and a sixth, planned greedily | 19 | 3 ms | not constructed: two equations unused |

**Witnesses.** Evidence finds sampled figures of the hypotheses for 59 of the 64 lemmas, in at most
57 ms each. The other five:

- **I.11's `right a c d`.** Its hypotheses construct, in 24 of 24 samples. Evidence stops only because
  the claim brings in a point of its own.
- **I.33, and both windmill lemmas.** `realise` constructs them. `configurations` finds nothing,
  because it never varies branches.
- **Playfair's `collinear c d e: parallel a b c d, parallel a b c e`.** Neither sampler draws it. The
  plan takes a, b, d and e as inputs, and places c where the parallels to a-b through d and through e
  meet. They never meet: two parallels to one line are one condition, not two.

So with one sampler and that count fixed, every lemma in the book would have a witness.
