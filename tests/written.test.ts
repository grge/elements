/**
 * Written proofs (engine.md, *Writing a proof*; tools.md, *A construction step*): `?` lines in a
 * lemma's body, each checked from what is above it, constructions on the figures, then the head.
 */
import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkWrittenProof } from '../src/kb/checker'
import { checkConstruction } from '../src/geometry/constructionStep'
import { writtenVerdicts } from '../src/geometry/verdict'
import { parseLemmas, parseSource } from '../src/language/parser'
import { proofView } from '../src/kb/proofView'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const check = (text: string) => {
  const lemma = parseLemmas(text)[0]
  return checkWrittenProof(lemma, kb, {
    consistent: () => true, strict: true, distinctNames: true,
    construct: (s, above, np) => checkConstruction(kb, s, above, np),
  })
}

const THALES = `? eq-lines o a o b:
    right a b c
    midpoint o a c
    ? double b o d           # continue b-o past o by its own length, to d
    ? eq-angle a o d c o b   # vertical angles
    ? eq-lines a d c b       # side-angle-side
    ? eq-angle a o b c o d
    ? eq-lines a b c d
    ? eq-lines b d a c       # a rectangle's diagonals
`

describe('parsing a written proof', () => {
  it("reads ? lines after a lemma's hypotheses as its steps, with their lines", () => {
    const lemma = parseLemmas(THALES)[0]
    expect(lemma.hypotheses.map(h => h.name)).toEqual(['right', 'midpoint'])
    expect(lemma.steps!.map(s => [s.pred.name, s.line])).toEqual([
      ['double', 4], ['eq-angle', 5], ['eq-lines', 6], ['eq-angle', 7], ['eq-lines', 8], ['eq-lines', 9],
    ])
  })

  it('a lemma without steps has none', () => {
    expect(parseLemmas('? eq-angle a b c a c b: eq-lines a b a c')[0].steps).toBeUndefined()
  })

  it('refuses a ? line in a clause, and a hypothesis after the steps', () => {
    expect(() => parseSource('p a:\n    q a\n    ? r a\n')).toThrow(/lemma's proof/)
    expect(() => parseSource('? p a:\n    q a\n    ? r a\n    s a\n')).toThrow(/hypotheses come first/)
  })
})

describe('checking a written proof', () => {
  it("proves Thales' converse: the rectangle's fourth corner, constructed", () => {
    const r = check(THALES)
    expect(r.steps[0]).toMatchObject({ result: 'constructed', newPoints: ['d'], construction: { ok: true, apart: true, determined: true, existence: 'unconditional' } })
    expect(r.steps.slice(1).map(s => s.result)).toEqual(Array(5).fill('follows'))
    expect(r.head.result).toBe('verified')
    const v = writtenVerdicts(r, null)
    expect(v.head.type).toBe('verified')
    expect(v.steps[0]).toMatchObject({ type: 'verified', note: true, message: 'constructs d: determined, always exists' })
  }, 60_000)

  it('proves the midline without ratios, by doubling d-e', () => {
    const r = check(`? parallel d e b c:
    triangle a b c
    midpoint d a b
    midpoint e a c
    ? double d e f
    ? eq-angle a e d c e f
    ? eq-lines a d c f
    ? eq-angle d a e f c e
    ? parallel a b c f
    ? eq-lines d b c f
    ? parallel d f b c
`)
    expect(r.steps.every(s => s.result === 'follows' || s.result === 'constructed')).toBe(true)
    expect(r.head.result).toBe('verified')
  }, 60_000)

  it("refuses the centroid's construction: the point is g in every figure", () => {
    const r = check(`? collinear c g f:
    triangle a b c
    midpoint d b c
    midpoint e c a
    midpoint f a b
    between a g d
    between b g e
    ? line-line-intersection c f a d h
`)
    expect(r.steps[0].result).toBe('refused')
    expect(r.steps[0].construction!.why).toMatch(/h is g in every figure/)
    expect(writtenVerdicts(r, null).steps[0].type).toBe('false')
  }, 60_000)

  it('a step that does not follow is taken as given below, and the lemma is not ✓', () => {
    const r = check(`? eq-lines a b a c:
    triangle a b c
    ? eq-angle a b c a c b
`)
    expect(r.steps[0].result).toBe('not-shown')
    expect(r.head.result).toBe('verified')   // from the step, taken as given
    const v = writtenVerdicts(r, null)
    expect(v.head.type).toBe('unproven')
    expect(v.head.message).toMatch(/line 3 is not shown/)
  }, 60_000)

  it('a misspelt point is a construction, and says so', () => {
    const r = check(`? eq-lines a b a c:
    eq-lines a b a c
    ? eq-lines a x a c
`)
    expect(r.steps[0]).toMatchObject({ result: 'constructed', newPoints: ['x'] })
    expect(writtenVerdicts(r, null).steps[0].message).toMatch(/^constructs x: freely chosen/)
  }, 60_000)

  it("cites a proved lemma as one step (tools.md, option A): Thales' converse, in a-k-b", () => {
    const written = `? eq-lines f k f b:
    right a k b
    midpoint f a b
    ? eq-lines f a f k
`
    const lemma = parseLemmas(written)[0]
    const thalesConverse = parseLemmas('? eq-lines o a o b: right a b c, midpoint o a c')[0]
    const without = checkWrittenProof(lemma, kb, { consistent: () => true, distinctNames: true })
    expect(without.steps[0].result).toBe('not-shown')
    const cited = checkWrittenProof(lemma, kb, { consistent: () => true, distinctNames: true, lemmas: [thalesConverse] })
    expect(cited.steps[0].result).toBe('follows')
    const view = proofView(cited.steps[0].proof!)
    expect(view.steps).toEqual([expect.objectContaining({ why: 'lemma', rule: '? eq-lines o a o b: right a b c, midpoint o a c' })])
    expect(cited.head.result).toBe('verified')
  }, 60_000)
})
