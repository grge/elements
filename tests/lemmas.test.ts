/**
 * Every lemma in the book must be provable. Every regression lemma (tests/fixtures/regression.geo)
 * must be provable too, except the ones listed below as expected to fail.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import type { Lemma } from '../src/language/parser'
import { bookLemmas, bookRules, regressionLemmas } from './book'

const kb = new KnowledgeBase(bookRules)

const expectedFalse = new Set([
  'eq-point a b: -',
  'between a b c: collinear a b c',
  'eq-point a b: eq-lines a c b c',
  'collinear a c d: collinear a b c, collinear a b d',
  'eq-lines a b b c: circle a b c',
  'midpoint m a b: between a m b',
  'eq-triangle a b c: circle a b c',
  'eq-lines a e b c: march a b c d e',
  'between a b d: vesica a b c d',
  // Known gap: true only for a != c; the language cannot say that yet.
  'collinear a b d: between a b c, collinear a c d',
])

const show = (l: Lemma) =>
  `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ') || '-'}`

const provable = (l: Lemma) => checkLemma(l, kb).result === 'verified'

describe('the book', () => {
  for (const lemma of bookLemmas) {
    it(`✓ ? ${show(lemma)}`, () => expect(provable(lemma)).toBe(true), 10000)
  }
})

describe('regression lemmas', () => {
  for (const lemma of regressionLemmas) {
    const key = show(lemma)
    if (expectedFalse.has(key)) {
      it(`✗ ? ${key} (should not be provable)`, () => expect(provable(lemma)).toBe(false), 10000)
    } else {
      it(`✓ ? ${key}`, () => expect(provable(lemma)).toBe(true), 10000)
    }
  }

  it('lists only expected failures that exist', () => {
    const keys = new Set(regressionLemmas.map(show))
    expect([...expectedFalse].filter(k => !keys.has(k))).toEqual([])
  })
})
