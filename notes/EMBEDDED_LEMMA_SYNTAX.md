# Embedded Lemma Syntax: Direct Query Attachment to Horn Clauses

Date: 2026-03-22

## Summary

Extend the language syntax to allow lemmas (queried clauses) to be embedded directly within Horn clause definitions using a `?` query marker. This creates a direct association between constructions and their derived properties, enabling both better knowledge organization and more targeted diagram rendering.

## Current vs Proposed Syntax

### Current Approach: Separate Lemmas

```txt
eq-triangle a b c:
    circle a b c
    circle b a c

? eq-lines a b a c : eq-triangle a b c
? eq-lines b c b a : eq-triangle a b c
```

The lemmas are stored separately in the knowledge base and must be looked up when needed.

### Proposed: Embedded Queries

```txt
eq-triangle a b c:
    circle a b c
    circle b a c
    ? eq-lines a b a c
    ? eq-lines b c b a
```

The `?` marker within the body indicates that these are implied properties, not preconditions. They get stored directly linked to this particular Horn clause.

## Semantics

### Sugar Transformation

The embedded syntax is syntactic sugar that desugars to the separated form:

```txt
eq-triangle a b c:
    circle a b c
    circle b a c

? eq-lines a b a c : eq-triangle a b c
? eq-lines b c b a : eq-triangle a b c
```

But with explicit metadata linking the lemmas back to the originating clause.

### Storage Model

When parsed, embedded queries are:

1. **Extracted** into separate lemma entries in the knowledge base
2. **Linked** back to their originating Horn clause via metadata
3. **Available for lookup** when rendering or reasoning about the originating clause

This allows the system to answer questions like:
- "What properties are directly derivable from `eq-triangle`?"
- "When rendering an `eq-triangle`, what additional elements should be shown?"

## Benefits

### 1. Knowledge Organization

Related properties stay close to their defining construction:

```txt
perpendicular-bisector a b c:
    circle a c b
    circle b c a
    ? eq-lines a c b c  # equal distances from midpoint
    ? perpendicular c l : line a b l  # perpendicular to original line
```

### 2. Targeted Diagram Enhancement

When rendering `eq-triangle`, the system can automatically include visual indicators for the embedded properties (equal sides) without having to search through all available lemmas.

### 3. Documentation and Learning

The syntax makes the relationship between construction and properties explicit, serving as inline documentation of what each construction achieves.

### 4. Modular Verification

Embedded queries can be verified independently when the containing clause is checked, providing immediate feedback about the completeness of the construction.

## Implementation Considerations

### Parser Changes

- Extend the body parsing to recognize `? predicate` as a query marker
- Distinguish between regular body predicates (preconditions) and embedded queries (derived properties)
- Maintain source location information for both the clause and its embedded queries

### Knowledge Base Storage

- Add metadata field to lemma entries indicating originating clause
- Consider indexing: clause → embedded queries for efficient lookup
- Preserve the desugared separate lemma entries for normal inference

### Verification

- Embedded queries should be verified when their containing clause is processed
- Consider batch verification: check all embedded queries together after the main clause is established

## Example Applications

### Complex Constructions

```txt
regular-pentagon a b c d e:
    circle center a b
    # ... construction steps ...
    ? eq-lines a b b c    # all sides equal
    ? eq-lines b c c d
    ? eq-lines c d d e
    ? eq-lines d e e a
    ? angle a b c : 108-degrees  # all angles equal
    # ... more angle properties
```

### Theorems with Multiple Consequences

```txt
triangle-inequality a b c:
    triangle a b c
    ? less-than dist-a-c (add dist-a-b dist-b-c)
    ? less-than dist-b-c (add dist-a-b dist-a-c)
    ? less-than dist-a-b (add dist-a-c dist-b-c)
```

## Integration with Progressive Rendering

This syntax naturally supports the progressive rendering system by providing explicit metadata about which derived properties belong to each construction level. See `PROGRESSIVE_RENDERING_WEIGHTS.md` for how these embedded queries can drive weighted diagram complexity.