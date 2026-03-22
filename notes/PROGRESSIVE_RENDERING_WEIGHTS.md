# Progressive Rendering with Weights: Layered Diagram Complexity

Date: 2026-03-22

## Summary

Introduce a weight-based progressive rendering system that allows diagrams to show different levels of detail based on construction nesting depth. Surface structure (primary constructions) gets high visual prominence while guide lines and derived properties fade into the background, reducing visual clutter in complex diagrams.

## Core Concept

Each drawing element (lines, circles, points, annotations) gets assigned a **priority weight** based on:

1. **Construction depth** in the nesting hierarchy
2. **Element type** (primary construction vs derived property vs guide line)
3. **Context** (standalone diagram vs part of larger construction)

Elements with **lower priority numbers** are more prominent; higher numbers are more subtle or hidden entirely at lower detail levels.

## Weight Assignment Rules

### Base Priority by Element Type

- **Derived properties** (equal-line annotations, angle marks): priority 1  
- **Primary constructions** (circles, fundamental lines): priority 2
- **Guide lines** (construction aids, intermediate steps): priority 3

### Nesting Adjustment

When a construction appears as a subconstruction within a larger diagram, add +1 to all its priorities:

```txt
# Standalone eq-triangle
eq-triangle a b c:
    circle a b c        # priority 2 (construction method)
    circle b a c        # priority 2 (construction method)
    ? eq-lines a b a c  # priority 1 (key property!)
    ? eq-lines b c b a  # priority 1 (key property!)

# eq-triangle used within larger construction
complex-construction x y z:
    eq-triangle a b c   # nested: eq-lines → priority 1, circles → priority 3
    # ... more construction steps at priority 2
```

### Progressive Display

The UI can then offer different **detail levels**:

- **Level 1**: Show only priority 1 elements (essential structure)
- **Level 2**: Show priorities 1-2 (add derived properties) 
- **Level 3**: Show priorities 1-3 (full detail including guides)

## Example: Complex Construction

Consider a construction that uses multiple triangles:

```txt
triangle-tessellation a b c d e f:
    eq-triangle a b c
        # circles at priority 1, eq-lines at priority 2
    eq-triangle d e f  
        # circles at priority 1, eq-lines at priority 2
    connecting-line c d
        # line at priority 1
```

When rendered:

- **Priority 1 view**: Shows the essential properties (equal-side annotations) and main connecting elements
- **Priority 2 view**: Adds the construction method (triangle circles, connecting line)  
- **Priority 3 view**: Shows detailed construction aids and guide lines

But if this tessellation itself becomes part of an even larger construction, all priorities shift +1, so the triangle circles become priority 2 (less prominent) and the equal-side annotations become priority 3 (subtle/hidden at low detail levels).

## Visual Rendering Strategy

### SVG Styling by Priority

```css
.priority-1 { stroke-width: 2px; stroke: #000; opacity: 1.0; }
.priority-2 { stroke-width: 1.5px; stroke: #666; opacity: 0.8; }
.priority-3 { stroke-width: 1px; stroke: #999; opacity: 0.5; }
.priority-4 { stroke-width: 0.5px; stroke: #ccc; opacity: 0.3; }
```

### Contextual Detail Revelation

**No explicit UI controls** - detail emerges through natural interaction:

- **Source code hover/click**: Hovering over `eq-triangle a b c` in the editor temporarily reveals all related diagram elements (the circles used to construct it, any derived property annotations)
- **Diagram element focus**: Clicking on a point/line/circle in the diagram reveals the construction steps and properties that involve that element
- **Predicate highlighting**: When a specific predicate is selected in the code, all diagram elements derived from that predicate get enhanced visibility
- **Progressive disclosure**: By default show only the essential properties (priority 1), but context actions temporarily reveal the underlying construction methods

This maintains the "browser is the editor" philosophy - the code and diagram are tightly coupled, and interaction with either surface reveals detail in both.

## Integration with Embedded Lemma Syntax

The embedded query syntax provides the metadata needed for smart weight assignment:

```txt
perpendicular-bisector a b m:
    circle a m b        # priority 2: construction method
    circle b m a        # priority 2: construction method  
    ? eq-lines a m b m  # priority 1: key property (embedded query)
    ? perpendicular p-bisector original-line  # priority 1: key property
```

The system knows that embedded queries (marked with `?`) represent derived properties and should get priority 2, while the main construction steps get priority 1.

## Benefits

### 1. Reduced Visual Clutter

Complex diagrams become readable by hiding non-essential detail until explicitly requested.

### 2. Educational Progression  

Students can build understanding incrementally:
1. See the essential **properties** first (what makes this construction significant)
2. Add construction methods to understand **how** those properties are achieved  
3. View full construction detail including aids and intermediate steps

### 3. Context Awareness

The same construction can be rendered differently depending on whether it's standalone or part of a larger diagram.

### 4. Interactive Exploration

Users can explore different levels of detail dynamically, finding the right balance between completeness and clarity for their current task.

## Implementation Considerations

### Pipeline Architecture Changes

The current rendering pipeline needs significant restructuring to preserve depth information:

**Current Pipeline:**
1. `unfold()` → flat list of drawable predicates (loses nesting depth)
2. Canonicalization → merge redundant elements (e.g., `circle a b c` + `circle a b d`)
3. Forward closure → derive transitive facts (e.g., `eq-lines` transitivity)
4. Render → SVG generation

**Required Changes for Progressive Rendering:**

1. **Structured Unfold**: Replace flat `unfold()` with depth-preserving expansion
   - Return derivation tree instead of flat fact set
   - Track depth/priority for each derived fact
   - Preserve source clause metadata
   - **Eliminate hardcoded unfolding frontier**: Use natural stopping conditions instead of `stopPred: p => GEOMETRY_FRONTIER.has(p.name)` to preserve full derivation trees

2. **Smart Extraction Implementation**:
   - Replace `GeometryProblem` with unified `SmartGeometryExtraction`
   - Implement structured unfold that preserves complete derivation trees
   - Build multi-consumer API serving solver, planner, and renderer needs

3. **Priority-Aware Canonicalization**: 
   - Merge equivalent elements while preserving minimum priority
   - Handle cases where `circle a b c` appears at multiple priorities
   - Result: canonical element gets best (lowest) priority

4. **Context-Aware Rendering**: 
   - Map priorities to visual styling (CSS classes)
   - Support contextual detail revelation via hover/click
   - Maintain element-to-source traceability for interactions

### Renderer Changes

- Extend SVG generation to include priority-based CSS classes
- Add dynamic style switching based on current detail level
- Consider smooth transitions between detail levels

### Contextual Interaction

- **Source-diagram linking**: Hover/click on predicates in source reveals related diagram elements
- **Diagram-source linking**: Click on diagram elements highlights relevant source lines
- **Focus-driven revealing**: Temporary detail enhancement based on current focus, not persistent state
- **Smooth transitions**: Fade in/out construction details as focus changes

### Priority Calculation

- Implement recursive nesting depth calculation during structured unfold
- Cache priority assignments for performance
- Handle edge cases (mutual recursion, complex nesting)
- Resolve priority conflicts when elements have multiple derivation paths

### Data Structure Changes

Current `unfold()` returns `Set<Fact>`. New approach needs:

```typescript
interface DepthFact {
  predicate: string
  args: string[]
  depth: number
  sourceClause?: string  // for tracing
  derivationPath?: string[]  // for debugging
}

interface StructuredUnfoldResult {
  facts: DepthFact[]
  maxDepth: number
}
```

This preserves enough information for priority assignment while maintaining the ability to do canonicalization and forward closure with appropriate priority inheritance rules.

## Current Pipeline Analysis

Based on code inspection, your assumptions about the rendering pipeline are **completely accurate**:

### Current Flow (Confirmed)

1. **`unfold(goal, kb, visiting, options)`** in `src/kb/inference.ts`:
   - Returns `{ frontier: GroundPredicate[], expanded: boolean }` 
   - **Flattens completely** - no depth information preserved
   - Stops at `GEOMETRY_FRONTIER` predicates via `stopPred` option

2. **`frontierFactsFromRuntime(runtime)`** in `src/geometry/extraction.ts`:
   - Calls `unfold()` on each fact with `stopPred: p => GEOMETRY_FRONTIER.has(p.name)`
   - Deduplicates via `Map<string, GroundPredicate>` but **loses all depth info**
   - Returns flat `GroundPredicate[]`

3. **`canonicalise(problem)`** in `src/geometry/canonicalization.ts`:
   - Groups equivalent elements: `collinear` → `Lines`, `on-circle` → `Circles` 
   - Uses UnionFind for `eq-dist` equivalence classes
   - **No priority metadata** in current `GeometryProblem` type

4. **`renderSVGWithTransform()`** in `src/helpers.ts`:
   - Renders canonical lines/circles with fixed styling
   - **No priority-based CSS classes** or layered styling

### Additional Issues Discovered

Beyond the core flattening problem, several other issues would block progressive rendering:

#### 1. **Smart Extraction Structure**

**Recommended Approach: Unified Smart GeometryExtraction**

Replace the current flat `GeometryProblem` with a sophisticated structure that manages the complete derivation tree and serves all consumers:

```typescript
interface SmartGeometryExtraction {
  // Core derivation tree with priority metadata
  derivationTree: DerivationNode[]
  
  // Multi-consumer API
  getConstraints(): Constraint[]           // for solver
  getConstructionElements(): PlanElement[] // for planner  
  getRenderElements(priority?: number): RenderElement[] // for renderer
  
  // Intelligent processing
  canonicalize(): void                     // priority-aware merging
  computeTransitiveClosure(predicate: string): void // eq-lines transitivity
  
  // Interactive support for progressive rendering
  getElementsRelatedTo(sourceClause: string): RenderElement[]
  getDerivationPath(element: RenderElement): DerivationNode[]
  filterByPriority(maxPriority: number): SmartGeometryExtraction
}
```

This **replaces** the current `GeometryProblem` entirely with something that can serve solver, planner, and renderer from unified data.

#### 2. **eq-lines Not Rendered Yet**
The `eq-lines` predicate converts to `eq-dist` constraints during extraction but **no visual eq-lines marks exist yet**:
- `extraction.ts`: `eq-lines` → `EqualDistConstraint` 
- `canonicalization.ts`: `eq-dist` → distance equivalence classes
- `helpers.ts`: **No eq-lines rendering code** (tick marks are future work)

Forward closure is only used for **lemma verification**, not rendering, so its flattening doesn't affect the visual pipeline.

#### 3. **Canonicalization Priority Conflicts**
When merging equivalent elements, need conflict resolution:
```typescript
// If circle a b c appears with priority 1 AND priority 2
// Canonical circle should inherit priority 1 (more prominent)
```

Current UnionFind-based merging has no priority awareness.

#### 4. **Renderer Architecture**
Current `renderLineElements()`, `renderCircleElements()` use hardcoded styling:
```typescript
els.push(`<line ... stroke="#7ec8e3" stroke-width="1.5" opacity="0.7"/>`)
```

**Need:** Priority-aware styling system, possibly with CSS classes:
```typescript
els.push(`<line ... class="priority-${priority}" />`)
```

#### 5. **Forward/Backward Chain Interaction**
Both `unfold()` (backward) and `forwardClosure()` (forward) lose structure:
- Backward chaining stops at frontier and flattens
- Forward chaining adds derived facts without derivation metadata  
- Combined effect: **complete loss of construction hierarchy**

### Scope of Required Changes

This confirms that progressive rendering requires **deep architectural changes**:

1. **New unfold variant** preserving derivation trees
2. **Extended GeometryProblem** type with priority metadata  
3. **Priority-aware canonicalization** with conflict resolution
4. **Structured forward closure** preserving derivation chains
5. **Priority-based renderer** with dynamic styling
6. **UI controls** for detail level selection

The current pipeline is optimized for correctness and performance of logical reasoning, but completely discards the structural information needed for layered visualization.

### Unified Extraction Opportunity

The same **natural stopping conditions** used in lemma checking (`unfold()` stops on branching, non-constructive rules, axioms, cycles) could replace the hardcoded `GEOMETRY_FRONTIER`. This would:

- **Eliminate unfolding frontier hardcoding**: No need for `stopPred` based on predicate lists
- **Preserve full derivation structure**: Natural stopping gives complete construction trees  
- **Unified tree extraction**: Same structured unfold feeds solver, planner, AND renderer
- **Flexible predicate selection**: Pick out `circle`/`collinear`/etc. from trees post-unfold rather than stopping unfold at them

We still need predicate→geometry mappings (`circle` → solver circles, `collinear` → canonical lines, etc.), but these become **post-processing selections** from complete trees rather than **stopping conditions** that truncate unfolding.

### Architecture Change Summary

**Current Extraction Pipeline:**
1. `unfold(goal, kb, visiting, { stopPred: p => GEOMETRY_FRONTIER.has(p.name) })` 
2. → Flat `GroundPredicate[]` (loses derivation structure)
3. → `problemFromPrimitive()` maps predicates to geometry constraints

**Proposed Structured Pipeline:**
1. `structuredUnfold(goal, kb, visiting)` (no early stopping)
2. → Complete derivation trees with depth/priority metadata  
3. → Extract solver constraints, planner elements, and rendering objects from same trees
4. → Predicate filtering happens during tree traversal, not during unfolding

This preserves all information needed for progressive rendering while allowing the same trees to serve solver, planner, and renderer with their respective predicate selections.

### Unified Smart Extraction Structure

Instead of separate extraction paths, consider a single sophisticated structure that manages the complete derivation tree:

```typescript
interface SmartGeometryExtraction {
  // Core derivation tree
  derivationTree: DerivationNode[]
  
  // On-demand filtering and processing
  getConstraints(): Constraint[]           // for solver
  getConstructionElements(): PlanElement[] // for planner  
  getRenderElements(priority?: number): RenderElement[] // for renderer
  
  // Intelligent processing
  canonicalize(): void                     // priority-aware merging
  computeTransitiveClosure(predicate: string): void // eq-lines, etc.
  
  // Interactive queries
  getElementsRelatedTo(sourceClause: string): RenderElement[]
  getDerivationPath(element: RenderElement): DerivationNode[]
  filterByPriority(maxPriority: number): SmartGeometryExtraction
}
```

This unified structure:
- **Ensures consistency**: Solver, planner, and renderer see coherent views of the same data
- **Manages complexity**: Canonicalization and transitive closure logic centralized  
- **Supports interaction**: Can answer queries about relationships and derivations
- **Enables progressive rendering**: Built-in priority filtering and contextual detail revelation

The structure becomes the single source of truth for all geometry extraction concerns.

### Long-Term Geometric Abstraction

This approach also sets up future support for **non-Euclidean geometries**:

- **Current**: Hardcoded Euclidean constraints (`circle`, `line`, distance)
- **Future**: Abstract geometric predicates that can be interpreted in different geometric contexts

```typescript
interface GeometryBackend {
  interpretConstraint(constraint: Constraint): BackendConstraint
  createSolver(): GeometrySolver
  createRenderer(): GeometryRenderer
}

// Future: EuclideanBackend, ProjectiveBackend, HyperbolicBackend
```

The `SmartGeometryExtraction` would work with abstract geometric concepts, while backends handle the specific mathematical interpretations. This keeps the logical reasoning (Horn clauses, derivation trees) separate from geometric implementation details, enabling the same EL2 language to work across different geometric spaces.

Progressive rendering becomes a natural extension of the existing inference architecture rather than a separate rendering-specific pipeline.

### Embedded Query Integration

- Use embedded query metadata to automatically assign priority 2 to derived properties
- Allow manual priority override via syntax extension: `? eq-lines a b a c @priority:1`

## Future Extensions

### Semantic Priority

Beyond depth-based priority, consider semantic importance:
- **Core structure** vs **convenience properties**
- **User-requested** vs **automatically derived**
- **Proof-relevant** vs **visualization aids**

### Context-Aware Rendering

Automatically adjust detail based on:
- **Focus context**: What element/predicate the user is currently examining
- **Diagram complexity**: More aggressive priority filtering for complex constructions
- **Interactive state**: Temporarily override priorities during hover/click exploration

### Animation

Smooth transitions between detail levels, potentially with construction animation showing how higher-priority elements emerge from lower-priority foundations.