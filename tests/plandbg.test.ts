import { describe, it } from 'vitest'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { extractProblem } from '../src/geometry/extraction'
import { canonicalise } from '../src/geometry/canonicalization'
import { plan } from '../src/geometry/planner'

describe('planner debug', () => {
  it('eq-triangle plan', () => {
    const src = `
circle a b c: eq-lines a b a c
eq-triangle a b c:
  circle a b c
  circle b a c
`
    const rules = parseRules(src)
    const kb = new KnowledgeBase(rules)
    const goal = { name: 'eq-triangle', args: ['a','b','c'] }
    const problem = extractProblem(goal, kb)
    canonicalise(problem)

    console.log('points:', [...problem.points])
    console.log('circles:', problem.circles.map(c => ({ center: c.center, points: [...c.points] })))

    const result = plan(problem)
    if (result) {
      for (const step of result.plan) {
        const s = step as any
        console.log(`${step.kind} ${step.point}`)
      }
    } else {
      console.log('no plan')
    }
  })
})

  it('full kb eq-triangle', async () => {
    const { default: core } = await import('../src/language/core.geo?raw')
    const { default: euclid } = await import('../src/language/euclid.geo?raw')
    const { parseRules } = await import('../src/language/parser')
    const { KnowledgeBase } = await import('../src/kb/inference')
    const { extractProblem } = await import('../src/geometry/extraction')
    const { canonicalise } = await import('../src/geometry/canonicalization')
    const { plan } = await import('../src/geometry/planner')
    const rules = [...parseRules(core), ...parseRules(euclid)]
    const kb = new KnowledgeBase(rules)
    const goal = { name: 'eq-triangle', args: ['a','b','c'] }
    const problem = extractProblem(goal, kb)
    canonicalise(problem)
    console.log('circles:', problem.circles.map(c => ({ center: c.center, points: [...c.points] })))
    const result = plan(problem)
    if (result) {
      for (const step of result.plan) console.log(`${step.kind} ${step.point}`)
    } else { console.log('no plan') }
  })

  it('circle-line-intersection plan', async () => {
    const { default: core } = await import('../src/language/core.geo?raw')
    const { default: euclid } = await import('../src/language/euclid.geo?raw')
    const { parseRules } = await import('../src/language/parser')
    const { KnowledgeBase } = await import('../src/kb/inference')
    const { extractProblem } = await import('../src/geometry/extraction')
    const { canonicalise } = await import('../src/geometry/canonicalization')
    const { plan } = await import('../src/geometry/planner')
    const rules = [...parseRules(core), ...parseRules(euclid)]
    const kb = new KnowledgeBase(rules)
    const goal = { name: 'circle-line-intersection', args: ['o','a','b','c','i'] }
    const problem = extractProblem(goal, kb)
    canonicalise(problem)
    console.log('points:', [...problem.points])
    console.log('circles:', problem.circles.map(c => ({ center: c.center, points: [...c.points] })))
    console.log('lines:', problem.lines.map(l => [...l.points]))
    const result = plan(problem)
    if (result) {
      for (const step of result.plan) console.log(`${step.kind} ${step.point}`)
    } else { console.log('no plan') }
  })
