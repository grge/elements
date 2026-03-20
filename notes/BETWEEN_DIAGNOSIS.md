# Betweenness diagnosis: solver, planner, rendering, and interaction

Date: 2026-03-20

## Summary

`between` is currently handled by the **numerical solver**, but not as a first-class constraint in the **construction planner**, **planner-mode dragging**, or **diagram rendering**.

This produces the observed split:

- the initial solver-generated image often looks approximately right
- the construction planner does not respect betweenness
- planner-mode interactivity can violate betweenness
- in some cases even the implied collinearity is not preserved by the planner
- no explicit visual line/segment is drawn to indicate a `between` relation unless some separate `collinear` fact also yields a canonical line

## What the code currently does

### 1. Extraction keeps `between` as a frontier primitive

In `src/geometry/extraction.ts`:

- `GEOMETRY_FRONTIER` includes `between` and `collinear`
- `frontierFactsFromRuntime(...)` unfolds facts only until a frontier predicate is reached

That means a fact such as:

```txt
between a m b
```

stops at `between a m b`.

Even though the KB can derive:

```txt
collinear a m b
```

that derivation is not followed any further once `between` is reached, because `between` itself is treated as a frontier endpoint.

So `between` survives as a raw geometry constraint, rather than being normalised into line structure.

### 2. Canonicalisation only turns `collinear` into lines

In `src/geometry/canonicalization.ts`:

- `collinear` constraints are merged into canonical `problem.lines`
- `between` constraints are left as residual constraints

So a `between` relation does **not** by itself create a canonical line for the planner or renderer.

This is the key reason the planner can miss even the collinearity implied by betweenness.

### 3. The planner only reasons about lines and circles

In `src/geometry/planner.ts`:

- `computeDOF(...)` only inspects `problem.lines` and `problem.circles`
- raw constraints such as `between` are ignored

Therefore the planner does not know that a point constrained by `between(a, b, c)`:

- must lie on the line through `a` and `c`
- must lie between the endpoints, rather than anywhere on the full line

If no separate canonical line exists, the point may be treated as freer than it should be.

### 4. The numerical solver does handle `between`

In `src/geometry/solver.ts`, `betweenGrad(...)` contributes energy terms for:

- collinearity
- ordering via a segment parameter constrained to the interval `[0,1]`

So the solver does understand betweenness directly.

This explains why the initial non-planner witness often looks correct.

### 5. Planner-mode dragging preserves only planner step semantics

In `src/helpers.ts`, `dragPlannerPoint(...)` only handles:

- `free`
- `point-on-line`
- `point-on-circle`

So in planner mode:

- a `free` point can be dragged anywhere
- a `point-on-line` point stays on its line, but is not kept between endpoints
- any raw `between` constraint not represented in the plan is ignored during dragging

This means planner-mode interactivity preserves only what the plan encodes, not the full residual constraint set.

### 6. Rendering does not draw `between` relations explicitly

In `src/geometry/renderer.ts` and the mirrored rendering helpers in `src/helpers.ts`:

- canonical lines are drawn
- circles are drawn
- points are drawn
- raw `between` constraints are not drawn in any special way

So if a relation exists only as `between`, there may be no visible line or segment at all.

## Why the observed behaviour happens

### Why the initial image can look right

Because the default witness may come from the numerical solver, and the numerical solver includes `betweenGrad(...)`.

### Why the planner ignores betweenness

Because the planner uses only canonical lines and circles, and `between` is never consulted directly there.

### Why even collinearity may be lost

Because `between` is not being turned into a canonical line during extraction/canonicalisation. So the planner may not even know there is a line to preserve.

### Why dragging can violate the relation

Because planner-mode dragging updates plan parameters, not the full residual geometry constraints.

## Structural diagnosis

This is not just a missing renderer feature. It is a representation mismatch across the pipeline:

1. **Solver model:** understands raw `between`
2. **Canonical planner model:** understands only lines/circles
3. **Extraction/canonicalisation:** leaves `between` residual instead of converting its collinearity content into canonical line structure
4. **Interaction model:** preserves only plan step semantics
5. **Rendering model:** visualises only canonical lines/circles, not raw `between`

In other words:

> `between` currently exists as a solver constraint, but not as a first-class planning/rendering/interactivity constraint.

## Practical implications for a future fix

A proper fix probably needs work in more than one place:

- **Extraction / canonicalisation:** decide whether `between(a,b,c)` should also contribute a canonical line through `a,b,c`
- **Planner:** decide whether betweenness should remain a residual ordering constraint on a point-on-line step, or whether it deserves an explicit construction step type
- **Dragging:** preserve segment bounds when a point is constrained by betweenness
- **Rendering:** draw some visible representation of betweenness (at minimum a line/segment indication, perhaps later a stronger visual cue)

Two broad design directions seem plausible:

### Option A: canonical line + residual betweenness

Treat `between(a,b,c)` as contributing both:

- line membership / collinearity for canonical planning and rendering
- a residual ordering constraint that still distinguishes “between” from “merely collinear”

This would fit the existing architecture best.

### Option B: explicit planner-level betweenness step

Introduce a dedicated planner representation for points constrained to lie between two endpoints.

This is more expressive, but probably a larger change.

## Bottom line

The bug is real and the code supports the diagnosis:

- solver: **yes** to `between`
- planner: **no** to `between`
- planner drag: **no** to `between`
- renderer: **no visible representation** of `between`
- canonicalisation: **does not promote betweenness to line structure**

So the current behaviour is the predictable result of `between` being treated as a residual solver-only constraint rather than a fully integrated geometric relation.
