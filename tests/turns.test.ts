/**
 * Turns (measure.ts `turn`, relations.ts `eq-turn`, chapter 3): the turn from one line to another,
 * directed, round a half turn. Measured, placed by the planner, marked with turning arrows.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { drawFigure } from '../src/geometry/figure'
import { buildModel, plan, realise } from '../src/geometry/construction'
import { computeRenderTransform } from '../src/geometry/view'
import { buildScene } from '../src/geometry/scene'
import { turn, type Point } from '../src/geometry/measure'
import { holds } from '../src/geometry/relations'
import { analyseStructure } from '../src/kb/structure'
import { bookRules } from './book'
import { checkLemma } from '../src/kb/checker'
import { parseLemmas, parseRules } from '../src/language/parser'
import { readFileSync } from 'node:fs'

const kb = new KnowledgeBase(bookRules)
const deg = Math.PI / 180

describe('the turn between two lines', () => {
  const O: Point = [0, 0], E: Point = [1, 0], N: Point = [0, 1], NE: Point = [1, 1]

  it('is anticlockwise, of lines not rays, less than a half turn', () => {
    expect(turn(O, E, O, NE)).toBeCloseTo(45 * deg)
    expect(turn(O, NE, O, E)).toBeCloseTo(135 * deg)          // turning back: the other way round
    expect(turn(E, O, O, NE)).toBeCloseTo(45 * deg)            // a line read backwards is the same line
    expect(turn(O, E, N, NE)).toBeCloseTo(0)                   // parallel lines turn by nothing
    expect(turn(O, E, O, N)).toBeCloseTo(turn(O, N, O, E))     // a quarter turn is its own reverse
  })

  it('tells a figure from its mirror image, as an angle does not', () => {
    const at = new Map<string, Point>([['a', [0, 0]], ['b', [2, 0]], ['c', [1, 1]], ['d', [1, -1]]])
    // b-a-c and b-a-d are equal angles, mirror images: their turns are opposite.
    expect(holds({ name: 'eq-angle', args: ['b', 'a', 'c', 'b', 'a', 'd'] }, at)).toBe(true)
    expect(holds({ name: 'eq-turn', args: ['a', 'b', 'a', 'c', 'a', 'b', 'a', 'd'] }, at)).toBe(false)
    expect(holds({ name: 'eq-turn', args: ['a', 'b', 'a', 'c', 'a', 'd', 'a', 'b'] }, at)).toBe(true)
  })
})

describe('turns in the book', () => {
  it('the engine proves eq-turn an equivalence of pairs of lines, from its rules', () => {
    const { equivalences } = analyseStructure(kb.allRules())
    expect(equivalences.get('eq-turn')?.k).toBe(4)
  })

  it('what is concluded from a turn: turns, circles, parallels (no turn), quadrances (a quarter turn), equal legs (I.6), ratios (similar triangles)', () => {
    // So a proof that asks for none of them never fires their rules. The parallel comes back through
    // the solver: lines that turn by nothing run the same way (the difference's faithful rule).
    // Definitions only say what a word is (a figure that has a turn in it): not conclusions.
    const defined = new Set([...kb.definitions()].filter(([, d]) => d.kind === 'definition').map(([n]) => n))
    const from = new Set(bookRules.filter(r => !defined.has(r.head.name) && r.body.some(b => b.name === 'eq-turn' || b.name === 'cyclic')).map(r => r.head.name))
    expect([...from].sort()).toEqual(['cyclic', 'eq-lines', 'eq-ratio', 'eq-turn', 'parallel', 'quad-sum'])
    expect(analyseStructure(kb.allRules()).differences.get('eq-turn')?.faithful?.head.name).toBe('parallel')
  })
})

describe('a pair of one point has no turn', () => {
  // A degenerate right angle (right o m m: an arm of no length) once became a turn with a one-point
  // line, which equals every turn, and through "all right angles turn alike" glued every quarter turn
  // to it: the right angle at m made the angle at a right, and the hypotheses contradictory.
  it('the right angle at m does not make the angle at a right, nor its hypotheses contradictory', () => {
    const [atA, atM] = parseLemmas('? eq-turn a o a m a m a o: right o m a, distinct o m\n? eq-turn m o m a m a m o: right o m a, distinct o m')
    expect(checkLemma(atA, kb, 2_000_000, { distinctNames: true }).result).toBe('not-provable')
    expect(checkLemma(atM, kb, 2_000_000, { distinctNames: true }).result).toBe('verified')
  })

  it('so the altitudes figure does not make the angle at a corner right (it once did)', () => {
    const rules = [...bookRules, ...parseRules(readFileSync(new URL('../src/language/extra/beyond.geo', import.meta.url), 'utf8'))]
    const [corner] = parseLemmas('? eq-turn a b a c a c a b: altitudes a b c d e h f')
    expect(checkLemma(corner, new KnowledgeBase(rules), 2_000_000, { distinctNames: true }).result).not.toBe('verified')
  })
}, 120_000)

describe('rules see the turns the solver finds', () => {
  // Two right angles standing on one side are equal quarter turns only by the solver; the converse
  // of III.21 must still see them, or the circle through the four points is never found.
  it('two right angles on a-b put a, b and their vertices on one circle', () => {
    const [l] = parseLemmas('? cyclic a b d e: right a d b, right a e b, triangle a b d, triangle a b e')
    expect(checkLemma(l, kb, 2_000_000, { distinctNames: true }).result).toBe('verified')
  })
}, 120_000)

describe('the planner places points by turns', () => {
  const drawn = (text: string, free?: string[]) => {
    const rt = buildRuntimeState(kb, parseSource(text))
    const x = extract(rt.kb, rt.configuration.allFacts())
    const cp = plan(buildModel(x.constraints), free ? { free } : {})
    return { cp, ...realise(cp) }
  }

  it('a line through a placed point, turned from a placed line as another pair turns', () => {
    const { cp, drawing } = drawn('eq-turn a b c d e f g h')
    expect(cp.steps.some(s => s.kind !== 'free' && JSON.stringify(s).includes('"turned"'))).toBe(true)
    expect(drawing.violations).toEqual([])
  })

  it('a point that sees a placed chord at a known turn is on its circle (III.21, directed)', () => {
    const { cp, drawing } = drawn('eq-turn p a p b e f g h', ['a', 'b', 'e', 'f', 'g', 'h'])
    expect(cp.steps.some(s => JSON.stringify(s).includes('"seen"'))).toBe(true)
    expect(drawing.violations).toEqual([])
  })
})

describe('equal turns are marked with turning arrows', () => {
  it("at each pair of lines' meeting, arcs from the first line to the second, ending in an arrowhead", () => {
    const rt = buildRuntimeState(kb, parseSource('eq-turn a b c d e f g h'))
    const x = extract(rt.kb, rt.configuration.allFacts())
    const figure = drawFigure(rt.kb, x, [])!
    const { drawing } = realise(plan(buildModel(x.constraints)))
    const t = computeRenderTransform({ coords: drawing.coords, energy: 0 }, 800, 600, 40, figure)!
    const scene = buildScene(figure, drawing.coords, t, 800, 600, 16)
    // Two places (unless a meeting falls off the page), each one arc and one arrowhead.
    const arcs = scene.arcs.filter(a => a.kind === 'arc').length, heads = scene.arcs.filter(a => a.kind === 'arrow').length
    expect(arcs).toBe(heads)
    expect([0, 2]).toContain(arcs)
  })
})
