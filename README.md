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
| `src/kb/inference.ts` | `KnowledgeBase`, `unfold()`, reference `forwardClosure()` |
| `src/kb/definitions.ts` | Which clause (if any) defines each predicate (read as if-and-only-if) |
| `src/kb/structure.ts` | Equivalences, substitution and symmetries, proven from the rules |
| `src/kb/saturate.ts` | Fast forward closure using that structure (used by the checker) |
| `src/kb/names.ts` | Fresh names for auxiliary objects introduced by unfolding |
| `src/kb/configuration.ts` | Session/runtime configuration and proof-state support |
| `src/kb/checker.ts` | Queried-clause and ground-query checking |
| `src/kb/runtime.ts` | Build runtime state from parsed text |
| `src/geometry/constraints.ts` | Shared types: `GeometryProblem`, `WitnessModel`, `Line`, `Circle` |
| `src/geometry/extraction.ts` | Translate runtime facts into a geometry problem |
| `src/geometry/canonicalization.ts` | UnionFind merge → canonical lines and circles |
| `src/geometry/solver.ts` | Numerical solver |
| `src/composables/useKB.ts` | Reactive KB composable, namespace tree, localStorage persistence |
| `src/helpers.ts` | Remaining renderer/UI bridge utilities |
| `src/views/PageView.vue` | The page: masthead, source, figure, contents, themes |
| `src/components/CodeEditor.vue` | CodeMirror editor with verification gutter |
| `src/components/GeometryDiagram.vue` | The figure: rendering, ghosting under text, dragging |
| `src/composables/useWorkspace.ts` | Current page state: text, runtime, facts, construction |
| `src/geometry/construction.ts` | Ruler-and-compass planner, execution and dragging |
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

One page, in the manner of Byrne's *Euclid*: a flat colour field, the figure in ink, points and
names in an accent colour.

- **The figure fills the page** and runs behind the source text. Under the text it turns into a
  dotted ghost of itself, and the text has a halo in the paper colour, so lines never read as text.
- **Points**: grab cursor, a large hit area and a ring on hover. Solid points are free, ringed points
  slide along a line or circle, open points are determined by the construction (dragging one
  re-plans the construction so that it becomes free, if that loses no fact).
- **Source** on the left (CodeMirror): predicates, variables and comments highlighted; `?` lines are
  checked in a worker and marked `✓` / `✗` in the gutter; predicate names complete.
- **The construction in words** below the source, with the failing step marked if the figure cannot
  be constructed in its current position (and the reason at the bottom of the page).
- **Contents**: click the title or `ELEMENTS` for the library; the scratchpad is at the top.
- **Themes**: six palettes (swatches top right), cross-fading; with *shuffle* on, opening something
  from the contents picks a new one. Both choices are remembered in the browser.

---

## Construction Planner

`src/geometry/construction.ts` turns the drawable facts of a figure (collinear, between, circle,
eq-lines) into a ruler-and-compass program. Each point is placed by one step:

| Step | DOF | Parameter | |
|------|-----|-----------|---|
| `free` | 2 | `x, y` | an input point |
| `on` | 1 | slider | on a line, circle or perpendicular bisector of points already placed |
| `meet` | 0 | — | where two such loci meet |

- **Loci**: a line through two placed points of a collinear group; a circle about a placed centre
  with the radius of any placed segment of equal length; the perpendicular bisector of two placed
  points the new point is equidistant from.
- **Order of construction**: an exact search (dynamic programming over sets of placed points) that
  uses as many of the figure's equations as possible, then prefers named points over auxiliary ones as
  inputs. Equations not used to place a point become checks, evaluated on every frame.
- **Order facts** (`between`) choose which intersection to take and restrict where a point may slide;
  a slider's value is measured within its allowed interval, so dragging can never break the order.
- **Starting positions** are sampled from the plan's own parameters (seeded, so the figure is stable,
  and keeping previous positions across edits); no numerical solver is needed.
- **Failures** (e.g. two circles that do not meet) stop the drawing at that step and say why.
- **Dragging** a determined point re-plans so that point becomes an input, if no fact is lost.

If no configuration satisfies every fact, the figure is drawn by the numerical solver instead.

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
