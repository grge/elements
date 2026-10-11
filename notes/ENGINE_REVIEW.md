# Engine review: inference and construction

Date: 2026-10-12

A review of how the engine uses backward and forward chaining for proving and for drawing,
whether that is sound, where the construction pipeline has gaps, and what a more principled
design that stays general (not tied to these primitives, or to Euclidean geometry) could look like.

Every finding below was reproduced, not inferred from reading. Most reproductions are a few
lines you can paste into the scratchpad.

## Decisions and progress

* **No new syntax.** Definitions and equality structure are recognised, not declared (section 4 now
  describes the adopted conventions). A lone one-way rule read as a definition (`tall x: giraffe x`)
  is an ontology error by the knowledge base's author: the language's semantics is if-and-only-if.
* **Done:** F1/F2 (definitions recognised by the completion rule, see LANGUAGE.md "Definitions"),
  F3 (auxiliary objects renamed apart), F5 (the native engine is generic: structure is proven from
  the rules in core.geo, no predicate names in the engine; the `PRIMITIVES` stop-list is gone).
* **Construction (section 3):** replaced the greedy planner with `src/geometry/construction.ts`
  (section 5, recommendation C): richer loci, an exact order search, every equation used or checked,
  order facts as branch selectors and slider ranges, solver-free initialisation, partial drawings with a
  reason on failure, and dragging of determined points by re-planning. C1, C3, C4, C5, C6 addressed;
  C2 addressed for the cases in tests (compass transfer, bisector), not yet by consuming the closure.
* **Open:** F4 (budget reported as ✗), F6 (degenerate cases / `distinct`), P4 (numeric evidence),
  extraction consuming the forward closure, continuity at tangencies (nearest-branch tracking can still
  jump), order facts on circles (only checked, not used to restrict sliders).

---

## 1. What the system actually does

"Backward chaining" in this codebase is **deterministic definition unfolding** (macro expansion):
`unfold()` replaces a goal by the body of the unique clause whose head matches it. There is no
backward proof search (the old `prove()` is gone; `tests/el2.test.ts` still imports it, as
`undefined`). "Forward chaining" is **Datalog-style saturation**: compute the least fixpoint of
the rules over the finite set of named objects.

|                    | inference (lemmas, ground queries)                                | construction (the drawing)                                          |
|--------------------|-------------------------------------------------------------------|---------------------------------------------------------------------|
| backward (unfold)  | hypotheses / configuration facts are unfolded through every predicate that happens to have exactly one clause | configuration facts are unfolded down to a hard-coded frontier: `collinear`, `between`, `circle`, `eq-lines` |
| forward (closure)  | saturate the unfolded facts with all rules; check the goal       | **not used**. `canonicalise()` re-implements a few inferences itself (distance union-find; merge collinear groups sharing two names) |

The construction pipeline: unfold → constraints → canonical lines/circles → greedy scheduler picks
an order and a locus per point (free / on line / on circle / intersection) → the numerical solver
supplies the initial parameters and the intersection branches → dragging edits plan parameters
→ `executePlan` re-runs the straight-line program.

---

## 2. Soundness of inference

### What is sound

Forward closure is sound, and complete for this function-free fragment over a finite universe
(modulo the step cap). Treating head-only variables as "triggered invariants" over the universe
is just Herbrand instantiation, and freezing a lemma's variables as constants is the standard way
to check a universally quantified Horn clause. That part of the design is solid.

### F1. A lone clause is silently read as a definition (if-and-only-if)

LANGUAGE.md gives the semantics as the least model of `K ∪ B`. Under that semantics
`? eq-lines a b a c: eq-triangle a b c` is **not** valid: the rule only says circles imply
`eq-triangle`, not the converse. The checker proves it anyway, because unfolding the hypothesis
uses the converse direction (Clark completion). That is the *intended* meaning for constructions,
but it applies to every predicate that happens to have one clause:

```
tall x: giraffe x
? giraffe x: tall x          # ✓  — every tall thing is a giraffe
```

### F2. Which predicates are "definitions" is guessed from clause counts, so adding knowledge removes theorems

```
? eq-lines a b b c: eq-triangle a b c                      # ✓
eq-triangle a b c: eq-triangle b c a                       # add a TRUE symmetry rule...
? eq-lines a b b c: eq-triangle a b c                      # ✗  — I.1's lemma is lost
```

The reverse also happens: when common notion 3 became the only rule with an `eq-lines` head,
`eq-lines` silently became a "definition" and every `eq-lines` hypothesis was expanded backwards
through it — that is the false `between a b d: vesica a b c d` found earlier. The `PRIMITIVES`
stop-list I added to `checker.ts` hides that one case. It is a band-aid that privileges four
geometry predicates, which is exactly what LANGUAGE.md set out to avoid.

### F3. `unfold` captures variables (unsound even under the completion reading)

A rule's body-only variables (a construction's auxiliary points) keep their literal names
instead of being renamed apart:

```
cut-segment a b x c d  ⟶  circle d a c, circle a d c, circle c d g, between d c g, ...
```

`copy-segment`'s auxiliary apex `d` has become the caller's `d`, the endpoint of the given segment.
So the checker proves false theorems, and α-renaming changes the verdict:

```
? eq-lines a d a c: cut-segment a b x c d     # ✓  (false)
? eq-lines a q a p: cut-segment a b x p q     # ✗  (same statement, renamed)
```

The drawing is wrong in the same way: `cut-segment` draws a figure in which the given segment's
endpoint is the apex of an equilateral triangle. It also happens at the configuration level: in
the scratchpad, a user's own point `d` is merged with the `d` inside any construction that uses one.

### F4. "Gave up" is reported as "false"

When the step budget runs out the checker answers `not-provable`, shown as ✗, which is the same
mark as a genuine failure. (`Saturation.exhausted` exists but nothing reads it.)

### F5. My native-equality engine (`saturate.ts`) hard-codes the geometry

It is about 700× faster than the reference engine on 5+ point lemmas (30–50 ms vs 25–30 s), and
agrees with it on every lemma both can finish. But it achieves that by building in `eq-point`,
`eq-lines`, `between` and `collinear` by name. That contradicts LANGUAGE.md ("no built-in notion
of equality") and the goal of a general engine. Section 4 proposes how to keep the speed without
the names.

### F6. The logic and the drawing disagree about degenerate configurations

The logic is exact over *all* configurations, including coincident points, so it refuses
`collinear a c d: collinear a b c, collinear a b d` (false when `a = b`), and cannot prove
`between a c e` for marched points without a case split on `b ≠ c`. The geometry layer assumes
general position: `canonicalise()` merges `collinear a b c` and `collinear a b d` into one line,
so the drawing asserts what the logic denies. Neither stance is wrong, but they are unstated and
they differ. There is no way to state distinctness at all.

---

## 3. Gaps in construction

Probe: run the real pipeline, perturb the plan parameters 300 times (simulated drags), and check
every unfolded fact numerically on each resulting figure.

| figure | plan | figures violating their own facts |
|---|---|---|
| `eq-triangle a b c` | a, b free; c = circle ∩ circle | 0 / 300 |
| circumcentre (`circle o a b`, `circle o a c`) | o, a free; b, c on circle | 0 / 300 |
| `vesica`, `double`, `march` | intersections | 0 / 300 |
| `midpoint m a b` | a, **m free**, b on line | **300 / 300** (`am = mb`) |
| `eq-lines a b c d`, `circle a b x` | c, d free | **300 / 300** |
| `copy-segment a l b c` | solver failed (energy 2.8e3) | **300 / 300** (`between d b g`) |
| `cut-segment a b x c d` | consistent… | 0 / 300, but it is the captured, wrong figure (F3) |

### C1. Nothing checks the drawing against the facts

The scheduler uses at most two loci per point and ignores everything else: `between` beyond
collinearity, `eq-lines` that are not in circle form, and any third locus through a point. The
"ruler & compass" mode then draws a figure that violates its own definition, with no indication.

### C2. Same fact, different drawing

`eq-lines a m m b` *is* `circle m a b`, but only facts spelled `circle` become circles, so
`midpoint` gets a spurious degree of freedom (plan DOF 5, true DOF 4). Construction depends on how
a fact is written, because extraction never consults the inference engine.

### C3. Plans are initialised from the numerical solver

Initial parameters and the intersection branch (`which`) come from a solver witness. When the
solver fails, which it does on I.2 (`copy-segment`, also the failing `el2` test) and on `double`,
the plan inherits garbage: `g` lands on the wrong side of `b` in every drag. The plan's own
parameter space is tiny (6 numbers for I.2) and satisfies every circle/line exactly by construction,
so it is a much better place to search than raw coordinates.

### C4. One failing step erases the whole drawing

If two circles stop meeting, `executePlan` returns `null` and nothing is drawn. Euclid states
conditions for a construction to be possible (the *diorism*: I.3 needs `cd < ab`). Failure is
information worth showing: draw up to the failing step and highlight it.

### C5. The geometry frontier is hard-coded, and an unknown predicate kills the drawing

`extraction.ts` throws `UnsupportedPrimitiveError` for anything outside its four predicates, and
the whole figure disappears. A drawing should skip what it cannot draw.

### C6. Interaction model

What works: a plan is a straight-line program with parameters (2 per free point, 1 per point on a
locus), dragging edits one parameter, re-execution keeps every constructed relation exact, and
the branch flag keeps circle-circle choices continuous. Gaps: determined (0-DOF) points cannot be
dragged; branch flags can jump at tangency; and the plan never uses facts the logic derived.

---

## 4. A sound design that stays general

The central observation: **the language uses one clause form for two different things**, and
the engine guesses which is which.

* **Definitions**: `eq-triangle`, `copy-segment`, `circle`. Read as if-and-only-if. They may
  introduce auxiliary objects, and their body is also a construction recipe.
* **Implications (axioms, rules)**: common notions, `collinear a b c: between a b c`. One-way only.

Definitions are the shared currency between proving and drawing, which is the nicest idea in the
current design. It should be kept and made explicit.

### P1. Recognise definitions soundly (adopted, without syntax)

*Originally proposed as a `:=` marker; adopted instead as a recognition rule (src/kb/definitions.ts):*
a predicate is defined by a clause D when D is non-recursive and every other clause for the predicate
is provable from D. That is exactly when the completion of all its clauses is a conjunction. Then:

* only definitions are unfolded; plain rules never are (fixes F1, F2, and the CN3 incident, and
  removes the `PRIMITIVES` band-aid);
* body-only variables are existentials, renamed apart on every unfolding with fresh,
  deterministic names that cannot collide with user identifiers (e.g. `d#3`), and tagged as
  auxiliary so the renderer can de-emphasise them (fixes F3, and gives provenance for free);
* adding a clause that follows from the definition cannot change the meaning; this is also the safe
  form of "lemma compilation";
* (not yet done) forward chaining may use the only-if direction of a definition whenever it introduces no new
  objects (`eq-triangle a b c ⇒ circle a b c`). That direction is a plain Horn rule, so it is safe
  and terminating. Object-introducing directions happen only at unfolding time, so saturation
  cannot run away (the unrestricted "chase" with existentials need not terminate).

Primitives are then simply predicates without a definition, with nothing hard-coded.

### P2. Recognise equality structure by proof (adopted, without syntax)

*Originally proposed as declarations; adopted instead as recognition (src/kb/structure.ts):* the rules
stay plain Horn clauses in core.geo. At load time the engine proves, from each predicate's own rules on
fresh constants, which predicates are equivalences (on single objects or on argument tuples), which
argument positions admit substitution of equals, and which argument permutations a predicate is
invariant under. `saturate.ts` implements exactly what was proven with union-find and canonical forms,
skips the rules that structure implies (proved rule by rule), and fires every other rule normally.
It contains no predicate names; tests/structure.test.ts includes a map-colouring knowledge base that
gets the same treatment. Recognition costs about 170 ms once per rule set (cached by content).

Still to exploit: with this structure, forward closure yields `circle m a b` from `eq-lines a m m b`
via the existing rule in euclid.geo, which would remove C2 once extraction consumes the closure.

### P3. Contradiction and distinctness, still Horn

Reserve `false` as a head: `false: eq-point a b, distinct a b`. `distinct` is an ordinary positive
predicate, so no negation is needed. Lemmas can carry non-degeneracy hypotheses
(`? between a c e: march a b c d e, distinct a b`), and inconsistent hypotheses are reported as
vacuous rather than as proofs.

### P4. Three verdicts, with the construction engine as model checker

For a lemma whose hypotheses unfold to drawable facts, sample configurations through the plan and
evaluate the goal numerically:

| proof | numeric evidence | shown as |
|---|---|---|
| proven | holds in all samples | ✓ |
| proven | **fails in a sample** | soundness alarm: a bug in the engine or a false axiom (it would have caught F3) |
| not proven | holds in all samples | ≈ (probably true: missing axiom, or needs a case split, e.g. `march`'s order facts) |
| not proven | fails | ✗ with the counterexample drawn |
| budget exhausted | — | unknown, not ✗ |

This ties the two halves together, gives the book counterexample figures, and permanently guards
the engine and user-written axioms.

---

## 5. Construction: alternatives

**A. Current.** A greedy scheduler over lines and circles, solver for initialisation and fallback.
Works on intersection-only figures; fails silently otherwise (section 3).

**B. Ordered construction programs.** Treat a definition's body order as the construction order
(Euclid's text is ordered). Each atom must be realisable from objects already built. Deterministic,
explainable, step playback is trivial, and it fits the book. Weakness: non-constructive statements
have to be flagged.

**C. Generic locus scheduler with geometry plugins.** A geometry supplies: the drawable predicates
(the renderer has a primitive list; the logic does not), for each predicate and argument position a
*locus generator* ("given the others, where can this one be?"), locus intersection with branch
enumeration, a numeric residual for every predicate, and rendering. Everything else is generic:
DOF accounting, scheduling, verification, branch choice, dragging, failure display. Another
geometry (Poincaré disk, sphere, projective plane, taxicab) is another plugin, and the logic is unchanged.

**D. Pure numerical constraint solving** (current solver mode). Handles anything but has no
ruler-and-compass meaning, and branches jump. Continuation methods (Cinderella traces paths through
complex space) fix the jumping, at real cost. Best kept as the fallback.

**Recommendation: C, preferring the body order from B when it is constructive**, with:

1. input = unfolded construction (fresh names) + forward closure, restricted to drawable,
   non-degenerate facts, so inference feeds construction;
2. every fact not used as a locus becomes a *check*, evaluated on every frame; if a check always
   holds it is a candidate theorem, and if it fails the figure says so;
3. branches chosen by evaluating the checks (`between`, sides) on each candidate, not by a solver witness;
4. initial parameters found by searching the plan's own small parameter space against the checks;
5. partial drawing on failure, with the failing step and the unmet condition shown.

---

## 6. Other approaches considered for inference

* **Hard-coded primitives again.** Fast, simple, and domain-specific. Rejected. The renderer
  legitimately has a primitive list; the logic should not.
* **Backward proof search with tabling (SLG resolution).** Complete for this fragment, goal-directed,
  and yields proof trees directly. Worth it later for explanations or large knowledge bases; the
  current sizes don't need it.
* **egglog / e-graphs (Datalog + equality saturation).** The closest existing design to what this
  engine wants. P2 borrows its core idea (union-find, canonicalise, rebuild). Borrow the design, not
  the (Rust/wasm) dependency.
* **SMT (Z3 in wasm).** Much more powerful, but heavy, opaque proofs, and it gives up the Horn
  simplicity. Not now.
* **Algebraic provers (Wu, Gröbner, area method).** Decide many metric theorems and generate
  non-degeneracy conditions automatically, but are specific to Euclidean geometry. Possibly an
  optional per-geometry oracle, never the core.
* **Diagrammatic inference (Avigad, Dean & Mumma's system E).** A formal account of Euclid in which
  order and incidence facts are read from the diagram when they hold in every configuration, and
  metric facts are proven. It is the principled version of F6, and a good reference when deciding
  how `between` and distinctness should work.

---

## 7. Suggested order (engine only)

1. ~~Rename existentials apart in `unfold` (F3).~~ Done; regression tests in tests/unfold.test.ts and
   tests/definitions.test.ts.
2. ~~Residual checks in the planner, surfaced in the UI (C1).~~ Done, as part of the new planner.
3. ~~Definitions (P1).~~ Done, by recognition.
4. ~~Generic equality structure (P2).~~ Done, by recognition.
5. Three verdicts (P4), starting with "budget exhausted = unknown".
6. Construction C: ~~residual-driven branches and initialisation, partial drawings~~ (done);
   forward-closed input; then the plugin boundary.
7. `distinct` and `false` (P3).

## Status of the test suite (2026-10-12)

* 284/285 pass in about 20 s. The failure is `el2 › copy-segment solves reliably`: the numerical
  solver cannot solve I.2. It is left failing on purpose; the construction planner no longer depends
  on the solver (tests/construction.test.ts checks 12 figures, including I.2, against every fact over
  300 random drags each).
* The old greedy planner (`src/geometry/planner.ts`) is now used only by its own tests and the
  unrouted earlier views (`MainView`, `DualPlaneView`, via `DiagramPane`/`GeometryDiagram`'s legacy
  `plan` prop). It can be deleted together with those views.
* The differential test (`saturate` vs reference engine, same rules) is limited to lemmas with ≤ 3
  objects; at four the reference engine takes 1.5–9 s per lemma, at five 20–30 s.
* With capture fixed, the `cut-segment` lemmas were re-checked (they still hold), the false
  `? eq-lines a d a c: cut-segment a b x c d` is no longer provable, and two `copy-segment` lemmas
  that named the construction's internal points were removed (they were only "provable" by capture).
