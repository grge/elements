import { describe, it, expect } from 'vitest'
import { parseLemmas, parseSource, parseRules } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { checkGroundQuery, checkLemma } from '../src/kb/checker'
import { Configuration } from '../src/kb/configuration'

describe('queried-clause checker', () => {
  it('checks a lemma by unfolding hypotheses then forward-closing', () => {
    const kb = new KnowledgeBase(parseRules(`
      eq-triangle a b c: circle a b c, circle b a c
      eq-lines a b a c: circle a b c
    `))
    const [lemma] = parseLemmas(`? eq-lines a b a c: eq-triangle a b c`)
    const result = checkLemma(lemma, kb)
    expect(result.result).toBe('verified')
  })

  it('introduces head-only objects for queried clauses before checking', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar b
    `))
    const [lemma] = parseLemmas(`? foo a: bar b`)
    const result = checkLemma(lemma, kb)
    expect(result.result).toBe('verified')
    expect(result.facts.some(f => f.name === 'foo' && f.args[0] === 'a')).toBe(true)
  })

  it('checks a theorem-style queried clause via head-object introduction', () => {
    const kb = new KnowledgeBase(parseRules(`
      eq-point a a: -
    `))
    const [theorem] = parseLemmas(`? eq-point a a: -`)
    const result = checkLemma(theorem, kb)
    expect(result.result).toBe('verified')
  })

  it('fails a non-provable theorem-style queried clause', () => {
    const kb = new KnowledgeBase(parseRules(`
      eq-point a a: -
    `))
    const [theorem] = parseLemmas(`? eq-point a b: -`)
    const result = checkLemma(theorem, kb)
    expect(result.result).toBe('not-provable')
  })

  it('checks a ground query against the session configuration using the same pipeline', () => {
    const kb = new KnowledgeBase(parseRules(`
      eq-triangle a b c: circle a b c, circle b a c
      eq-lines a b a c: circle a b c
    `))
    const cfg = new Configuration()
    cfg.addFact({ name: 'eq-triangle', args: ['a', 'b', 'c'] })
    const [query] = parseSource(`? eq-lines a b a c`).filter((x): x is Extract<ReturnType<typeof parseSource>[number], { kind: 'ground-query' }> => x.kind === 'ground-query')
    const result = checkGroundQuery(query.pred, kb, cfg)
    expect(result.result).toBe('verified')
  })

  it('returns invalid-query when a ground query mentions objects outside the configuration', () => {
    const kb = new KnowledgeBase(parseRules(`
      collinear a b c: between a b c
    `))
    const cfg = new Configuration()
    cfg.addFact({ name: 'between', args: ['a', 'b', 'c'] })
    const [query] = parseSource(`? collinear a b d`).filter((x): x is Extract<ReturnType<typeof parseSource>[number], { kind: 'ground-query' }> => x.kind === 'ground-query')
    const result = checkGroundQuery(query.pred, kb, cfg)
    expect(result.result).toBe('invalid-query')
    expect(result.message).toMatch(/not in the configuration universe/)
  })
})
