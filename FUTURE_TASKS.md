# Future Tasks

- Clean up and polish `MainView.vue` and the remaining UI glue.

- Continue moving stable concepts out of `helpers.ts` into more appropriate homes as their boundaries become clearer. In particular, keep distinguishing between UI bridge code, renderer bridge code, and KB/editor logic rather than letting `helpers.ts` become a junk drawer again.

- Replace the provisional proof-universe bootstrap via synthetic `__object__` facts with a cleaner explicit initial-universe mechanism.

- Decide whether rich parser metadata (`docComment`, `otherComments`, `sourceRef`) should be preserved more uniformly through helper APIs rather than being dropped by `parseRules()` / `parseLemmas()`.

- Introduce a long-lived worker-side KB snapshot / versioning model for verification instead of rebuilding `KnowledgeBase` from serialized `Rule[]` on every request.

- Add worker-side caching where it is clearly safe and worthwhile.

- Move the numerical solver off the main thread for larger problems.

- Revisit the geometry frontier and extraction semantics now that the runtime→geometry path has been unified.

- Reduce or better structure geometry predicate hard-coding where appropriate.

- Reassess whether the current geometry frontier (`circle`, `between`, `collinear`, `eq-lines`, etc.) is the best long-term boundary for the drawing system.

- Add surface filtering so internal points introduced during inference expansion can be hidden when appropriate and only top-level relevant points are shown.

- Use proven relations like `eq-dist` to drive visual annotations (for example tick marks) rather than exposing all intermediate structure.

- Replace the textarea editor with something richer such as CodeMirror 6.

- Use the existing lexer/parser infrastructure as the basis for syntax highlighting.

- Add inline query decorations rather than relying only on the separate gutter.

- Add predicate-name completions from `useKB()`.

- Add hover tooltips with arity, namespace, and provenance.

- Add undo/redo for interactive dragging.

- Add construction animation / step-by-step playback.

- Add proof traces so proven queried clauses show derivation structure rather than only ✓/✗.

- Consider compiling verified lemmas back into the knowledge base as Horn clauses for reuse, while weighing that against KB bloat and debugging complexity.

- Consider moving from “single arity per predicate name” to a true multi-arity predicate model (`foo/1` distinct from `foo/2`). This would simplify or remove some of the current arity-consistency machinery, but it is a language-design decision rather than just an implementation tweak.

- Explore search-based planner variants (beam search, A*, backtracking, etc.) for harder or more ambiguous constructions, and benchmark whether they are worth the added complexity compared with the current greedy planner.

- Improve solver reliability for harder circle-line, over-constrained, and betweenness-heavy constructions.

- Revisit objective terms and constraint weighting if needed.

- Support always-2-DOF dragging: when dragging starts on a currently 0-DOF point, re-run planning with that point forced free to obtain a new interactive plan.

- Improve interactive plan adaptation for exploration-heavy use.

- Add a better “Save to library” flow so scratchpad clauses can be promoted into the user namespace more directly.

- Continue refining `.geo` conventions once naming and visibility design settle.

- Improve provenance-aware browsing and editing flows where useful.
