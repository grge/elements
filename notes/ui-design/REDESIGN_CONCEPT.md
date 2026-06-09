# Plates — a considered interface concept for Elements

Date: 2026-06-09
Status: concept proposal, with working prototype
Companion artifact: `concept-prototype.html` (open it in a browser; everything described below is interactive)

This document takes the vision captured in `UI_OVERHAUL_DESIGN.md` and the visual language
distilled in `EUCLID_STYLE_NOTES.md`, and commits to a specific design. Where the earlier
notes deliberately left questions open, this one answers them — so the answers can be
argued with concretely rather than abstractly.

---

## 1. The organizing idea: the plate

The central conceptual move is to name the primary surface.

It is not a "view", a "page", or a "workspace". It is a **plate** — in the sense of a
printed mathematical illustration plate: a single composed surface on which a proposition
and its figure appear together as one object.

This one word resolves several tensions from the vision notes at once:

- A plate is **composed**, not assembled from panels. Layout decisions are compositional
  (where does the text sit relative to the figure?) rather than structural (which pane
  does this go in?).
- A plate has **one ground colour**. The background is not neutral app-chrome; it is the
  plate's ground, and the figure and text are inked onto it. This is what makes palette
  permutation per-predicate natural rather than gimmicky: *different plates are printed
  in different colourways*.
- A plate is **flat**. Nothing hovers over a printed plate. The strictly-2D rule stops
  being a stylistic prohibition and becomes a property of the metaphor: surfaces beside
  the plate (strip, index, underside) take real space from it.
- A plate is **worth contemplating**. The hero entry, the reading mode, the restraint —
  these all follow from treating each predicate as something with the dignity of a
  printed proposition.

Everything else in the design is staged relative to the plate:

```
            ┌────────────────────────────────────────────┐
            │  STRIP      elements · scratchpad · ⟨name⟩ · search
            ├────────────────────────────────────────────┤
            │  (INDEX     reveals downward from the strip)
            ├────────────────────────────────────────────┤
            │                                            │
  SCRATCH ⟸ │                THE PLATE                   │
  (slides   │     text ◀──── the tether ────▶ figure     │
   in from  │                                            │
   the left)│                                            │
            ├────────────────────────────────────────────┤
            │  (UNDERSIDE reveals upward from the floor) │
            └────────────────────────────────────────────┘
```

Five surfaces, one plane. Nothing overlaps anything, ever.

---

## 2. The tether: colour is the binding, hover is the emphasis

The vision notes ask for a "felt connection" between code and diagram. The considered
answer is that the connection should be **ambient first, interactive second**:

1. **Ambient binding (always on).** Every point name is set in a colour, and that colour
   is consistent between the text and the figure's labels. You can read the
   correspondence without touching anything — exactly as Byrne intended when he replaced
   letters with coloured shapes. This is the primary binding.

2. **Interactive emphasis (on hover).** Hovering either surface answers the question
   *"which one is this?"* by **recession, not decoration**: everything that is not the
   hovered entity drops to low ink, on both surfaces simultaneously. No glows, no
   tooltips, no pulsing. The plate stays a plate; it simply concentrates.

   - hover a point letter (either surface) → that point stays inked everywhere, all else recedes
   - hover a body clause → the shape it denotes stays inked, the clause underlines
   - hover the proof tick → it quietly extends into "view trace" (the sanctioned door
     to the underside)

3. **Navigation by reading.** Predicate words in body clauses (e.g. `eq-triangle` inside
   `eq-lines`) are navigable: the text is an active surface, per §15.5 of the vision notes.

Rule worth stating explicitly: **colour in the text is reserved for the binding.**
No syntax highlighting in reading mode. Keywords, punctuation, and predicate names take
the plate's ink; only point references take binding colours. Syntax colouring is an
editor convention and belongs, sparingly, to the scratchpad.

---

## 3. Composition of the plate

### 3.1 The figure owns the ground

The SVG canvas is the entire plate. The *named points* are composed into a zone on the
right (roughly the right third, vertically centred); the *geometry* — lines, circles —
runs wherever it must, off all four edges. Lines are always drawn infinite. Circles are
always drawn whole, even when mostly off-plate. The figure is never clipped to a frame,
because there is no frame.

### 3.2 The text is placed, not docked

The clause text sits at a fixed left anchor with a *chosen* vertical position:

- candidate positions are a small finite set (~12 y-positions)
- each is scored by sampling a grid of points against the figure's strokes and points
- least-overlap wins, with hysteresis (only move when meaningfully better)
- re-evaluated on load and on `pointerup` after a drag — never during one

The settle rhythm after a drag is a fixed, legible sequence:

> release → the figure re-fits its point cluster to the zone (≈380ms) → the text
> chooses its position (≤450ms slide)

This rhythm is the interface's signature move. It should feel like the plate quietly
re-composing itself — a letterpress printer nudging the type to fit the cut.

### 3.3 Text treatment in reading mode

- display type, generous leading, wide tracking, set in uppercase
- **uppercase is a visual treatment only** — the source remains lowercase, and copy/paste
  yields lowercase source. The text *is* the code; it is merely dressed for the page.
- head clause flush left; body clauses indented one em-quad; no box, no background,
  no border — if the placement algorithm cannot find clear ground, the *figure* yields
  (the point zone shrinks), not the text.

### 3.4 Proof status in reading mode

A single small tick after the head clause, in a restrained proof-green that sits outside
the binding palette. Silent when proven. On hover it extends to "view trace"; activating
it opens the underside. A failed lemma sets the tick in vermilion ✗ — same size, same
position, no banner. The plate must stay beautiful when wrong (vision §17.8).

---

## 4. Colourways: the material Byrne palette

One palette, five inks, used as **roles, not assignments**:

| token | value | character |
|---|---|---|
| `paper` | `#f3eee2` | warm stock, not screen-white |
| `ink` | `#1b1813` | near-black, warm |
| `ultramarine` | `#1d3fbf` | Byrne blue, printed not digital |
| `vermilion` | `#d93a1a` | Byrne red-orange |
| `gamboge` | `#e09c14` | Byrne yellow — the third primary the old draft was missing |

A **colourway** is an assignment of these inks to the plate's roles (ground, figure
strokes, point bindings, label ink). Each predicate gets a colourway; neighbouring
predicates in browse order should differ. Examples implemented in the prototype:

- `eq-triangle`: paper ground, ultramarine/vermilion figure, full-colour bindings
- `eq-lines`: vermilion ground, white figure, **black/white bindings only** —
  on a hot ground the bindings drop to two values; legibility beats system purity

Mode colourways: the scratchpad prints on `ink` ground with `gamboge` accent — a genuine
permutation of the same five inks, not a new hue (this replaces the purple from
`STYLE_TOKENS_DRAFT.md`, which broke the palette's discipline). The strip and underside
also live on `ink`, so the plate is always the brightest surface on screen — hierarchy
by ground colour, not by border.

Auxiliary (derived, non-argument) points print smaller and quieter than argument points —
the figure carries its own hierarchy: arguments loud, scaffolding quiet, sub-construction
shapes at ~30% ink.

---

## 5. The five surfaces

### 5.1 Strip
Tiles in the established vocabulary: `ELEMENTS | SCRATCHPAD | ⟨predicate⟩ ◀ ▶ | SEARCH`.
The viewer tile carries the current predicate name and prev/next, which walk the
topological order of the construction dependency graph (vision §15.4) — the book reads
in dependency order, no files, no folders. Absent until first interaction (see 5.6).

### 5.2 Index (search)
The strip grows downward an extra row; the plate cedes the space. Typing filters
predicate cards — each card a miniature plate in its own colourway, rendered live from
the same geometry that renders the full plate. The index is a contact sheet of plates.

### 5.3 Scratchpad
Lives permanently to the **left** of the viewer; opening it slides the whole track right
(tab-like persistence, stable spatial metaphor, vision §17.2). It is unapologetically an
editor: monospace, caret, gutter. Proof marks sit in the **left gutter** (✓ gamboge,
✗ vermilion), checked live with a short debounce. Its diagram obeys the same plate rules
on the same plane.

### 5.4 Underside (boffin panel)
Opens with `` ` `` or a near-invisible `§` in the floor corner, or via "view trace".
The plate gives up its lower band; nothing floats. Ink ground, three columns:
**construction plan · solver · proof trace**. The plan is printed in the planner's own
vocabulary (`α ≔ circle(a ; b)`, `c ≔ meet(α, β) ▸ upper`) — the underside speaks
machine, the plate speaks Euclid.

### 5.5 Hero entry
First load is a full-bleed plate of a curated construction with `ELEMENTS` set large on
the ground and one whispered caption: *drag the figure*. Touching the figure starts the
sequence: title fades, strip slides in (taking real space), text settles into place.
The user's first act in the system is doing geometry, not reading chrome.

### 5.6 Motion grammar
Three durations, one easing family, all motion is reallocation of space on the plane:

- **160ms** — emphasis (hover recession)
- **380–450ms** — re-composition (strip/index/underside taking space; figure re-fit; text placement)
- **600ms** — travel (scratchpad slide)

Nothing fades in *over* anything. Opacity transitions are reserved for ink (title,
text) on an already-settled ground.

---

## 6. Answers to the open questions (vision §18)

| open question | committed answer |
|---|---|
| animation grammar | three durations / one plane, §5.6 |
| reading-fallback vs editing boundary | length moves text to the margin anchor (no chrome); *intent* (click-to-edit / scratchpad) brings the editor; mode is never implied by layout alone |
| code surface per mode | reading: dressed source (display type, uppercase treatment, binding colours only); editing: honest monospace editor with gutter |
| diagram surface per mode | identical plate rules in both; only the colourway changes |
| shared interaction | the tether (§2): ambient colour + recession hover, symmetric in both directions |
| auxiliary detail reveal | underside only, three columns, entered by `` ` ``/§/view-trace |
| navigation | strip tile prev/next over topological order; index cards; predicate mentions in text are links |
| lemma layers | not in the default plate; an index-style reveal listing lemma slices is the candidate, deliberately deferred |
| how much current UI survives | conceptually none of the three-panel layout; all of the runtime/worker machinery |
| page, spread, or canvas? | **plate** |

---

## 7. What the prototype proves (and what it fakes)

`concept-prototype.html` is one self-contained file, no dependencies, real geometry.

Proven for real:
- both constructions are computed constructively (I.1 and I.2) and fully draggable
- the tether: bidirectional hover recession + ambient colour binding
- adaptive text placement with scoring + hysteresis, and the release→refit→place rhythm
- colourway permutation across predicates and modes
- all five surfaces tiling on one plane, including the hero sequence
- live index miniatures rendered from the same data as the plates

Faked, knowingly:
- the scratchpad "interpreter" is a toy relaxation pass, not the real KB pipeline
- proof traces / solver reports are static demo text
- only two predicates + stub cards; no graph-ordered browsing yet
- no in-text predicate-mention navigation yet

## 8. Suggested implementation path

1. Extract the colourway/typography tokens into `src/assets/` as CSS custom properties
   (replacing `STYLE_TOKENS_DRAFT.md`'s values with the material palette above).
2. Build `PlateView.vue` against the existing solver/planner output: figure-fit,
   text placement, tether. This is the heart and can ship while the old three-panel
   `MainView` still exists behind a flag.
3. Strip + index over `useKB`'s namespace tree, ordered topologically.
4. Scratchpad as the existing `EditorPane` re-skinned into the ink colourway with the
   gutter moved left.
5. Underside fed by the data the boffin panel already implies (plan, solver, worker
   verification results).
