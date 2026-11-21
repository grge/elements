/**
 * cyclic a b c d, a word of the plane (chapter 5, step 1): four points on one circle, its centre not
 * named. Measured, placed by the planner on the circle through three placed points, drawn as that
 * circle with no centre point.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { drawFigure } from '../src/geometry/figure'
import { buildModel, plan, realise, describeLocus } from '../src/geometry/construction'
import { computeRenderTransform } from '../src/geometry/view'
import { buildScene } from '../src/geometry/scene'
import { holds, type Point } from '../src/geometry/relations'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const figureOf = (text: string) => {
  const rt = buildRuntimeState(kb, parseSource(text))
  const x = extract(rt.kb, rt.configuration.allFacts())
  const cp = plan(buildModel(x.constraints))
  return { x, cp, figure: drawFigure(rt.kb, x, [])!, drawing: realise(cp).drawing }
}

describe('the plane measures four points on one circle', () => {
  const at = new Map<string, Point>([['a', [1, 0]], ['b', [0, 1]], ['c', [-1, 0]], ['d', [0, -1]], ['e', [0.5, 0.5]], ['f', [2, 0]], ['g', [3, 0]]])
  const cyclic = (args: string) => holds({ name: 'cyclic', args: args.split(' ') }, at)
  it('a square\'s corners are; a point inside is not', () => {
    expect(cyclic('a b c d')).toBe(true)
    expect(cyclic('a b c e')).toBe(false)
  })
  it('a point named twice is one point: three points are on a circle unless they are on a line', () => {
    expect(cyclic('a a b c')).toBe(true)
    expect(cyclic('a a f g')).toBe(false)
    expect(cyclic('a f g b')).toBe(false)
  })
})

describe('placed and drawn', () => {
  it('the fourth point on the circle through the other three, drawn with no centre', () => {
    const { cp, figure, drawing } = figureOf('cyclic a b c d')
    const d = cp.steps.find(s => s.point === 'd')!
    expect(d.kind === 'on' && describeLocus(d.locus)).toBe('the circle through abc')
    expect(drawing.violations).toEqual([])
    expect(figure.circles).toMatchObject([{ center: null, points: ['a', 'b', 'c', 'd'] }])
  })

  it('a chord seen from two points of the circle: a turn at each, two lines through each point', () => {
    const { figure, drawing } = figureOf('cyclic a b c d\neq-turn c a c b d a d b')
    expect(figure.marks.map(c => c.name)).toEqual(['eq-turn'])
    const t = computeRenderTransform({ coords: drawing.coords, energy: 0 }, 800, 600, 40, figure)!
    const scene = buildScene(figure, drawing.coords, t, 800, 600, 16)
    expect(scene.circles).toHaveLength(1)
    expect(scene.arcs.filter(a => a.kind === 'arrow')).toHaveLength(2)
  })
})
