# Euclid Visual Style Notes (Full 16-image pass)

Source set reviewed in full:
- `notes/ui-design/euclid-images/euclid-01.png` … `euclid-16.png`

---

## What the set actually contains

The deck is not one static style plate; it shows several related layout modes:

1. **Hero proposition pages** (code left, diagram right/full)
2. **Palette inversion variants** (same composition, swapped bg/fg)
3. **Catalogue/index page** (`CONSTRUCTIONS` cards)
4. **Sandbox/workbench variants** (visible split panes + heavier scaffolding)
5. **Annotated pages** (notes panel / polynomial panel)

Also: `euclid-07.png` and `euclid-08.png` appear duplicated (same colour test grid).

---

## Strong recurring style signals

### 1) Hard, limited palette
- Dominant colours: **blue**, **orange-red**, **near-black**, **white**, **light gray**.
- Palette is intentionally small and high-contrast.
- Colours are swapped/inverted across variants while preserving structure.

### 2) Typography as structure
- Heavy uppercase display type drives hierarchy.
- Header strips and proposition labels are blocky and assertive.
- Code-like lines are set as editorial text, not monospace editor UI.

### 3) Diagram-first clarity
- Geometric primitives are bold and clean (circles/lines/points).
- Labels (A, B, C, etc.) are large enough to read at distance.
- Figure-ground contrast is always strong.

### 4) Top strip navigation identity
Nearly every page has a persistent top strip pattern:
- `ELEMENTS` block
- context block(s): `BOOK I`, `EQ-TRIANGLE`, `EQ-LINES`, etc.
- hard-edged rectangular segments with no soft card styling.

### 5) Low ornament, high geometry
- Very little decorative texture.
- Rectangles, lines, circles, text blocks do the work.
- The aesthetic is “mathematical poster/page,” not “modern app glassmorphism.”

---

## Important nuance from the full set

Earlier summary risked over-romanticizing “pure book page.”
The full set shows two families:

- **Composed reading plates** (closest to your target)
- **Explicitly paneled utility layouts** (sandbox, notes, polynomial sections)

So the useful takeaway is not “copy every screen,” but:
- adopt the **colour/typography/geometry language**,
- keep the **calm reading composition** as default,
- selectively allow utility splits for technical/auxiliary content (aligned with your boffin-panel idea).

---

## Direct implications for Elements UI design

1. **Keep the constrained palette** (blue / orange-red / black / white + neutral gray).
2. **Use colour semantically** for point/predicate correspondence.
3. **Retain bold header strip identity** while keeping it minimal.
4. **Default to composed reading layout** (code + figure).
5. **Allow secondary technical layouts** only when context demands (notes, diagnostics, derived forms).
6. **Avoid soft, layered SPA chrome**; use hard planar blocks and typography instead.

---

## 8) Keep / Drop / Transform (George review)

### Keep
- Bold colour combinations and high-contrast figure/ground play.
- Thick line style in diagrams and panel/boundary treatment.
- Poster-like energy and compositional ambition.
- Catalogue/index grid concept: predicate name + miniature diagram + colour permutations + generous whitespace.
- All-caps voice as part of the visual identity.
- Strategic use of white borders/panels (and occasional "missing panel" feeling) to break rigid boxiness.

### Drop
- Overly digital-feeling blue/red choices in the old deck.
- Clunky pseudo-De Stijl heaviness.
- Annotation pages in their current form (do not land).
- Implicit assumption that one font/style everywhere is required.

### Transform
- Move palette toward more **material** colour character.
- Build a fuller swatch system (shades/tones per hue) plus explicit combination rules.
- Consider bold non-fixed colour semantics: allow broad palette permutations in figure/ground/highlight rather than strict one-colour-one-role mapping.
- Preserve poster aesthetic, but accept that strong poster composition requires deliberate craft (not just minimalism by subtraction).
- Introduce true typographic hierarchy while preserving the uppercase identity and overall graphic coherence.
- Re-think how detail/noise (annotations, technical text) enters a poster aesthetic without breaking it.

---

## 9) Practical token direction (design pre-work)

Recommend next artifact: `STYLE_TOKENS_DRAFT.md` containing:
- core palette tokens (bg-primary, bg-alt, ink, accent-hot, accent-cool)
- tone ramps per hue (light/mid/deep variants)
- permitted pairing rules (bg/fg/highlight permutations)
- text role tokens (display, title, section, clause, annotation)
- geometry tokens (stroke width, point size, label weight)
- layout tokens (top-strip height, left text column width bands, panel separators)

This would translate visual language into implementation-ready constraints without coding the UI yet.
