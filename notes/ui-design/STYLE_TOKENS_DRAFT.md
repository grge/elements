# Style Tokens Draft

Date: 2026-03-21
Status: Initial draft for Elements UI overhaul

This document establishes the visual design language for the new book-like Elements interface, drawing from Oliver Byrne's illustrated geometry and the requirements outlined in UI_OVERHAUL_DESIGN.md.

---

## Color System

### Core Palette
Based on Byrne's hard, limited palette approach:

```
Primary Colors:
- Byrne Blue: #2563eb (primary geometric elements)
- Byrne Red: #dc2626 (secondary geometric elements, errors)  
- Deep Black: #0f0f0f (text, strong contrast)
- Pure White: #ffffff (backgrounds, negative space)
- Mid Gray: #6b7280 (subtle elements, disabled states)
```

### Semantic Color Roles

```
Background System:
- bg-primary: #ffffff (default background)
- bg-alt: #0f0f0f (inverted mode)
- bg-surface: #f8fafc (elevated surfaces)

Foreground System:  
- text-primary: #0f0f0f (main text)
- text-secondary: #6b7280 (secondary text)
- text-inverse: #ffffff (on dark backgrounds)

Accent System:
- accent-primary: #2563eb (primary actions, highlights)
- accent-secondary: #dc2626 (warnings, errors, secondary highlights)
- accent-success: #059669 (proof success states)
- accent-error: #dc2626 (errors, failures)
```

### Mode Permutations
Support for context-based palette shifts:

```
Viewer Mode (Default):
- Uses standard palette as defined above

Scratchpad Mode:  
- bg-primary: #f8fafc
- accent-primary: #7c3aed (purple shift for differentiation)

Error State Mode:
- Shifts warm (more red in accents)
- bg-surface: #fef2f2 (subtle red tint)
```

---

## Typography System

### Font Stack
```
Primary: 'Inter', 'Helvetica Neue', sans-serif
Display: 'Inter', 'Helvetica Neue', sans-serif  
Code: 'JetBrains Mono', 'Consolas', monospace
```

### Text Roles & Scales

```
Display Text:
- display-large: 2.5rem, 700 weight, uppercase, letter-spacing: 0.1em
- display-medium: 2rem, 700 weight, uppercase, letter-spacing: 0.05em
- display-small: 1.5rem, 600 weight, uppercase, letter-spacing: 0.05em

Interface Text:
- title-large: 1.25rem, 600 weight
- title-medium: 1.125rem, 600 weight  
- body-large: 1rem, 400 weight
- body-medium: 0.875rem, 400 weight
- body-small: 0.75rem, 400 weight

Code Text:
- code-large: 1rem, 400 weight (floating code blocks)
- code-medium: 0.875rem, 400 weight (editor mode)
- code-small: 0.75rem, 400 weight (annotations)
```

### Typography Usage Rules

```
Headers/Navigation: Always uppercase, bold weight
Predicate Names: display-medium in viewer mode, title-large in listings
Code Blocks: 
  - Reading mode: code-large, generous line-height (1.6)
  - Editing mode: code-medium, tight line-height (1.4)
Labels: body-small, uppercase, letter-spacing
```

---

## Layout System

### Grid & Spacing

```
Base Unit: 0.25rem (4px)

Spacing Scale:
- xs: 0.25rem (4px)
- sm: 0.5rem (8px)  
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)
- 3xl: 4rem (64px)
```

### Layout Zones

```
Top Bar:
- Height: 3rem (48px)
- Padding: 0.75rem horizontal
- Tile spacing: 0.25rem gaps

Main Area:
- Code column width (margin-locked): 320px
- Code column width (floating): 280px max
- Diagram area: Remaining space, minimum 400px wide

Search Expansion:
- Additional height: 8rem (128px) 
- Card size: 120px x 80px
- Card spacing: 1rem gaps
```

### Responsive Breakpoints

```
Mobile: < 768px (special mobile layout, future)
Tablet: 768px - 1024px (compressed spacing)  
Desktop: > 1024px (full spacing)
Wide: > 1400px (additional breathing room)
```

---

## Component Tokens

### Tiles (Top Bar Elements)

```
Tile Base:
- Height: 2.5rem
- Padding: 0.5rem 1rem
- Border-radius: 0.25rem
- Background: transparent
- Border: 2px solid transparent

Tile Active:
- Background: accent-primary
- Color: text-inverse
- Border: 2px solid accent-primary

Tile Hover:
- Background: bg-surface
- Border: 2px solid accent-primary
```

### Cards (Predicate Listings)

```
Card Base:
- Width: 160px
- Height: 120px  
- Padding: 1rem
- Border-radius: 0.5rem
- Border: 2px solid mid-gray
- Background: bg-primary

Card Hover:
- Border-color: accent-primary
- Transform: translateY(-2px)
- Shadow: 0 4px 12px rgba(0,0,0,0.1)

Card Active:
- Border-color: accent-primary
- Background: bg-surface
```

### Code Blocks

```
Code Block (Reading Mode):
- Background: rgba(248, 250, 252, 0.9)
- Padding: 1.5rem
- Border-radius: 0.5rem
- Border: 1px solid rgba(107, 114, 128, 0.2)
- Backdrop-blur: 8px

Code Block (Editing Mode):  
- Background: bg-primary
- Padding: 1rem
- Border: 2px solid accent-primary
- Border-radius: 0.25rem
```

### Proof Indicators

```
Proof Success:
- Color: accent-success
- Size: 1rem
- Symbol: ✓

Proof Error:
- Color: accent-error  
- Size: 1rem
- Symbol: ✗

Proof Pending:
- Color: mid-gray
- Size: 1rem  
- Symbol: ⋯
```

---

## Animation System

### Transition Timing

```
Fast: 150ms (hover states, quick feedback)
Medium: 300ms (mode changes, repositioning)  
Slow: 500ms (panel slides, major layout changes)

Easing:
- ease-out: cubic-bezier(0, 0, 0.2, 1) (entering elements)
- ease-in: cubic-bezier(0.4, 0, 1, 1) (exiting elements)  
- ease-in-out: cubic-bezier(0.4, 0, 0.2, 1) (repositioning)
```

### Specific Animations

```
Code Block Repositioning:
- Duration: 300ms
- Easing: ease-in-out
- Properties: transform (translate)

Panel Slides:
- Duration: 500ms  
- Easing: ease-out
- Properties: transform (translateX)

Top Bar Reveal:
- Duration: 300ms
- Easing: ease-out
- Properties: transform (translateY), opacity

Mode Transitions:
- Duration: 300ms
- Easing: ease-in-out
- Properties: background-color, border-color
```

---

## Geometry Rendering

### Diagram Elements

```
Points:
- Radius: 6px
- Fill: accent-primary
- Stroke: 2px solid bg-primary (white outline)

Lines:
- Stroke-width: 2px
- Color: accent-primary
- Opacity: 0.8

Circles:
- Stroke-width: 2px  
- Fill: none
- Color: accent-secondary
- Opacity: 0.6

Labels:
- Font: body-medium, 600 weight
- Color: text-primary
- Background: bg-primary with subtle shadow
- Padding: 0.25rem 0.5rem
- Border-radius: 0.25rem
```

### Interaction States

```
Hover (Points):
- Scale: 1.2
- Shadow: 0 2px 8px rgba(37, 99, 235, 0.3)

Active/Dragging (Points):
- Scale: 1.3
- Color: accent-secondary
- Shadow: 0 4px 12px rgba(220, 38, 38, 0.4)

Highlighted (from code hover):
- Pulse animation: 1s ease-in-out infinite
- Color: accent-secondary
```

---

## Implementation Notes

### CSS Custom Properties Structure

```css
:root {
  /* Colors */
  --color-byrne-blue: #2563eb;
  --color-byrne-red: #dc2626;
  --color-deep-black: #0f0f0f;
  --color-pure-white: #ffffff;
  --color-mid-gray: #6b7280;
  
  /* Semantic tokens */
  --bg-primary: var(--color-pure-white);
  --text-primary: var(--color-deep-black);
  --accent-primary: var(--color-byrne-blue);
  
  /* Typography */
  --font-primary: 'Inter', 'Helvetica Neue', sans-serif;
  --font-code: 'JetBrains Mono', 'Consolas', monospace;
  
  /* Layout */
  --unit: 0.25rem;
  --top-bar-height: 3rem;
  --code-width-margin: 320px;
  --code-width-floating: 280px;
}

[data-mode="scratchpad"] {
  --bg-primary: #f8fafc;
  --accent-primary: #7c3aed;
}
```

### Component Architecture Implications

This token system suggests the following component structure:
- `BaseButton` with tile variants
- `PredicateCard` with hover/active states  
- `CodeBlock` with mode-aware styling
- `GeometryRenderer` with consistent element styling
- `TopBar` with expandable search area
- `ModeProvider` for context-based token switching

---

## Next Steps

1. Implement CSS custom properties system
2. Create base component library using these tokens
3. Test color permutation system across modes
4. Validate accessibility (contrast ratios, etc.)
5. Refine animation timing through user testing