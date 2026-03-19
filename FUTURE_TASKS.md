# Future Tasks

This document consolidates deferred work and possible next steps after the current implementation round.

It combines:
- remaining deferred / future notes from `IMPLEMENTATION_PROGRESS.md`
- the older “Possible Next Steps” list from `README.md`

The idea is to keep one future-facing backlog instead of scattering todo notes across multiple docs.

---

## 1. Cleanup & Consolidation

### Runtime / UI cleanup
- Further cleanup/polish around `MainView.vue` and remaining UI glue
- Continue moving stable helper concepts out of `helpers.ts` into more appropriate homes when their boundaries are clear
- Audit whether any remaining helper functions are really UI bridge code, renderer bridge code, or KB/editor logic

### Proof-state cleanup
- Replace the provisional proof-universe bootstrap via synthetic `__object__` facts with a cleaner explicit initial-universe mechanism

### Parser / metadata cleanup
- Consider whether rich parser metadata (`docComment`, `otherComments`, `sourceRef`) should be preserved more uniformly through helper APIs rather than being dropped by `parseRules()` / `parseLemmas()` projections

---

## 2. Performance & Worker Improvements

### Verification worker
- Introduce a long-lived worker-side KB snapshot / versioning model instead of rebuilding `KnowledgeBase` from serialized `Rule[]` for every verification request
- Add worker-side caching where it is clearly safe and worthwhile

### Solver worker
- Move the numerical solver off the main thread for larger problems

---

## 3. Drawing / Geometry Redesign

### Geometry frontier / extraction redesign
- Revisit the geometry frontier and extraction semantics now that the runtime→geometry path has been unified
- Reduce or better structure geometry predicate hard-coding where appropriate
- Reassess whether the current geometry frontier (`circle`, `between`, `collinear`, `eq-lines`, etc.) is the best long-term boundary for the drawing system

### Visibility / rendering semantics
- Surface filtering: hide internal points introduced during inference expansion and show only points named at the relevant top-level surface when appropriate
- Lemma-driven decorations: use proven relations like `eq-dist` to drive visual annotations (e.g. tick marks) rather than exposing all intermediate structure

---

## 4. UI / Editor Improvements

### Editor
- Replace the textarea with a richer editor such as CodeMirror 6
- Use the existing lexer/parser infrastructure as the basis for syntax highlighting
- Inline query decorations rather than separate gutter-only marks
- Predicate-name completions from `useKB()`
- Hover tooltips with arity / namespace / provenance

### Interaction polish
- Undo/redo for interactive dragging
- Construction animation / step-by-step playback
- SVG export

---

## 5. Proofs / Language Evolution

### Proofs
- Proof traces: show derivation structure for proven queried clauses, not just ✓/✗

### Lemma compilation
- Consider compiling verified lemmas back into the knowledge base as Horn clauses for reuse
- Weigh this against KB bloat and debugging complexity

### Multi-arity predicate model
- Consider moving from “single arity per predicate name” to a true multi-arity predicate model (`foo/1` distinct from `foo/2`)
- This would simplify or remove some current arity-consistency machinery, but it is a language-design decision, not just an implementation tweak

---

## 6. Planner / Solver Evolution

### Planner
- Explore search-based planner variants (beam search, A*, backtracking, etc.) for harder or more ambiguous constructions
- Benchmark whether this is worth the added complexity compared with the current greedy planner

### Solver
- Improve reliability for harder circle-line / over-constrained / betweenness-heavy constructions
- Revisit objective terms and constraint weighting if needed

---

## 7. Interaction / Construction Exploration

- Always-2-DOF dragging: when dragging starts on a currently 0-DOF point, re-run planning with that point forced free to obtain a new interactive plan
- Better interactive plan adaptation for exploration-heavy use

---

## 8. Knowledge Base / Library UX

- “Save to library” flow: promote scratchpad clauses into the user namespace more directly
- Further `.geo` refinement once naming and visibility design settle
- Better provenance-aware browsing and editing flows where useful

---

## Current status note

The core semantic/runtime implementation round is largely complete. What remains here is mostly:
- cleanup
- performance
- geometry-system redesign
- richer editor / proof / planner features

So this file should be treated as a next-round backlog, not a list of blockers for the current architecture.
