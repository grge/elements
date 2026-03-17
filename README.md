# elements2

A browser-based interactive environment for Euclidean geometry, grounded in formal logic.

You write geometric relations in a relational language (EL2 Horn clauses); the system infers
the constraint structure, draws a diagram, verifies lemmas, and produces an explicit ruler-and-compass
construction plan that you can interact with by dragging.

The closest analogy is a Smalltalk class browser: the browser is also the editor, definitions are
live, and the system is always in a runnable state.

---

## Architecture

```
EL2 source text
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
│  Numerical   │       │  Construction        │
│  Solver      │       │  Planner             │
│  (Adam GD,   │       │  (greedy DOF,        │
│  always runs)│       │  may fail/timeout)   │
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
| `src/el2/lexer.ts` | Tokeniser (port of el2/lexer.py) |
| `src/el2/parser.ts` | Parser — rules, goals, lemmas; returns `TopLevel[]` |
| `src/el2/inference.ts` | `KnowledgeBase`, `prove()`, `expandUnique()`, `forwardClosure()` |
| `src/el2/geometry/constraints.ts` | Shared types: `GeometryProblem`, `WitnessModel`, `Line`, `Circle` |
| `src/el2/geometry/extraction.ts` | Expand a goal via KB to primitive constraints |
| `src/el2/geometry/canonicalization.ts` | UnionFind merge → canonical Lines and Circles |
| `src/el2/geometry/solver.ts` | Adam gradient descent solver, multi-restart, warm-start |
| `src/el2/geometry/planner.ts` | Greedy construction planner, `executePlan()`, `extractParams()` |
| `src/el2/geometry/renderer.ts` | SVG renderer with optional step annotations |
| `src/el2/tarski.geo` | Tarski axioms as EL2 Horn clauses (read-only) |
| `src/el2/euclidean.geo` | Named Euclidean constructions (read-only) |
| `src/composables/useKB.ts` | Reactive KB composable, namespace tree, localStorage persistence |
| `src/views/Scratchpad.vue` | Main three-panel UI |

---

## The Language (EL2)

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

**Primitives** — expanded to by the inference engine, consumed directly by the geometry pipeline:

- `collinear A B C`
- `between A B C`
- `on-circle CENTER RADIUS_PT TARGET_PT`
- `eq-dist A B C D`

---

## UI

Three-panel layout: **Predicate Browser** | **Clause Editor** | **Diagram**.

**Predicate Browser** (left): namespace tree (tarski/ collapsed, euclidean/ and user/ open).
Click a predicate to load its clauses and render its diagram. ✏ Scratchpad entry at top. `＋` to add
a new user clause.

**Clause Editor** (middle): EL2 source for the selected predicate or scratchpad. Foundation clauses
are read-only (greyed). User clauses auto-save after 800ms debounce. Lemma lines (`?`) show ✓/✗
marks in the right gutter.

**Diagram** (right): SVG diagram of the current construction.
- Solver: **📐 planner** (greedy DOF-based construction plan, interactive) or **~ numerical** (Adam
  gradient descent fallback). Toggle via the icon in the panel header.
- When the planner succeeds, a step list is shown below the diagram and points are annotated with
  their step index.
- **Drag** free points and constrained points to explore the construction interactively. Intersection
  points (0 DOF) are fixed by their constraints and cannot be dragged.
- **Scroll** to zoom, **drag background** to pan.

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
most constraints (maximise "unlock potential"). Boolean intersection choices are resolved by
comparing both solutions against the numerical witness.

**Interaction:** `extractParams()` converts a numerical witness into plan parameters. Dragging a
point updates its parameter(s) in-place and re-executes the plan forward from that step, keeping
all downstream constraints satisfied.

---

## Numerical Solver

Adam gradient descent with multi-restart and warm-start caching.

Energy terms:
- **Gauge fix** — anchor first two points to reduce translation/rotation symmetry
- **Collinearity** — anchor-pair formulation: perpendicular distance from line through first two sorted points
- **Circle** — deviation from mean radius for each `on-circle` group
- **Equal distance** — L2 penalty on `eq-dist` pairs
- **Betweenness** — ordering penalty + collinearity
- **Separation** — repulsion between pairs not sharing a line/circle constraint

The solver is always the fallback. When the planner fails or times out, the numerical witness is
used directly.

---

## Running

```bash
npm install
npm run dev      # dev server (default port 5173)
npm test         # vitest test suite
```

---

## Possible Next Steps

### Rendering & Visibility
- **Surface filtering** — a predicate's args are its surface; internal points introduced during
  expansion should be hidden by default. The renderer has all points; it just needs a
  `visible: Set<string>` mask derived from the top-level goal args. E.g. `copy-segment a b c d`
  creates 8 intermediate points but should only surface 4.
- **Lemma-driven decorations** — e.g. `? eq-dist a b c d: copy-segment a b c d` would let the
  renderer draw tick marks on the two equal segments. Predicates carry visual annotations
  derived from their proven lemmas, rather than drawing all intermediate geometry.
- **Hover/click interactivity** — click a point → popover showing its name, which constructions
  it belongs to, its coordinates. Click a line → collinear points. Click a circle → center,
  radius point, circumference points. All data is already in `GeometryProblem`.

### Dragging
- **Always-2-DOF dragging** — when drag starts on point P, re-run the planner with P forced
  free to get a fresh plan; use that for the drag session. Downstream 0-DOF points remain fixed
  by their constraints. One plan rebuild on drag-start rather than N plans held simultaneously.
- **Undo/redo for drag** — record param history so drag can be undone.

### Knowledge Base
- **Dead code cleanup** — `src/geom/` is the old elements codebase, never removed; `basic.geo`
  is superseded. Audit imports and remove anything not in the live pipeline.
- **`.geo` refinement** — arities sometimes awkward, naming inconsistent. Careful pass once
  visibility design is settled.
- **"Save to library" from scratchpad** — promote scratchpad clauses into user/ namespace with one click.

### Proofs
- **Proof traces** — show the backward-chaining derivation for a proven lemma, not just ✓/✗.

### Solver
- **Stronger objective** — harder constructions involving circle+line intersections and
  over-constrained betweenness still have reliability issues (see Python el2 notes).
- **Web Worker** — move solver off the main thread for large problems.

### Misc
- **Construction animation** — step through the plan sequentially, highlighting each step.
- **Export** — SVG download, or export construction as clean EL2 source.
- **Prolog-style predicate/arity disambiguation** — currently predicates have a single canonical
  arity; allowing the same name at multiple arities would require parser changes.
- **Connection to EL2 Python** — the TypeScript pipeline is a port of the Python `el2` package;
  they could share `.geo` files or a common KB format.
