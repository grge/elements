import { describe, it, expect } from 'vitest'
import { useKB } from '../src/composables/useKB'

describe('useKB source references', () => {
  it('exposes sourceRef for builtin clauses', () => {
    const { clausesForPredicate } = useKB()
    const clauses = clausesForPredicate('midpoint', 'lemmas')
    expect(clauses.length).toBeGreaterThan(0)
    expect(clauses[0].sourceRef).toBeDefined()
    expect(clauses[0].sourceRef?.sourceName).toBe('lemmas.geo')
    expect((clauses[0].sourceRef?.startLine ?? 0)).toBeGreaterThan(0)
    expect((clauses[0].sourceRef?.endLine ?? 0)).toBeGreaterThanOrEqual(clauses[0].sourceRef?.startLine ?? 0)
  })
})
