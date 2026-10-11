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
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'

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
  'eq-point a b: eq-lines a c b c',
  'eq-lines a l a b: copy-segment a l b c',
  'eq-lines a e b c: march a b c d e',
  'between a b d: vesica a b c d',
  'eq-lines a x a b: cut-segment a b x c d',
  // Known gap: true only for a != c; the language has no inequality yet.
  'collinear a b d: between a b c, collinear a c d',
  'collinear a c d: collinear a b c, collinear a b d',
  'eq-point a b: -',
  'between a b c: collinear a b c',
  'eq-lines a b b c: circle a b c',
  'midpoint m a b: between a m b',
  'eq-triangle a b c: circle a b c',
])

// ── Helper ────────────────────────────────────────────────────────────

function checkLemmaProvable(lemma: typeof lemmas[0]): boolean {
  return checkLemma(lemma, kb).result === 'verified'
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
        expect(checkLemmaProvable(lemma)).toBe(false)
      }, 10000)
    } else {
      it(`✓ ? ${head}: ${hyps}`, () => {
        expect(checkLemmaProvable(lemma)).toBe(true)
      }, 10000)
    }
  })
})
