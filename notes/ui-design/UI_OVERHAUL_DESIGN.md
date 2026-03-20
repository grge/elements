# UI Overhaul Design Notes

Date started: 2026-03-20
Status: early vision capture

This document records George's design direction for a major UI overhaul of **elements**.

The goal at this stage is **not** to solve the interface in implementation detail. The goal is to preserve the intended character, priorities, and conceptual direction clearly enough that later design and implementation work can proceed without drifting back toward default web-app / IDE habits.

---

## 1. Core direction

The redesign should move decisively away from the current **three-panel IDE style**.

The primary experience should instead foreground:

- the **code**
- the **diagram / illustration**
- the felt connection between them

These should appear together as the main event, with as little surrounding visual clutter as possible.

The intended relationship is something like:

- a text and its accompanying illustration
- two views of the same mathematical object
- two surfaces that are tethered to one another

The interface should communicate that the symbolic and geometric representations are deeply linked, even if the machinery behind them is complex.

---

## 2. Primary metaphor: book text and illustration

A strong source of inspiration should be the layout logic of a **book page**:

- proposition / code on one side
- illustration / diagram on the other
- both given enough space and dignity to stand on their own
- minimal chrome around them

This is not a request to literally imitate printed pages in a nostalgic or decorative way. It is a conceptual guide for:

- layout
- restraint
- clarity
- compositional balance
- the sense that the central objects are worth looking at directly

The desired feeling is closer to a beautifully arranged mathematical page than to a conventional SPA dashboard.

---

## 3. Visual philosophy

The interface should deliberately resist many of the dominant cues of modern web-app hierarchy.

In particular, it should minimise habitual use of:

- boxes
- panels
- overlays
- stacked layers
- heavy borders
- aggressively segmented cards
- generic control surfaces that visually overpower the content

These devices are not forbidden absolutely, but they should be used sparingly and with intent.

The default should be:

- open layout
- typographic structure rather than boxed structure
- spacing rather than borders
- composition rather than panelisation
- visual calm rather than interface noise

This is an important principle: the UI should avoid looking like an app made of containers.

---

## 4. Permanent core view

The core view should always be:

- **code to one side**
- **illustration to the other**

This pairing is not a temporary arrangement or one possible mode among many. It is the central identity of the interface.

The user should build an intuitive sense that:

- editing the code affects the diagram
- interacting with the diagram affects or illuminates the code
- these are not separate tools, but two linked expressions of the same thing

The system contains a great deal of hidden machinery:

- proof search
- numerical solving
- construction planning
- and other technical layers

But this machinery should generally remain backstage.

The primary presentation should not force the user to confront implementation layers unless they actually need them.

---

## 5. Hidden complexity, visible unity

A key design goal is to preserve a feeling of simplicity at the surface even when the underlying system is technically elaborate.

The viewer should mostly experience:

- code
- diagram
- their tight correspondence

rather than:

- solver state
- planner state
- inference internals
- developer tooling metaphors

This does **not** mean technical detail is unimportant.

It means technical detail should usually be:

- latent
- secondary
- intentionally revealed
- absent from the default composition

The default experience should suggest that the proposition and the diagram more or less speak for themselves.

---

## 6. Stylistic inspiration: Oliver Byrne

The interface should take inspiration from **Oliver Byrne's illustrated Elements**.

This should be understood as:

- a genuine influence
- a faithful nod
- not a literal reproduction or period pastiche

The useful aspects of that reference include:

- bold but disciplined use of colour
- colour as a carrier of structure and association
- strong interplay between text and geometry
- typographic confidence
- diagrams that feel integral to the page rather than auxiliary
- a sense that mathematical presentation can also be visually striking

The UI should preserve modern usability while borrowing some of that compositional spirit.

---

## 7. Colour direction

The palette should be:

- bold
- tasteful
- grounded in primary colours

Colour should not be merely decorative. It should be used structurally, especially to:

- associate geometric objects with code references
- help the eye track correspondence between symbolic and visual forms
- reinforce the sense that text and diagram belong together

Colour use should feel deliberate and legible, not loud or playful for its own sake.

---

## 8. Typography and layout

Typography and layout are central, not ornamental.

The UI should place strong emphasis on:

- readable, characterful typography
- proportion
- spacing
- balance between code and image
- visual rhythm
- the feeling that the work can sit on screen almost like a composed page or artwork

An important desired effect is that the proposition and diagram can be shown together in a way that feels almost self-sufficient: something you can look at, read, and contemplate directly.

---

## 9. What should be hidden most of the time

Although advanced technical details remain necessary, they should not dominate the main view.

Examples include:

- planner solutions
- performance controls / tuning knobs
- lower-level system state
- other diagnostic or implementation-specific controls

These should exist, but be:

- hidden by default
- exposed carefully
- accessed intentionally
- visually subordinate to the main code-and-diagram composition

The default interface should not read as an engineering dashboard.

---

## 10. Tension to preserve

A central tension in the design is:

- the system is sophisticated and multi-layered internally
- the visible experience should remain calm, direct, and unified

The redesign should therefore avoid two failures:

### Failure mode A: flattening away useful technical depth

The interface must not become so minimal that serious exploration, debugging, or deeper understanding becomes impossible.

### Failure mode B: letting technical machinery dominate the composition

The interface must not collapse back into a tool-heavy environment where the supporting mechanisms visually overpower the mathematical object itself.

The right goal is not to remove complexity, but to stage it properly.

---

## 11. Emerging principles

From the current vision, the following design principles already seem clear:

1. **Code and diagram are the central pair.**
2. **They should feel like two aspects of one object, not separate panes in a workbench.**
3. **The interface should minimise visual clutter and resist default SPA panel logic.**
4. **Typography, layout, and colour carry much of the hierarchy.**
5. **Technical machinery should mostly stay backstage.**
6. **Advanced controls should exist, but as deliberate secondary reveals.**
7. **The whole should feel composed, calm, and visually confident.**
8. **Oliver Byrne is an inspiration, but not a template to be copied literally.**

---

## 12. Two main modes of use

The design currently suggests two primary modes, with importantly different presentation styles.

### 12.1 Reading / viewing mode

In the first mode, the user is primarily **viewing named propositions or constructions**, in something analogous to reading *The Elements*.

Typical experience:

- the user navigates to a named construction or proposition
- they see the definition / code and the diagram laid out together
- the presentation is elegant, calm, and page-like rather than tool-like
- they can interact with the diagram directly by dragging points around
- the code and diagram remain tightly linked during interaction

This mode should feel like reading and contemplating a mathematical object, not editing source code in a development environment.

#### Code presentation in reading mode

In this mode, the code should **not** be presented in something that visually reads as a text editor.

Instead, it should be shown more like:

- carefully arranged mathematical / technical typography
- composed text on a page
- a readable, deliberate textual object

The emphasis here is on presentation, not on edit affordance.

#### Diagram presentation in reading mode

The diagram should occupy the **entire page / canvas**, even though its key geometric points are composed into a more specific region.

More specifically:

- the main cluster of points should occupy an area on the **right-hand side**
- the overall canvas still extends across the whole page
- lines and circles may extend into the left side of the page
- the diagram therefore feels spacious and fully present, not boxed into a local frame

This is an important compositional idea:

- the **points** are contained within a chosen visual region
- the **geometry** is allowed to extend beyond that region
- the **canvas** itself belongs to the whole page

#### Interaction between code and diagram in reading mode

The tether between text and geometry should be explicit and intuitive.

Examples already envisioned:

- hover over a point name in the code → highlight the corresponding point in the diagram
- hover over a point in the diagram → highlight the corresponding reference in the code
- hover over a relation / predicate → highlight the corresponding part of the diagram

So the user should be able to read either surface and feel the correspondence immediately.

#### Dynamic layout interaction between code and geometry

A particularly distinctive idea here is that the text layout should respond, within reason, to the geometry.

The current vision is:

- code is shown on the **left**
- diagram points occupy the **right**
- lines and circles may intrude into the left region
- the code's font size and exact positioning can be adjusted within reasonable constraints so that it avoids colliding awkwardly with diagram elements extending into that region

So the layout is not a rigid split-pane. It is more like a composed page in which text and geometry are arranged around one another.

To keep this tractable, current implementation intent is explicitly heuristic rather than globally optimal:

- lock the text block's left anchor
- evaluate a finite set of candidate vertical positions (e.g. ~20 y-locations)
- score overlap against diagram entities at each candidate
- choose the position with least overlap

Re-layout timing should also be constrained:

- run on page load
- run again on `mouseUp` after diagram interaction
- do not continuously reflow while dragging

Once a new position is chosen, animate the transition.

To avoid jitter/noise:

- use hysteresis so minor geometry changes do not trigger repositioning

Fallback behaviour is important:

- if no candidate position is acceptable, default to an anchored **left-margin** presentation

This margin view is also the same structural location used in editing mode, but in reading mode it should remain without editor chrome unless editing is explicitly entered.

This should be treated as an important design ambition, while keeping the algorithm intentionally practical and bounded.

### 12.2 Editing mode

In the second main mode, the user is **editing code**.

Examples:

- editing a user-defined construction
- working in a scratchpad
- making or testing changes directly in source

In this mode, the code should be shown in something that is recognisably a **text editor**.

This is an important distinction from reading mode:

- in reading mode, code is typographic presentation
- in editing mode, code is editor content

So the system should not force one visual treatment to awkwardly serve both purposes.

The design should preserve the difference between:

- reading a mathematical object
- editing the source of a mathematical object

#### Proof checking in editing mode

Lemmas should continue to be proof-checked automatically as the user types, as in the current system.

The current intended presentation in editing mode is:

- proof status shown in a **left-hand gutter**
- not on the right as in the current UI
- the gutter uses check / failure indicators to show proof success or failure

So editing mode retains a recognisably editor-like proof feedback mechanism, even if the surrounding UI is redesigned.

### 12.3 Proof-status continuity across modes

An important design principle here is that proof checking should remain continuous across modes, while its visual treatment can change.

That means:

- the underlying proof-checking behaviour remains available in both editing and reading contexts
- but the indicators do not need to look identical in both contexts

In **editing mode**, the proof markers can remain relatively close to code-editor conventions.

In **reading mode**, the same semantic information should likely be presented in a more refined, page-appropriate way:

- still adjacent to the code
- still legible and immediate
- but styled more like part of the book-like composition
- and less like raw code annotation chrome

So the distinction is:

- same underlying verification behaviour
- different visual language depending on mode

---

## 13. Persistent top bar and knowledge-base access

Even in reading / viewing mode, the user still needs a way to navigate the knowledge base.

The current idea is to have a **top bar that is always present**.

At minimum, this top bar would include:

- **ELEMENTS** in the top-left corner
- the name of the predicate / proposition / construction currently being viewed
- possibly very little else in the default state

This fits the general goal of restraint:

- the primary page remains dominated by code and diagram
- navigation chrome exists, but in a thin and stable form
- the interface does not dissolve into a large always-open browser structure

### 13.1 Knowledge-base navigation reveal

From the top bar, there should be some place to click in order to expose a panel for navigating the knowledge base.

The exact affordance is intentionally still open:

- it may be a title
- a wordmark
- an icon
- a region of the bar
- or something else

That detailed design choice remains unresolved for now.

What matters at this stage is the structural principle:

- the knowledge-base browser is accessible from the persistent top bar
- it is not necessarily always shown
- but it can be revealed when needed without turning the whole UI back into a permanent three-panel workbench

### 13.2 Strictly 2D spatial logic

An important visual / spatial principle has now emerged:

> the interface should maintain a strictly 2D sense of space.

This means:

- panels tile rather than overlay
- there is no important sense of z-order
- avoid dropdown-menu logic as a primary organising device
- avoid floating layers becoming the default way complexity appears
- avoid visual metaphors that imply stacked sheets or hovering tool surfaces

This is consistent with the broader desire to avoid heavy SPA layering conventions.

The interface should feel as though it is composed on a plane:

- surfaces sit beside one another
- or replace one another
- or expand by taking real space
- rather than popping above the page as floating strata

The detailed mechanics of this still need design work, but the underlying principle should be treated as an important constraint.

---

## 14. Hidden technical detail: the boffin panel

The current idea for exposing deeper technical machinery is a dedicated **boffin panel**.

This is conceptually closer to:

- developer tools
- an advanced inspection area
- a backstage technical surface

than to something that should be present in the main composition all the time.

### 14.1 Role of the boffin panel

This panel is where the user can access things like:

- settings
- performance knobs
- planner results
- solver results
- technical diagnostics
- other lower-level detail that supports serious work but should not dominate the primary interface

This gives the design a concrete answer to the earlier tension:

- the surface presentation remains calm and book-like
- the technical apparatus still exists and remains available
- but it is staged explicitly as secondary / expert-facing detail

### 14.2 Spatial behaviour

The boffin panel should:

- reveal from the **bottom**
- be **hidden by default**
- remain visually and conceptually subordinate to the main page

This seems consistent with the 2D tiling principle, provided it is handled as a real reallocation of space rather than as a floating overlay.

So the intended feeling is not “a drawer hovering over the page”, but rather “the page gives up some lower space to reveal the technical underside”.

That exact motion and composition remain for later detailed design, but the principle is already useful.

### 14.3 Discoverability

The affordance for opening the boffin panel should be deliberately restrained.

Current direction:

- the visible button may be extremely subtle
- or it may even be primarily / exclusively accessed by keyboard shortcut

That is an intentional choice, not an omission.

The panel is meant to be available to users who need it without constantly advertising technical machinery to every viewer.

In that sense, it functions as a kind of advanced backstage layer without visually becoming a dominant layer.

### 14.4 One explicit hook: proof trace access

One concrete, justified hook into the boffin panel comes from proof status.

Current idea:

- when the user hovers a green proof-success indicator
- they are exposed to a link / affordance to show the proof trace
- activating that affordance opens the proof trace in the boffin panel

This is important because it gives the boffin panel a natural point of entry:

- the surface presentation stays minimal by default
- but proof success can lead, on demand, into deeper technical structure
- the transition feels motivated by the user's immediate context rather than by an always-visible tool palette

This may become one of the main sanctioned pathways from the composed reading/editing surface into the more technical underside of the system.

---

## 15. Updated browsing model and knowledge-base unit

The browsing model has now shifted in a major way.

### 15.1 Primary unit: predicate across the whole KB

The user browses to a **predicate** in the knowledge base, and the default view shows:

- all **Horn clauses** whose head predicate matches that predicate
- regardless of file/folder origin

So the core unit is now:

> a predicate-level view over the global KB, not a predicate-within-folder slice

### 15.2 Files/folders are no longer UI concepts

A deliberate design decision:

- files and folders are not used for navigation
- files and folders are not used for namespacing
- files and folders are not used as user-facing organisational concepts

They may still exist as implementation/storage concerns, but they are no longer first-class concepts in the browsing UI.

### 15.3 Lemmas are distinct from Horn-clause definitions

Another important clarification:

- lemmas are treated distinctly from Horn clauses
- navigating to a predicate does **not** automatically bring in all associated lemmas
- the default predicate view is Horn-clause-centric

This helps keep the main browsing surface focused and avoids overloading definition/constructive views with proof material by default.

At the same time, current direction is to support lemmas as an **optional extra layer** that can be added to a predicate view when needed.

Potential layer scopes include:

- lemmas that imply the current predicate
- lemmas implied by the current predicate
- lemmas that involve the current predicate anywhere in the body
- potentially other relation-based slices

So lemma material is not absent; it is selectively composable over the base Horn-clause view.

The exact exposure and display strategy for this layer remains open.

### 15.4 Navigation should leverage graph structure

To aid navigation and presentation order, the UI should use actual KB graph structure.

Current direction includes:

a) Predicates that are purely definitional/constructive should be visually distinct from more core-level predicates that involve multiple definitions, recursion, or heavier logical structure.

b) For purely constructive predicates, use topological ordering on the construction dependency graph so there is a natural order for presentation and browsing.

This provides a principled alternative to file/folder hierarchy and should guide actual browser UI design.

### 15.5 In-text predicate mention navigation

The interface should expose a direct way to navigate to a predicate view from predicate mentions inside source text shown in another view.

In practice, this means predicate references in code/clauses should be navigable affordances so users can follow the KB by reading.

This supports a natural exploratory workflow:

- read a clause
- notice a referenced predicate
- jump directly to that predicate's view

So source text becomes an active navigation surface, not only display content.

---

## 16. Transition behaviour between viewing and editing

A key requirement is that transitions between viewing and editing should feel graceful and continuous.

Current direction:

- transitions are **seamless animations**
- mode shifts should feel like a re-composition of one coherent surface
- not a hard context switch between two unrelated apps

So the user should feel continuity of object and place while the interface adapts.

### 16.1 Adaptive layout is not only mode-switch driven

A critical refinement: transition behaviour is not triggered only by explicit “enter edit mode”.

The UI should also adapt automatically based on content density.

Example given:

- when viewing a long body of code (e.g. ~100 lines of lemmas)
- the system should detect that this exceeds what the beautiful book layout can carry
- and move the code toward a margin/side treatment more like an editor panel

So the composition can fluidly shift along a spectrum based on practical readability constraints.

### 16.2 No premature editor chrome in adaptive states

Even when the text shifts toward a margin/side-panel form because of length, this does **not** automatically mean the UI should signal full editor mode.

Current principle:

- layout may become more editor-like for readability
- but visible editor cues/chrome should remain suppressed unless the user is actually in editing mode

This preserves the reading character of the page while still accommodating larger texts.

In short:

- **composition can adapt continuously**
- **mode identity remains intentional**

---

## 17. Entry Experience & Navigation Flow (March 21, 2026)

### 17.1 Hero Construction Entry Point

First open should display a **hero construction with minimal chrome**:
- Hero construction diagram fills the view
- "ELEMENTS" title overlaid using diagram-dodging positioning  
- No top bar or other interface chrome initially
- User interaction (clicking/dragging diagram) triggers sequence:
  - "ELEMENTS" title fades out
  - Top bar slides in from top (compressing main view area vertically)
  - Code view fades in with floating position, showing the construction's definition (e.g., for eq-triangle: "eq-triangle a b c:\n circle a b c\n circle b a c")
- **Top bar content**: Tile-based layout: `[ ELEMENTS | SCRATCHPAD | VIEWER | SEARCH ]`
  - Active mode (SCRATCHPAD/VIEWER) indicated by color  
  - VIEWER tile expands when active to include current predicate name + prev/next navigation arrows
  - All elements use tile visual vocabulary from Byrne aesthetic
- **Search interaction**: Clicking SEARCH expands header area downward (additional row), compressing main area vertically. Search results display as predicate cards in the expanded space as user types.

### 17.7 Boffin Panel Scope

**Developer/debugging focus** - not core user experience:
- Contains technical diagnostics (proof traces, solver diagnostics, performance metrics)
- **Design principle**: Main UI must be legible in all states including errors
- Important system information surfaces in main UI, not hidden in boffin panel

### 17.8 Error State Design

**Integrated error presentation**:
- **Proof failures**: Red check mark next to affected lemma/query
- **Solver/planner errors** (preventing diagram display): Use color palette changes + error messaging
- **Aesthetic principle**: Maintain poster aesthetic even in error states - errors should be attractive and consistent with visual vocabulary
- **Timing**: Live feedback with slight debounce during editing
- **Hero selection**: Initially pick one appealing construction, potentially evolve to random rotation from hand-curated subset

### 17.2 Context Switching Model

**Tab-like behavior without visual tabs** (preserves 2D tiling rule):
- Scratchpad maintains persistent state (like browser tab)
- Last viewed predicate maintains state
- Spatial metaphor: scratchpad "exists to the left", navigation/viewing "to the right"  
- Slide panels for transitions rather than overlays

### 17.3 Color Permutation System

**Palette permutations** for different contexts:
- Viewer mode: one permutation of core palette
- Scratchpad mode: different permutation  
- User-defined predicates: potentially third permutation
- **Tensions to resolve**: top bar color changes, construction gallery colors, user theme preferences (dark/light), other semantic color uses

### 17.4 Adaptive Code Positioning Logic

**Grid-based positioning with hysteresis**:
- Try grid of candidate positions on left side
- Score by overlap with diagram elements (lines, circles)
- Use hysteresis to prevent unnecessary movement
- Triggered: on mouseUp after diagram interaction, on construction load
- Fallback: margin-locked position with animated transition
- **Timing sequence**: Wait for mouseUp → diagram auto-zoom/pan to contain all points in right-side zone → THEN calculate code position based on final diagram state
- **To resolve**: exact overlap calculation method

### 17.5 Knowledge Base Organization  

**Three-tier structure**:
- **Core predicates** (point, line, circle, etc.) - auto-discovered
- **Constructions** (eq-triangle, etc.) - auto-discovered, potentially hand-curated into Books
- **User constructions** - auto-discovered
- Mini diagram previews for each predicate card

### 17.6 Sliding Panel Navigation

**Full slide-out behavior**:
- Current view slides completely off-screen
- New view slides in to replace it
- Consistent spatial metaphor (scratchpad left, navigation right)
- No view compression or overlay layers

---

## 18. Questions left open for later

The following have not yet been decided, and should remain open for now:

- What exact animation grammar and timing should govern seamless transitions between layout states and explicit mode changes
- Where the boundary is between adaptive "reading-layout fallback" and true editing mode
- What exact form the code surface takes in each mode
- What exact form the diagram surface takes in each mode
- How interaction is shared between code and diagram
- How auxiliary technical detail is revealed
- Whether secondary tools appear inline, via drawers, via mode shifts, or some other mechanism
- How navigation works across propositions, predicates, or larger structures
- How optional lemma layers should be exposed in the UI (controls, defaults, discoverability)
- How lemma layers should be displayed so they remain legible without overwhelming the base Horn-clause view
- Which lemma relation slices are first-class (implying current predicate, implied-by, mentioned-in-body, etc.)
- How much of the current editor/browser model survives in any transformed form
- How much the main composition should resemble a page, spread, canvas, or something else entirely

These should be answered only after more of the vision has been articulated.

---

## 18. Working summary

The redesigned UI for **elements** should centre on a restrained, book-like composition in which code and diagram sit side by side as two tightly linked views of the same mathematical object.

It should avoid the default visual language of contemporary SPAs and IDEs — especially boxes, panels, overlays, borders, and layered chrome — in favour of typography, spacing, colour association, and compositional clarity.

It should take real inspiration from Oliver Byrne's illustrated *Elements*: not as retro ornament, but as a model for how text, diagram, colour, and page structure can work together with confidence.

The interface should feel calm and self-possessed at the surface, while keeping the system's deeper technical machinery available but mostly out of sight.
