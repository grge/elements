/**
 * Quadrance placed by the planner (construction.ts, the quadrance locus): Q(a-b) + Q(c-d) = Q(e-f).
 * A point in one segment is on a circle about its other end, whose radius is a right triangle's leg
 * or hypotenuse; in both parts, on a circle about the midpoint (Apollonius' median law); in a part
 * and the whole, on a line perpendicular to the segment between their other ends.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { buildModel, plan, realise } from '../src/geometry/construction'
import { holds } from '../src/geometry/relations'
import { bookRules } from './book'
import { numericEvidence } from '../src/geometry/evidence'
import { parseLemmas } from '../src/language/parser'

const kb = new KnowledgeBase(bookRules)

const drawn = (text: string, free?: string[]) => {
  const rt = buildRuntimeState(kb, parseSource(text))
  const x = extract(rt.kb, rt.configuration.allFacts())
  const cp = plan(buildModel(x.constraints), free ? { free } : {})
  return { cp, ...realise(cp) }
}
const placedBy = (cp: ReturnType<typeof plan>, p: string) => {
  const s = cp.steps.find(s => s.point === p)!
  return s.kind === 'on' ? [s.locus] : s.kind === 'meet' ? s.loci : []
}
const sums = (drawing: ReturnType<typeof realise>['drawing'], args: string[]) =>
  holds({ name: 'quad-sum', args }, drawing.coords)

describe('the planner places points by quadrance', () => {
  const cases: [string, string, string[]][] = [
    ['p in a part: a leg, about its other end', 'quad-sum p a c d e f', ['a', 'c', 'd', 'e', 'f']],
    ['p in the whole: a hypotenuse', 'quad-sum a b c d p f', ['a', 'b', 'c', 'd', 'f']],
    ['p in both parts: about the midpoint', 'quad-sum p a p b e f', ['a', 'b', 'e', 'f']],
    ['p in a part and the whole: a line', 'quad-sum p a c d p b', ['a', 'b', 'c', 'd']],
  ]
  for (const [title, text, free] of cases) {
    it(title, () => {
      const { cp, drawing } = drawn(text, free)
      expect(placedBy(cp, 'p').some(l => l.kind === 'quadrance')).toBe(true)
      expect(drawing.violations).toEqual([])
      expect(sums(drawing, text.split(' ').slice(1))).toBe(true)
    })
  }

  it('with nothing chosen, still a figure where the quadrances add', () => {
    const { drawing } = drawn('quad-sum a b c d e f')
    expect(drawing.violations).toEqual([])
    expect(sums(drawing, ['a', 'b', 'c', 'd', 'e', 'f'])).toBe(true)
  })

  it('a leg longer than the hypotenuse has no circle: not a figure, not a crash', () => {
    const rt = buildRuntimeState(kb, parseSource('quad-sum p a c d e f'))
    const x = extract(rt.kb, rt.configuration.allFacts())
    expect(() => realise(plan(buildModel(x.constraints), { free: ['a', 'c', 'd', 'e', 'f'] }))).not.toThrow()
  })
})

describe('numeric evidence for the rules that take quad-sum as a hypothesis', () => {
  // Before quad-sum was placed, these had no figure: evidence could say nothing of them.
  const rules = kb.allRules().filter(r => r.body.some(a => a.name === 'quad-sum'))

  it('the book has such rules, and each holds in the figures', () => {
    expect(rules.length).toBeGreaterThanOrEqual(8)
    for (const r of rules) expect(numericEvidence({ head: r.head, hypotheses: r.body }, kb).kind).toBe('holds')
  })

  it('a false one is refuted: the parts exchanged with the whole', () => {
    const [l] = parseLemmas('? quad-sum a b e f c d: quad-sum a b c d e f')
    expect(numericEvidence(l, kb).kind).toBe('fails')
  })

  it('two circles about one centre are one condition between their radii, not two on a point', () => {
    const { drawing } = drawn('quad-sum a b c d e f\nquad-sum a b c d g h')
    expect(drawing.failure).toBeUndefined()
    expect(drawing.violations).toEqual([])
  })
})
