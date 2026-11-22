/**
 * Proofs (src/kb/proof.ts, engine.md): every book lemma's check, as the page makes it, gives a proof
 * whose every step is a hypothesis or an earlier step, and which replays: checked step by step on a
 * store that fires no rule.
 */
import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { Saturation, prepare } from '../src/kb/saturate'
import { replay, showProof } from '../src/kb/proof'
import { parseLemmas, type Lemma } from '../src/language/parser'
import { bookLemmas, bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const show = (l: Lemma) => `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`
const fresh = () => new Saturation(prepare(kb), {})
const yieldToRunner = () => new Promise(resolve => setTimeout(resolve, 0))

describe('every book lemma has a proof that replays', () => {
  for (const lemma of bookLemmas) {
    it(show(lemma), async () => {
      await yieldToRunner()
      const check = checkLemma(lemma, kb, undefined, { consistent: () => true, strict: true, distinctNames: true, explain: true })
      expect(check.result).toBe('verified')
      const proof = check.proof!
      expect(proof, 'a proof').toBeTruthy()
      expect(replay(proof, fresh, prepare(kb).structure.equality), showProof(proof)).toBe(-1)
    }, 120_000)
  }
})

describe('proofs', () => {
  it('the isosceles triangle is one step of side-angle-side, as Pappus has it', () => {
    const proof = checkLemma(parseLemmas('? eq-angle a b c a c b: eq-lines a b a c')[0], kb, undefined, { explain: true }).proof!
    expect(proof.steps).toHaveLength(1)
    expect(proof.steps[0].by.kind).toBe('rule')
  })

  it('a replay finds a broken step: a premise that does not hold', () => {
    const proof = checkLemma(parseLemmas('? eq-angle a b c a c b: eq-lines a b a c')[0], kb, undefined, { explain: true }).proof!
    const broken = { ...proof, hypotheses: [] }
    expect(replay(broken, fresh, prepare(kb).structure.equality)).toBe(0)
  })
})
