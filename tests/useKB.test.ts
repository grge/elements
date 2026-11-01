import { describe, it, expect } from 'vitest'
import { useKB } from '../src/composables/useKB'

describe('useKB source references', () => {
  it('exposes sourceRef for builtin clauses', () => {
    const { clausesForPredicate } = useKB()
    const clauses = clausesForPredicate('midpoint', '01-length')
    expect(clauses.length).toBeGreaterThan(0)
    expect(clauses[0].sourceRef).toBeDefined()
    expect(clauses[0].sourceRef?.sourceName).toBe('01-length.geo')
    expect((clauses[0].sourceRef?.startLine ?? 0)).toBeGreaterThan(0)
    expect((clauses[0].sourceRef?.endLine ?? 0)).toBeGreaterThanOrEqual(clauses[0].sourceRef?.startLine ?? 0)
  })

  it('shows predicates with their definition\'s arguments, or plain letters, and hides false', () => {
    const { predicates } = useKB()
    const args = (name: string) => predicates.value.find(p => p.name === name)?.args.join(' ')
    expect(args('vesica')).toBe('a b c d')
    expect(args('eq-lines')).toBe('a b c d')   // its first clause is the axiom `eq-lines a b b a`
    expect(predicates.value.some(p => p.name === 'false')).toBe(false)
  })
})
