/** The tether: what a hovered atom brings forward in the figure. */

import { describe, it, expect } from 'vitest'
import { parseSource } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { drawFigure } from '../src/geometry/figure'
import { buildModel, plan, realise } from '../src/geometry/construction'
import { computeRenderTransform } from '../src/geometry/view'
import { buildScene, emphasise } from '../src/geometry/scene'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)

function sceneOf(text: string) {
  const rt = buildRuntimeState(kb, parseSource(text))
  const x = extract(rt.kb, rt.configuration.allFacts())
  const facts = x.constraints
  const figure = drawFigure(rt.kb, x, [])!   // stated marks only
  const { drawing } = realise(plan(buildModel(facts)))
  const t = computeRenderTransform({ coords: drawing.coords, energy: 0 }, 800, 600, 40, figure)!
  return buildScene(figure, drawing.coords, t, 800, 600)
}

describe('emphasis', () => {
  it('brings forward the two circles of one equilateral triangle in a vesica, and not the other two', () => {
    const scene = sceneOf('vesica a b c d')
    expect(scene.circles).toHaveLength(2)   // both triangles share the circles about a and b
    const em = emphasise(scene, extract(kb, [{ name: 'eq-triangle', args: ['a', 'b', 'c'] }]).depicted, ['a', 'b', 'c'])
    expect(em.circles.size).toBe(2)
    expect([...em.points].sort()).toEqual(['a', 'b', 'c'])
  })

  it('brings forward a line for a between fact, and the segments of an eq-lines fact', () => {
    const scene = sceneOf('double a b c\neq-lines a b p q')
    const em = emphasise(scene, [{ name: 'between', args: ['a', 'b', 'c'] }], [])
    expect(em.lines.size).toBe(1)
    const seg = emphasise(scene, [{ name: 'eq-lines', args: ['a', 'b', 'p', 'q'] }], [])
    expect(seg.segments.size).toBe(2)
  })

  it('records which facts made each element', () => {
    const scene = sceneOf('eq-triangle a b c')
    expect(scene.meta.circles.flat().sort()).toEqual(['circle(a,b,c)', 'circle(b,a,c)'])
    expect(scene.meta.ticks.every(i => i >= 0 && i < scene.segments.length)).toBe(true)
  })
})

describe("a lemma's marks", () => {
  it('brings forward the marks of the members it names, and nothing made by facts', () => {
    // Two pairs of equal segments, stated: two classes of ticks.
    const scene = sceneOf('eq-lines a b c d\neq-lines p q r s')
    const ticked = scene.meta.segments.flatMap((s, i) => s.mark ? [{ i, key: `${s.mark.mark}:${s.mark.member}` }] : [])
    expect(ticked.length).toBe(4)
    const first = ticked[0].key.split(':')[0]
    const members = new Set(ticked.filter(t => t.key.startsWith(`${first}:`)).map(t => t.key))
    const em = emphasise(scene, [], [], members)
    expect(em.segments.size).toBe(2)
    expect(em.lines.size + em.circles.size).toBe(0)
  })
})
