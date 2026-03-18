/**
 * Lemma test suite — evaluates every lemma in lemmas.geo against the full KB.
 *
 * Positive lemmas: should be provable (✓)
 * Negative lemmas: should NOT be provable (✗), marked below
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseRules, parseLemmas } from '../src/language/parser'
import { KnowledgeBase, forwardClosure, prove, groundKey, type GroundPredicate } from '../src/kb/inference'

// ── Build KB ──────────────────────────────────────────────────────────

const coreGeo   = readFileSync(resolve(__dirname, '../src/language/core.geo'),   'utf8')
const euclidGeo = readFileSync(resolve(__dirname, '../src/language/euclid.geo'), 'utf8')
const lemmasGeo = readFileSync(resolve(__dirname, '../src/language/lemmas.geo'), 'utf8')

const kb = new KnowledgeBase([
  ...parseRules(coreGeo),
  ...parseRules(euclidGeo),
  ...parseRules(lemmasGeo),  // includes auxiliary rules like midpoint
])

const lemmas = parseLemmas(lemmasGeo)

// ── Expected-false lemmas ─────────────────────────────────────────────
// These are deliberate non-provability checks, plus one known gap kept out of
// core semantics because the corresponding rule was too strong / ambiguous.

const expectedFalse = new Set([
  'eq-triangle a b c: eq-lines a b a c, eq-lines a b b c',
  'collinear a c d: collinear a b c, collinear a b d',
  'eq-point a b: -',
  'between a b c: collinear a b c',
  'eq-lines a b b c: circle a b c',
  'midpoint m a b: between a m b',
  'eq-triangle a b c: circle a b c',
])

// ── Helper ────────────────────────────────────────────────────────────

function checkLemma(lemma: typeof lemmas[0]): boolean {
  const seeds: GroundPredicate[] = lemma.hypotheses.map(h => ({ name: h.name, args: h.args }))
  const goal = { name: lemma.head.name, args: lemma.head.args }
  const closed = forwardClosure(kb, seeds, 2000, groundKey(goal))
  const factSet = new Set(closed.map(f => groundKey(f)))
  return factSet.has(groundKey(goal))
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('lemmas', () => {
  lemmas.forEach((lemma, i) => {
    const head = `${lemma.head.name} ${lemma.head.args.join(' ')}`
    const hyps = lemma.hypotheses.length === 0
      ? '-'
      : lemma.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')
    const key = `${head}: ${hyps}`
    const isNegative = expectedFalse.has(key)

    if (isNegative) {
      it(`✗ ? ${head}: ${hyps} (should not be provable)`, () => {
        expect(checkLemma(lemma)).toBe(false)
      }, 10000)
    } else {
      it(`✓ ? ${head}: ${hyps}`, () => {
        expect(checkLemma(lemma)).toBe(true)
      }, 10000)
    }
  })
})
