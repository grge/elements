/**
 * Numeric evidence: every lemma of the book that can be sampled holds in every sample (anything else
 * is an alarm), and the regression lemmas that are not provable get the verdict they deserve: false
 * with a counterexample, or probably true where they fail only in a degenerate configuration.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { numericEvidence, isWitness } from '../src/geometry/evidence'
import { verdict } from '../src/geometry/verdict'
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

describe('witnesses', () => {
  it('every book lemma has one: a figure in which all its hypotheses hold', () => {
    const missing = bookLemmas.filter(l => !numericEvidence(l, kb).witness).map(show)
    expect(missing).toEqual([])
  })

  it('Playfair draws: two parallels to one line through two points are one condition, not two', () => {
    expect(numericEvidence(lemma('collinear c d e: parallel a b c d, parallel a b c e'), kb).witness).toBeTruthy()
  })

  it('a figure that only just scrapes through witnesses nothing', () => {
    const at = (ps: Record<string, [number, number]>) => new Map(Object.entries(ps))
    const distinct = [{ name: 'distinct', args: ['a', 'b'] }]
    expect(isWitness(distinct, at({ a: [0, 0], b: [1, 0], c: [0, 1] }))).toBe(true)
    expect(isWitness(distinct, at({ a: [0, 0], b: [1e-6, 0], c: [0, 1] }))).toBe(false)
    const triangle = [{ name: 'triangle', args: ['a', 'b', 'c'] }]
    expect(isWitness(triangle, at({ a: [0, 0], b: [1, 0], c: [0.5, 1] }))).toBe(true)
    expect(isWitness(triangle, at({ a: [0, 0], b: [1, 0], c: [0.5, 1e-6] }))).toBe(false)
  })

  it('a witness spares the checker its search for a contradiction; without one, a search out of budget is not a ✓', () => {
    const l = lemma('eq-area a b c c d a: parallelogram a b c d')
    expect(checkLemma(l, kb, undefined, { consistent: () => true }).witnessed).toBe(true)
    // A budget too small to finish the search for `false`, but enough to find the goal.
    const small = checkLemma(l, kb, 10_000, { strict: true })
    expect(small.result).toBe('unshown')
    expect(verdict(small, null).type).toBe('unproven')
  })
})

describe('a claim whose definition adds points is measured as itself', () => {
  // `right` unfolds to an angle and an extension point the hypotheses do not name; the relation table
  // measures a right angle directly, so such a claim is still tested.
  const one = (text: string) => numericEvidence(parseLemmas(text)[0], kb)
  it('a right angle that holds: the angle in a semicircle', () => {
    expect(one('? right a b c: circle o a b, circle o a c, between a o c, distinct b a, distinct b c').kind).toBe('holds')
  })
  it('a right angle that does not', () => {
    expect(one('? right a b c: circle o a b, circle o a c, distinct b a, distinct b c').kind).toBe('fails')
  })
})
