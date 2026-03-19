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
│  Knowledge Base + Runtime                           │
│                                                     │
│  core/      foundational inference rules            │
│  euclid/    named constructions                     │
│  lemmas/    builtin queried clauses / examples      │
│  user/      user-defined predicates (localStorage)  │
└─────────────────────────────────────────────────────┘
     │
     ▼  unfold / closure / checker (kb/)
┌──────────────────────────────┐
│  Runtime ground facts        │
│  + app-side geometry bridge  │
└──────────────────────────────┘
     │
     ▼  translate to GeometryProblem (geometry/extraction.ts)
┌──────────────────────┐
│  Canonical geometry  │  lines, circles, residual constraints
└──────────────────────┘
     │
     ├──────────────────────────┐
     ▼                          ▼
┌──────────────┐       ┌─────────────────────┐
│  Numerical   │       │  Construction       │
│  Solver      │       │  Planner            │
│              │       │                     │
└──────────────┘       └─────────────────────┘
     │                          │
     └───────────┬──────────────┘
                 ▼
          ┌────────────┐
          │ SVG render │
          └────────────┘
```

### Source files

| File | Purpose |
|------|---------|
| `src/language/lexer.ts` | Tokeniser |
| `src/language/parser.ts` | Parser — rules, goals, ground queries, queried clauses; returns `TopLevel[]` |
| `src/kb/inference.ts` | `KnowledgeBase`, `unfold()`, `forwardClosure()` |
| `src/kb/configuration.ts` | Session/runtime configuration and proof-state support |
| `src/kb/checker.ts` | Queried-clause and ground-query checking |
| `src/kb/runtime.ts` | Build runtime state from parsed text |
| `src/geometry/constraints.ts` | Shared types: `GeometryProblem`, `WitnessModel`, `Line`, `Circle` |
| `src/geometry/extraction.ts` | Translate runtime facts into a geometry problem |
| `src/geometry/canonicalization.ts` | UnionFind merge → canonical lines and circles |
| `src/geometry/solver.ts` | Numerical solver |
| `src/geometry/planner.ts` | Construction planner, `executePlan()`, `extractParams()` |
| `src/composables/useKB.ts` | Reactive KB composable, namespace tree, localStorage persistence |
| `src/helpers.ts` | Remaining renderer/UI bridge utilities |
| `src/views/MainView.vue` | Main three-panel layout |
| `src/components/KnowledgeBrowser.vue` | Left panel: predicate browser |
| `src/components/EditorPane.vue` | Middle panel: clause editor + verification gutter |
| `src/components/DiagramPane.vue` | Right panel: SVG diagram + construction plan |
| `src/workers/lemmaCheckWorker.ts` | Worker-based progressive verification |

---

## The Language

Full Horn clause syntax. Both inline and indented-body forms are equivalent:

```txt
eq-triangle a b c: circle a b c, circle b a c

eq-triangle a b c:
    circle a b c
    circle b a c
```

**Ground facts** are bare predicate lines (no `:` and no `?`):

```txt
circle a b c
```

**Ground queries** use `?` without a body:

```txt
? eq-lines a b a c
```

**Queried clauses** use `?` with a body:

```txt
? collinear a b c: between a b c
```

Conceptually:
- axioms are rules with empty bodies
- theorems are queried clauses with empty bodies
- the core parser distinction is between ground queries and queried clauses

See `LANGUAGE.md` for the full semantic model.

---

## UI

Three-panel layout: **Predicate Browser** | **Clause Editor** | **Diagram**.

**Predicate Browser** (left): namespace tree (`core/`, `euclid/`, `lemmas/`, `user/`).
Click a predicate to load its source and render its diagram. Scratchpad entry at top. `＋` to add
new user clauses.

**Clause Editor** (middle): Horn clause source for the selected predicate or scratchpad. Foundation
clauses are read-only. Query lines (`?`) are checked in a worker and show progressive `…` / `✓` /
`✗` marks in the gutter.

**Diagram** (right): SVG diagram of the current construction.
- Toggle **📐** to switch between the construction planner and the numerical solver.
- When the planner succeeds, a step list is shown below the diagram and points are annotated with
  their step index.
- Drag free points and 1-DOF constrained points to explore the construction interactively.

---

## Construction Planner

The planner takes a canonical `GeometryProblem` and produces a `Plan`: an ordered sequence of
construction steps, each with an explicit degree of freedom.

| Step kind | DOF | Params |
|-----------|-----|--------|
| `free` | 2 | `[x, y]` |
| `point-on-line` | 1 | `[t]` |
| `point-on-circle` | 1 | `[θ]` |
| `line-line-intersection` | 0 | — |
| `circle-circle-intersection` | 0 | `which: boolean` |
| `circle-line-intersection` | 0 | `which: boolean` |

The current planner is greedy and operates over the canonical geometry problem.

---

## Numerical Solver

The solver uses numerical optimization to find a witness satisfying the geometry constraints and is
the fallback when planning fails or is disabled.

---

## Running

```bash
npm install
npm run dev      # dev server
npm test         # vitest test suite
npm run build    # production build
```

---

## Future work

See `FUTURE_TASKS.md` for the consolidated backlog and deferred work list.
