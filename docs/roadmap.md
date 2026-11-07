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
   bold as Byrne's and mark circles' radii too, and the solver switch is gone. One decision left:
   - Whether to draw the construction actually used (see *Construction and drawing*): the steps
     say "circle about m with radius am", and the figure does not show it.
2. **A careful pass over everything**, file by file: code, docs and the book's comments. Looking for
   dead paths, comments that over-explain, inconsistent names, and anything that claims more than it
   does.
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
- Open question: one arity per predicate name, or `foo/1` distinct from `foo/2`?

## Construction and drawing

- **Use inferred facts when drawing**: feed the forward closure (not only the unfolded facts) to the
  planner, so derived facts become loci or checks.
- **Draw the construction actually used**: the circles of a compass transfer or of a bisector, faint.
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

## Proposals

Written earlier, not implemented, worth revisiting in the light of the principles above:

- [Embedded lemmas](proposals/embedded-lemmas.md): attach a construction's key properties to its
  definition. As written it adds syntax.
- [Progressive rendering](proposals/progressive-rendering.md): weight elements by role and nesting
  depth so complex figures show their essentials first.
