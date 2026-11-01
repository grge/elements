import { describe, it, expect } from 'vitest'
import { parseRules, parseLemmas } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { bookRules, fixtureRules } from './book'

const geometry = [...bookRules, ...fixtureRules]  // the fixtures add Euclid I.2 and I.3

const status = (rules: string, pred: string, base = geometry) =>
  new KnowledgeBase([...base, ...parseRules(rules)]).definitions().get(pred)
const proves = (rules: string, lemma: string, base = geometry) =>
  checkLemma(parseLemmas(lemma)[0], new KnowledgeBase([...base, ...parseRules(rules)])).result

describe('definitions', () => {
  it('reads a predicate\'s only clause as a definition (if-and-only-if)', () => {
    expect(status('', 'eq-triangle')?.kind).toBe('definition')
    // The language's stated semantics: a lone clause is a definition, so this follows.
    expect(proves('tall x: giraffe x', '? giraffe x: tall x', [])).toBe('verified')
  })

  it('does not treat a lone recursive clause as a definition', () => {
    // An axiom about r, not a definition of r: reading it backwards would invent "s a".
    expect(status('r a b: r b a, s a', 'r', [])).toMatchObject({ kind: 'open', reason: 'every clause is recursive' })
    expect(proves('r a b: r b a, s a', '? s a: r a b', [])).toBe('not-provable')
  })

  it('keeps a predicate defined when an extra clause follows from the definition', () => {
    const extra = 'eq-triangle a b c: eq-triangle b c a'
    expect(status(extra, 'eq-triangle')?.kind).toBe('definition')
    expect(proves(extra, '? eq-lines a b b c: eq-triangle a b c')).toBe('verified')
  })

  it('makes a weaker extra clause the definition, since that is what the clauses now say', () => {
    const weaker = 'eq-triangle a b c: circle a b c'
    const st = status(weaker, 'eq-triangle')
    expect(st?.kind === 'definition' && st.clause.body.length).toBe(1)
    expect(proves(weaker, '? eq-lines a b b c: eq-triangle a b c')).toBe('not-provable')
  })

  it('opens a predicate whose clauses are genuine alternatives, and says why', () => {
    const st = status('eq-triangle a b c: collinear a b c', 'eq-triangle')
    expect(st?.kind).toBe('open')
    expect(st?.kind === 'open' && st.reason).toMatch(/none of its clauses implies all the others/)
  })

  it('treats the geometry primitives as open', () => {
    for (const p of ['collinear', 'between', 'eq-lines', 'eq-point']) {
      expect(status('', p)?.kind).toBe('open')
    }
  })
})

describe('auxiliary objects are existential (no capture)', () => {
  it('does not identify a construction\'s auxiliary point with a caller\'s point of the same name', () => {
    // cut-segment uses copy-segment, whose auxiliary apex is called d; the given segment is c-d.
    expect(proves('', '? eq-lines a d a c: cut-segment a b x c d')).toBe('not-provable')
  })

  it('gives the same verdict under renaming', () => {
    expect(proves('', '? eq-lines a x c d: cut-segment a b x c d')).toBe('verified')
    expect(proves('', '? eq-lines a y p q: cut-segment a b y p q')).toBe('verified')
  })
})
