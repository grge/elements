/**
 * The proof as the page shows it (src/kb/proofView.ts): the argument's steps in order, side conditions
 * kept apart, rules named by their text so the page can say where they are written.
 */
import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { proofView } from '../src/kb/proofView'
import { showRule } from '../src/kb/rules'
import { parseLemmas } from '../src/language/parser'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const view = (text: string) => {
  const check = checkLemma(parseLemmas(text)[0], kb, undefined, { consistent: () => true, distinctNames: true, explain: true })
  expect(check.result).toBe('verified')
  return { check, view: proofView(check.proof!) }
}

describe('the proof view', () => {
  it('shows the isosceles triangle as one rule, named by its text', () => {
    const { check, view: v } = view('? eq-angle a b c a c b: eq-lines a b a c')
    expect(v.steps).toHaveLength(1)
    expect(v.steps[0]).toMatchObject({ fact: 'eq-angle a b c a c b', why: 'rule', head: 'eq-angle' })
    const step = check.proof!.steps[0]
    expect(v.steps[0].rule).toBe(step.by.kind === 'rule' ? showRule(step.by.rule) : '')
  })

  it("folds a parallelogram's side conditions, and ends with the goal", () => {
    const { check, view: v } = view('? midpoint m a c: parallel a b d c, parallel a d b c, between a m c, between b m d, triangle a b c, triangle c d a')
    expect(v.steps.length + v.side.length).toBe(check.proof!.steps.length)
    expect(v.steps.at(-1)!.fact).toBe('midpoint m a c')
    for (const st of v.side) expect(st.fact).toMatch(/^(distinct|triangle|collinear|between|parallel|eq-ratio) /)
    expect(v.steps.some(st => /^(distinct|triangle|collinear|between) /.test(st.fact))).toBe(false)
    expect(v.steps.length).toBeLessThan(v.side.length)
  })

  it('writes auxiliary points with subscripts', () => {
    const { view: v } = view('? midpoint m a b: bisect a b m')
    expect(v.steps.some(st => st.fact.includes('c₁'))).toBe(true)
    expect(v.steps.some(st => st.fact.includes('#'))).toBe(false)
  })
})
