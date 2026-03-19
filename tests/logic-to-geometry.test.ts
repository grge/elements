import { describe, it, expect } from 'vitest'
import { parseSource, parseRules } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { geometryProblemFromRuntime, seedPredicateHeadFact } from '../src/geometry/extraction'
import { KnowledgeBase } from '../src/kb/inference'

describe('runtime to geometry extraction', () => {
  it('constructs a geometry problem from runtime ground facts', () => {
    const kb = new KnowledgeBase(parseRules(`eq-triangle a b c: circle a b c, circle b a c`))
    const runtime = buildRuntimeState(kb, parseSource('eq-triangle a b c'))
    const problem = geometryProblemFromRuntime(runtime)
    expect(problem).not.toBeNull()
    expect(problem?.circles.length).toBe(2)
  })

  it('supports predicate-mode style seeding via a grounded head fact', () => {
    const runtime = buildRuntimeState(
      new KnowledgeBase([]),
      parseSource('eq-triangle a b c: circle a b c, circle b a c')
    )
    runtime.configuration.addFacts([seedPredicateHeadFact({ name: 'eq-triangle', args: ['a', 'b', 'c'] })])
    const problem = geometryProblemFromRuntime(runtime)
    expect(problem).not.toBeNull()
    expect(problem?.circles.length).toBe(2)
  })
})
