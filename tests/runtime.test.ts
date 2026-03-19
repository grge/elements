import { describe, it, expect } from 'vitest'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { KnowledgeBase } from '../src/kb/inference'

describe('runtime semantics layer', () => {
  it('separates rules, ground facts, ground queries, and queried clauses', () => {
    const parsed = parseSource(`
foo a: bar a
circle a b c
? eq-lines a b a c
? midpoint m a b: between a m b
`)
    const runtime = buildRuntimeState(new KnowledgeBase([]), parsed)

    expect(runtime.analysis.rules).toHaveLength(1)
    expect(runtime.analysis.groundFacts).toHaveLength(1)
    expect(runtime.analysis.groundQueries).toHaveLength(1)
    expect(runtime.analysis.queriedClauses).toHaveLength(1)
    expect(runtime.analysis.geometryGoals).toHaveLength(1)
  })

  it('loads rules into a temporary KB extension and ground facts into Configuration', () => {
    const parsed = parseSource(`
foo a: bar a
bar x
`)
    const runtime = buildRuntimeState(new KnowledgeBase([]), parsed)
    expect(runtime.kb.rulesWithHead('foo')).toHaveLength(1)
    expect(runtime.configuration.hasFact('bar(x)')).toBe(true)
  })
})
