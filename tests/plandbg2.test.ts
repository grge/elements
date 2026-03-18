import { describe, it, expect } from 'vitest'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { extractProblem } from '../src/geometry/extraction'
import { canonicalise } from '../src/geometry/canonicalization'
import { plan } from '../src/geometry/planner'
import core from '../src/language/core.geo?raw'
import euclid from '../src/language/euclid.geo?raw'

describe('planner debug2', () => {
  it('circle-line-intersection full', () => {
    const rules = [...parseRules(core), ...parseRules(euclid)]
    const kb = new KnowledgeBase(rules)
    const goal = { name: 'circle-line-intersection', args: ['o','a','b','c','i'] }
    const problem = extractProblem(goal, kb)
    canonicalise(problem)
    const result = plan(problem)
    console.log('result:', result ? result.plan.length + ' steps, DOF=' + result.totalDOF : 'null')
    if (result) {
      result.plan.forEach((s,i) => console.log(i, s.kind, s.point))
    }
    expect(result).not.toBeNull()
    expect(result!.plan.length).toBe(5)
  })
})
