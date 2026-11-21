/**
 * Every lemma in the book must be provable, as the app checks it: derived, with a witness, a figure in
 * which every hypothesis holds (geometry/evidence.ts). Here the search for a contradiction still runs
 * in full, so a false axiom still shows even though the app no longer searches; and every fact the
 * closure derives about the lemma's points must hold in the witness.
 *
 * Every regression lemma (tests/fixtures/regression.geo) must be provable too, except the ones listed
 * below as expected to fail.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { numericEvidence } from '../src/geometry/evidence'
import { holds, relationOf } from '../src/geometry/relations'
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

/**
 * Checks are long and synchronous (chapter 4's Pythagoras takes about 12 s). Yielding to the event loop
 * before each lets the worker answer the test runner, which gives up on a worker silent for a minute.
 */
const yieldToRunner = () => new Promise(resolve => setTimeout(resolve, 0))

describe('the book', () => {
  for (const lemma of bookLemmas) {
    it(`✓ ? ${show(lemma)}`, async () => {
      await yieldToRunner()
      // Derived, and no contradiction found by the full search (which may run out of budget).
      const check = checkLemma(lemma, kb, undefined, { strict: true })
      expect(['verified', 'unshown']).toContain(check.result)
      // A witness, as the app requires instead of the search.
      const { witness } = numericEvidence(lemma, kb)
      expect(witness, 'no figure of the hypotheses').toBeTruthy()
      // What the closure derived about the lemma's own points holds in the witness: otherwise an axiom
      // is false, or there is a bug.
      const failing = check.facts.filter(f => relationOf(f) && f.args.every(a => !a.includes('#') && witness!.has(a)) && !holds(f, witness!))
      expect(failing.map(f => `${f.name} ${f.args.join(' ')}`)).toEqual([])
    }, 120_000)   // the full search for a contradiction runs to the budget of work (about 45 s at most)
  }
})

describe('regression lemmas', () => {
  for (const lemma of regressionLemmas) {
    const key = show(lemma)
    if (expectedFalse.has(key)) {
      it(`✗ ? ${key} (should not be provable)`, async () => { await yieldToRunner(); expect(provable(lemma)).toBe(false) }, 30000)
    } else {
      it(`✓ ? ${key}`, async () => { await yieldToRunner(); expect(provable(lemma)).toBe(true) }, 30000)
    }
  }

  it('lists only expected failures that exist', () => {
    const keys = new Set(regressionLemmas.map(show))
    expect([...expectedFalse].filter(k => !keys.has(k))).toEqual([])
  })
})
