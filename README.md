# elements

A browser-based interactive environment for Euclidean geometry, grounded in formal logic.

You write geometric relations in a Horn clause language; the system infers the constraint
structure, draws a diagram, verifies lemmas, and produces an explicit ruler-and-compass
construction plan that you can interact with by dragging.

The closest analogy is a Smalltalk class browser: the browser is also the editor, definitions are
live, and the system is always in a runnable state.

---

## Architecture

```
Horn clause source text
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  Knowledge Base (three namespaces)                  │
│                                                     │
│  tarski/     Tarski's axioms as Horn clauses        │
│  euclidean/  Named constructions (circle, eq-dist…) │
│  user/       User-defined predicates (localStorage) │
└─────────────────────────────────────────────────────┘
     │
     ▼  expand via backward chaining (inference.ts)
┌────────────────────────┐
│  Primitive constraints │  collinear, between, on-circle, eq-dist
└────────────────────────┘
     │
     ▼  merge & deduplicate (canonicalization.ts)
┌──────────────────────┐
│  Canonical geometry  │  Line objects, Circle objects, residual constraints
└──────────────────────┘
     │
     ├──────────────────────────┐
     ▼                          ▼
┌──────────────┐       ┌─────────────────────┐
│  Numerical   │       │  Construction       │
│  Solver      │       │  Planner            │
│  (Adam GD,   │       │  (greedy DOF,       │
│  always runs)│       │  may fail/timeout)  │
└──────────────┘       └─────────────────────┘
     │                          │
     └───────────┬──────────────┘
                 ▼
          ┌────────────┐
          │ SVG render │  points, lines, circles, step annotations
          └────────────┘
```

### Source files

| File | Purpose |
|------|---------|
| `src/language/lexer.ts` | Tokeniser |
| `src/language/parser.ts` | Parser — rules, goals, lemmas; returns `TopLevel[]` |
| `src/language/basic.geo` | Basic geometric predicates as Horn clauses |
| `src/language/tarski.geo` | Tarski axioms as Horn clauses (read-only) |
| `src/language/euclidean.geo` | Named Euclidean constructions (read-only) |
| `src/kb/inference.ts` | `KnowledgeBase`, `prove()`, `expandUnique()`, `forwardClosure()` |
| `src/geometry/constraints.ts` | Shared types: `GeometryProblem`, `WitnessModel`, `Line`, `Circle` |
| `src/geometry/extraction.ts` | Expand a goal via KB to primitive constraints |
| `src/geometry/canonicalization.ts` | UnionFind merge → canonical Lines and Circles |
| `src/geometry/solver.ts` | Adam gradient descent solver, multi-restart, warm-start |
| `src/geometry/planner.ts` | Greedy construction planner, `executePlan()`, `extractParams()` |
| `src/geometry/renderer.ts` | SVG renderer with optional step annotations |
| `src/composables/useKB.ts` | Reactive KB composable, namespace tree, localStorage persistence |
| `src/helpers.ts` | Staging area for pipeline glue and renderer/UI bridge utilities |
| `src/views/MainView.vue` | Main three-panel layout |
| `src/components/KnowledgeBrowser.vue` | Left panel: predicate browser |
| `src/components/EditorPane.vue` | Middle panel: clause editor + lemma gutter |
| `src/components/DiagramPane.vue` | Right panel: SVG diagram + construction plan |

---

## The Language

Full Horn clause syntax. Both inline and indented-body forms are equivalent:

```
eq-triangle a b c: circle a b c, circle b a c

eq-triangle a b c:
    circle a b c
    circle b a c
```

**Goals** are bare predicate lines (no `:`). They are drawn as diagrams.

**Lemmas** use the `?` prefix — they are verified against the KB using `prove()`:

```
? collinear a b c: between a b c
```

**Primitives** — the inference engine expands goals down to these; the geometry pipeline consumes them directly:

- `collinear A B C`
- `between A B C`
- `circle CENTER RADIUS_PT TARGET_PT`
- `eq-lines A B C D`

---

## UI

Three-panel layout: **Predicate Browser** | **Clause Editor** | **Diagram**.

**Predicate Browser** (left): namespace tree (tarski/, euclidean/, user/).
Click a predicate to load its source and render its diagram. ✏ Scratchpad entry at top. `＋` to add
a new user clause.

**Clause Editor** (middle): Horn clause source for the selected predicate or scratchpad. Foundation
clauses are read-only (🔒). Lemma lines (`?`) show ✓/✗ marks in the right gutter.

**Diagram** (right): SVG diagram of the current construction.
- Toggle **📐** to switch between the greedy construction planner and the numerical solver.
- When the planner succeeds, a step list is shown below the diagram and points are annotated with
  their step index.
- **Drag** free points and 1-DOF constrained points to explore the construction interactively.
  Intersection points (0 DOF) are fixed by their constraints and cannot be dragged.

---

## Construction Planner

The planner takes a canonical `GeometryProblem` and produces a `Plan`: an ordered sequence of
construction steps, each with an explicit degree of freedom:

| Step kind | DOF | Params |
|-----------|-----|--------|
| `free` | 2 | `[x, y]` |
| `point-on-line` | 1 | `[t]` (parametric along line) |
| `point-on-circle` | 1 | `[θ]` (angle from center) |
| `line-line-intersection` | 0 | — |
| `circle-circle-intersection` | 0 | `which: boolean` |
| `circle-line-intersection` | 0 | `which: boolean` |

**Algorithm:** greedy, O(n²). At each step, pick the lowest-DOF unplaced point given currently
placed objects. When all remaining points are free (DOF=2), prefer the one that would unlock the
most constraints. Boolean intersection choices are resolved by comparing both solutions against
the numerical witness.

**Interaction:** `extractParams()` converts a numerical witness into plan parameters. Dragging a
point updates its parameter(s) and re-executes the plan forward, keeping all downstream
constraints satisfied.

---

## Numerical Solver

Adam gradient descent with multi-restart and warm-start.

Energy terms:
- **Gauge fix** — anchor first two points to reduce translation/rotation symmetry
- **Collinearity** — anchor-pair formulation: perpendicular distance from line through first two sorted points
- **Circle** — deviation from mean radius for each on-circle group
- **Equal distance** — L2 penalty on eq-dist pairs
- **Betweenness** — ordering penalty + collinearity
- **Separation** — repulsion between pairs not sharing a line/circle constraint

The solver is always the fallback when the planner fails or times out.

---

## Running

```bash
npm install
npm run dev      # dev server
npm test         # vitest test suite
npm run build    # production build
```

---

## Possible Next Steps

### Rendering & Visibility
- **Surface filtering** — hide internal points introduced during inference expansion; only show the
  points named in the top-level goal args.
- **Lemma-driven decorations** — proven lemmas like `eq-dist` could drive tick marks on equal
  segments rather than drawing all intermediate geometry.

### Dragging
- **Always-2-DOF dragging** — when dragging starts on a 0-DOF intersection point, re-run the
  planner with that point forced free to get a fresh interactive plan.
- **Undo/redo for drag** — record param history.

### Knowledge Base
- **"Save to library"** — promote scratchpad clauses into user/ namespace with one click.
- **`.geo` refinement** — naming and arity conventions could be tidied once visibility design is settled.
- **CodeMirror 6 editor** — replace the textarea with a proper embedded editor. The EL2 lexer
  (`src/language/lexer.ts`) can be adapted directly as a CodeMirror language extension — token
  types map cleanly to CM6 highlight tags. This would unlock inline ✓/✗ decorations (marks
  alongside the `?` line itself rather than in a separate gutter column), predicate name
  completions sourced from `useKB()`, and hover tooltips showing arity/namespace.
  Estimated effort: ~10–16 hours.

### Proofs
- **Proof traces** — show the backward-chaining derivation for a proven lemma, not just ✓/✗.

### Planner
- **Search-based planner** — the current greedy planner works well for typical constructions but
  could fail on under-constrained or ambiguous problems. A proper search (beam search, A*, etc.)
  with backtracking would handle harder cases; benchmarking would show whether it's worthwhile.

### Solver
- **Web Worker** — move Adam off the main thread for large problems.
- **Stronger objective** — harder constructions involving circle+line intersections and
  over-constrained betweenness still have occasional reliability issues.

### Misc
- **Construction animation** — step through the plan sequentially, highlighting each step.
- **SVG export** — download the current diagram.
