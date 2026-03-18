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

// ── Negative test heads (should NOT be provable) ──────────────────────
// These correspond to the "negative / non-provability tests" section.
// A lemma is considered a negative test if its head matches one of these
// exactly AND it has empty or trivially-seeding hypotheses.

const negativeTests = new Set([
  'eq-point(a,b)',                // ? eq-point a b: -
  'between(a,b,c)|collinear',     // these are identified by position below
])

// More precisely: we track negative tests by index in the lemma list.
// From lemmas.geo the last 5 lemmas are the negative tests:
//   ? eq-point a b: -
//   ? between a b c: collinear a b c
//   ? eq-lines a b b c: circle a b c
//   ? midpoint m a b: between a m b
//   ? eq-triangle a b c: circle a b c

const negativeCount = 5
const negativeStartIdx = lemmas.length - negativeCount

// ── Helper ────────────────────────────────────────────────────────────

function checkLemma(lemma: typeof lemmas[0]): boolean {
  const seeds: GroundPredicate[] = lemma.hypotheses.map(h => ({ name: h.name, args: h.args }))
  const closed = forwardClosure(kb, seeds)
  const factSet = new Set(closed.map(f => groundKey(f)))
  return prove(lemma.head, kb, factSet)
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('lemmas', () => {
  lemmas.forEach((lemma, i) => {
    const head = `${lemma.head.name} ${lemma.head.args.join(' ')}`
    const hyps = lemma.hypotheses.length === 0
      ? '-'
      : lemma.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')
    const isNegative = i >= negativeStartIdx

    if (isNegative) {
      it(`✗ ? ${head}: ${hyps} (should not be provable)`, () => {
        expect(checkLemma(lemma)).toBe(false)
      })
    } else {
      it(`✓ ? ${head}: ${hyps}`, () => {
        expect(checkLemma(lemma)).toBe(true)
      })
    }
  })
})
