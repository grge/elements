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
    expect(result.message).toMatch(/which no fact on this page introduces/)
  })

  it('reports contradictory hypotheses as vacuous, not as proven', () => {
    const kb = new KnowledgeBase(parseRules(`
      false: eq-point a b, distinct a b
    `))
    const [lemma] = parseLemmas(`? eq-lines a b c d: eq-point a b, distinct a b`)
    expect(checkLemma(lemma, kb).result).toBe('vacuous')
  })

  it('reports contradictory hypotheses as vacuous even when the goal follows from them', () => {
    const kb = new KnowledgeBase(parseRules(`
      false: eq-point a b, distinct a b
    `))
    const [lemma] = parseLemmas(`? eq-point a b: eq-point a b, distinct a b`)
    expect(checkLemma(lemma, kb).result).toBe('vacuous')
  })
})

describe('the non-degeneracy convention: different names are different points', async () => {
  const { bookRules } = await import('./book')
  const { verdict } = await import('../src/geometry/verdict')
  const kb = new KnowledgeBase(bookRules)
  const check = (text: string, distinctNames = true) => checkLemma(parseLemmas(text)[0], kb, 200_000, { distinctNames })

  it('proves what holds only when the points are apart, and says so', () => {
    // False when c is a (b would then be a too), so it does not follow without the convention.
    const text = '? collinear a b d: between a b c, collinear a c d'
    expect(check(text, false).result).not.toBe('verified')
    const c = check(text)
    expect(c).toMatchObject({ result: 'verified', apart: true })
    expect(verdict(c, null).message).toBe('follows, for figures whose points are all apart')
  })

  it('keeps the stronger result where the convention is not needed', () => {
    const c = check('? eq-lines a m m b: midpoint m a b')
    expect(c.result).toBe('verified')
    expect(c.apart).toBeUndefined()
  })

  it('does not take apart what the lemma says is one point', () => {
    expect(check('? eq-lines a c b c: eq-point a b, circle c a d').result).toBe('verified')
    expect(check('? eq-point m n: midpoint m a b, midpoint n a b').result).not.toBe('vacuous')
  })

  it('names the two points the hypotheses force together', () => {
    const c = check('? parallel a x c d: eq-lines a b c c, triangle a c d')
    expect(c.result).toBe('vacuous')
    expect(c.message).toMatch(/make [ab] and [ab] one point/)
  })
}, 60_000)
