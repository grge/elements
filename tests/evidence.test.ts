/**
 * Numeric evidence: every lemma of the book that can be sampled holds in every sample (anything else
 * is an alarm), and the regression lemmas that are not provable get the verdict they deserve: false
 * with a counterexample, or probably true where they fail only in a degenerate configuration.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { numericEvidence } from '../src/geometry/evidence'
import { verdict } from '../src/kb/verdict'
import { parseLemmas, type Lemma } from '../src/language/parser'
import { bookLemmas, bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const show = (l: Lemma) =>
  `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ') || '-'}`
const lemma = (s: string) => parseLemmas(`? ${s}`)[0]

describe('the book holds numerically', () => {
  for (const l of bookLemmas) {
    it(show(l), () => expect(numericEvidence(l, kb).kind).not.toBe('fails'), 10000)
  }
  it('samples most of it', () => {
    const sampled = bookLemmas.filter(l => numericEvidence(l, kb).kind === 'holds').length
    expect(sampled / bookLemmas.length).toBeGreaterThan(0.6)
  })
})

describe('false lemmas are refuted by a sampled figure', () => {
  for (const s of [
    'eq-point a b: -',
    'between a b c: collinear a b c',
    'eq-point a b: eq-lines a c b c',
    'eq-lines a b b c: circle a b c',
    'midpoint m a b: between a m b',
    'eq-triangle a b c: circle a b c',
    'eq-lines a e b c: march a b c d e',
    'between a b d: vesica a b c d',
  ]) {
    it(s, () => {
      const l = lemma(s)
      const v = verdict(checkLemma(l, kb), numericEvidence(l, kb))
      expect(v.type).toBe('false')
    }, 10000)
  }
})

describe('lemmas false only when two points coincide are probably true', () => {
  for (const s of [
    'collinear a c d: collinear a b c, collinear a b d',
    'collinear a b d: between a b c, collinear a c d',
  ]) {
    it(s, () => {
      const l = lemma(s)
      const v = verdict(checkLemma(l, kb), numericEvidence(l, kb))
      expect(v.type).toBe('unproven')
      expect(v.message).toMatch(/holds in all \d+ sampled figures/)
    }, 10000)
  }
})

describe('verdicts', () => {
  it('a proof that a sample refutes raises an alarm', () => {
    const v = verdict({ result: 'verified', facts: [] }, { kind: 'fails', samples: 3, coords: new Map(), failing: 'circle a b c' })
    expect(v.type).toBe('alarm')
  })
  it('a search that ran out of budget says so', () => {
    const v = verdict({ result: 'out-of-budget', facts: [] }, { kind: 'none', why: 'eq-point cannot be drawn' })
    expect(v).toEqual({ type: 'unproven', message: 'the search ran out of its budget (no figures to test: eq-point cannot be drawn)' })
  })
  it('a lemma whose hypotheses cannot be drawn gets no evidence', () => {
    expect(numericEvidence(lemma('eq-point b a: eq-point a b'), kb).kind).toBe('none')
  })
})
