# Roadmap

Open problems and ideas, roughly in order of value within each section. See
[architecture.md](architecture.md) for how things work now.

## Principles

- **Keep the engine general.** No geometry in the inference engine; geometry lives in `.geo` files and
  in the drawing layer. Extending to other geometries should mean new rules and a new drawing layer.
- **Prefer conventions over syntax.** When something seems to need new syntax, look first for a
  convention the engine can recognise and verify, and make the recognised status visible.
- **The rules are the meaning.** Anything the engine builds in (union-find, canonical forms) must be
  something it has proven from the rules.
- **The figure never silently disagrees with the facts.** It either satisfies every fact or says
  which step fails and why.

## Towards basically done

The plan as of November 2026, in order. The first milestone is **demo-ready**: steps 1 to 3.

1. **Correctness.** Done in November 2026: a predicate's page draws its signature, ticks are as
   bold as Byrne's and mark circles' radii too, the solver switch is gone, and the figure draws
   the construction it used, in layers by depth (see *Construction and drawing*).
2. **A careful pass over everything.** Done in November 2026: dead code removed, language.md
   rewritten, the two March proposals folded into this page, the book's comments brought up to date.
   The structural findings are under *Code structure* below.
3. **The editor.** Wrapping that suits the page: a hanging indent, and no breaks inside a name (today
   a comment breaks `c-d` across lines). Then the smaller polish.
4. **More than one page, and a more playful layout**, in the same aesthetic: a front page, an
   explainer (the language, unfolding, the planner and the checker, each shown with live figures) and
   help. Sketched before built; [the Plates concept](plates-concept/REDESIGN_CONCEPT.md) is a starting
   point, and design.md's entry page is the earlier idea.
5. **Chapters 2 onwards**, as [book.md](book.md) plans them. Writing them is also the test of all the
   above.

## Logic

- **Honest verdicts.** (Contradictory hypotheses are already reported as vacuous, `⊥`.) Report a check
  that ran out of budget as *unknown*, not ✗. Then add numeric
  evidence: evaluate a lemma on sampled configurations of its hypotheses' construction, giving
  *proven* ✓, *false* with a counterexample figure, *probably true* (holds in every sample, not proven),
  and an alarm when something proven fails numerically (a bug or a false axiom).
- **Proof traces**: why a ✓ holds, as a derivation tree.
- **Use definitions in both directions during forward chaining** where no new objects are needed
  (`eq-triangle a b c` ⇒ `circle a b c`), not only when unfolding hypotheses.
- **Lemma compilation**: add verified lemmas as rules. Safe for defined predicates already (a clause
  that follows from the definition cannot change its meaning).
- **Show the recognised status** of each predicate in the UI: defined (by which clause) or open, and any
  recognised equivalence, substitution or symmetry.
- **Replace the `__object__` bootstrap** the checker uses to introduce a lemma's head-only objects with
  an explicit initial universe.
- **Performance for larger knowledge bases**: semi-naive evaluation and argument indexes in
  `saturate.ts` (lemmas with `distinct` facts take 0.3–0.5 s, mostly the full closure that rules out a
  contradiction); keep a knowledge-base snapshot in the worker instead of re-sending rules per request.
- **Case splits**, so that facts true in every configuration need no `distinct` hypothesis.
- One arity per predicate name is what the parser enforces today. `foo/1` beside `foo/2` would need
  a reason first.

## Construction and drawing

- **Use inferred facts when drawing**: feed the forward closure (not only the unfolded facts) to the
  planner, so derived facts become loci or checks.
- ~~Draw the construction actually used~~ (November 2026): the planner's loci the figure lacks are
  drawn one level below the point they place, and every element is drawn thinner and fainter the
  more deeply nested the definition it comes from. Next, from the March 2026 progressive rendering
  proposal: let the reader choose how many levels to show, and weight elements by role as well as
  depth (a construction's key properties, such as its equal sides, in front of its guide circles).
- **Continuity near tangencies**: nearest-branch tracking can jump; consider complex tracing.
- **Order facts on circles** restrict sliders to arcs (today they are only checked).
- **Hybrid figures**: construct what can be constructed and solve only the remaining part numerically,
  instead of falling back to the solver for the whole figure.
- **A drawing-layer boundary** for other geometries: the drawable relations, their loci, intersections
  and numeric residuals as a plug-in.
- **Annotations from proven facts**: segments a figure *states* equal get tick marks already; extend
  this to segments *proven* equal.
- Step-by-step playback of a construction; undo for dragging.
- Figures above 18 points use a greedy order; a bounded search would do better.

## Interface

See [design.md](design.md#designed-not-yet-built) for the designed-but-not-built pieces: the tether
between code and figure, reading and editing modes, text that makes room for the figure, a better index,
predicate views with lemma layers, the boffin panel and an entry page. Smaller items:

- Save the scratchpad to the library in one step.
- Hover a predicate name for its arity, provenance and status.
- Inline proof marks in reading mode.

## Code structure

From the November 2026 review. The layering (language → kb → geometry → composables → views) holds
up, and nothing calls for a rewrite. Worth doing when the code next changes nearby:

- **One geometry model.** Segment classes are built three times (`canonicalization.ts`,
  `construction.ts`'s `buildModel`, `scene.ts`'s ticks) and collinear groups twice. The planner's
  `ConstructionModel` is now the primary model; `GeometryProblem` mainly serves the numerical
  fallback. Derive both from one pass, or draw from the model and keep `GeometryProblem` for the
  solver alone.
- **`PageView.vue` holds the whole page** (themes, layout, contents, the steps in words). Split it when
  step 4 above reshapes the page, not before.
- **The worker gets every rule with every request** (also under *Logic*, performance).

## Earlier proposals

Two proposals from March 2026, folded into this page and removed (`git show d2efd7a:docs/proposals/`
has them): *progressive rendering* (above, under *Construction and drawing*) and *embedded lemmas*,
which attached a construction's properties to its definition with `?` lines in the body. The page
already shows each predicate with the lemmas about it, by convention rather than syntax, which was
most of that proposal's point.
