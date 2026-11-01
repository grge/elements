/**
 * saturate (structured store) must compute the same closure as the plain reference engine
 * (forwardClosure) running the very same rules.
 */
import { describe, it, expect } from 'vitest'
import { parseRules, type Lemma } from '../src/language/parser'
import { bookLemmas, bookRules, regressionLemmas } from './book'
import { KnowledgeBase, forwardClosure, groundKey, type GroundPredicate } from '../src/kb/inference'
import { saturate } from '../src/kb/saturate'

const rules = bookRules
const fastKB = new KnowledgeBase(rules)
const refKB = new KnowledgeBase(rules)

const g = (name: string, ...args: string[]): GroundPredicate => ({ name, args })

describe('saturate: structure recognised in chapter 1', () => {
  it('substitutes equal points everywhere', () => {
    const sat = saturate(fastKB, [g('eq-point', 'a', 'x'), g('between', 'a', 'b', 'c')])
    expect(sat.holds(g('between', 'x', 'b', 'c'))).toBe(true)
    expect(sat.holds(g('collinear', 'c', 'x', 'b'))).toBe(true)
  })

  it('treats eq-lines as an equivalence on unordered segments', () => {
    const sat = saturate(fastKB, [g('eq-lines', 'a', 'b', 'c', 'd')])
    expect(sat.holds(g('eq-lines', 'd', 'c', 'b', 'a'))).toBe(true)
    expect(sat.holds(g('eq-lines', 'c', 'd', 'a', 'b'))).toBe(true)
    expect(sat.holds(g('eq-lines', 'a', 'b', 'a', 'c'))).toBe(false)
  })

  it('propagates point merges into segment classes', () => {
    const sat = saturate(fastKB, [g('eq-lines', 'a', 'b', 'c', 'd'), g('eq-point', 'a', 'x')])
    expect(sat.holds(g('eq-lines', 'x', 'b', 'c', 'd'))).toBe(true)
  })

  it('collapses endpoints of a segment equal to a zero-length one', () => {
    const sat = saturate(fastKB, [g('eq-lines', 'a', 'b', 'c', 'c')])
    expect(sat.holds(g('eq-point', 'a', 'b'))).toBe(true)
  })

  it('applies common notion 3 (segment subtraction)', () => {
    const sat = saturate(fastKB, [
      g('between', 'd', 'a', 'l'), g('between', 'd', 'b', 'g'),
      g('eq-lines', 'd', 'a', 'd', 'b'), g('eq-lines', 'd', 'l', 'd', 'g'),
    ])
    expect(sat.holds(g('eq-lines', 'a', 'l', 'b', 'g'))).toBe(true)
  })

  it('stops at the derivation budget instead of looping', () => {
    const kb = new KnowledgeBase(parseRules('next a b: edge a b\nedge a c: next a b'))
    const sat = saturate(kb, [g('edge', 'a', 'b')], { maxDerivations: 50 })
    expect(sat.holds(g('edge', 'a', 'b'))).toBe(true)
  })
})

// The reference engine fires the equality rules one by one (segment equality alone has n^4 facts):
// at four objects a single lemma takes 1.5-9 s, at five 20-30 s and it runs into its step cap.
const MAX_REFERENCE_OBJECTS = 3
const objectCount = (l: Lemma) =>
  new Set([...l.hypotheses.flatMap(h => h.args), ...l.head.args]).size

describe('saturate agrees with the reference engine on small lemmas', () => {
  for (const lemma of [...bookLemmas, ...regressionLemmas].filter(l => objectCount(l) <= MAX_REFERENCE_OBJECTS)) {
    const label = `${lemma.head.name} ${lemma.head.args.join(' ')} : ${lemma.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ') || '-'}`
    it(label, () => {
      const seeds = lemma.hypotheses.map(h => g(h.name, ...h.args))
      const goal = g(lemma.head.name, ...lemma.head.args)
      const objs = new Set([...seeds.flatMap(s => s.args), ...goal.args])
      const withObjs = [...seeds, ...[...objs].map(o => g('__object__', o))]
      const ref = forwardClosure(refKB, withObjs, 5000, groundKey(goal))
      const refHolds = ref.some(f => groundKey(f) === groundKey(goal))
      const fast = saturate(fastKB, withObjs, { goal })
      expect(fast.holds(goal)).toBe(refHolds)
    }, 60000)
  }
})
