import { describe, it, expect } from 'vitest'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { KnowledgeBase } from '../src/kb/inference'

describe('runtime semantics layer', () => {
  it('takes rules and ground facts, and leaves queries to the checker', () => {
    const parsed = parseSource(`
foo a: bar a
circle a b c
? eq-lines a b a c
? midpoint m a b: between a m b
`)
    const runtime = buildRuntimeState(new KnowledgeBase([]), parsed)

    expect(runtime.kb.allRules()).toHaveLength(1)
    expect(runtime.configuration.allFacts()).toEqual([{ name: 'circle', args: ['a', 'b', 'c'] }])
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
