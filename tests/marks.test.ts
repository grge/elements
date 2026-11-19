/**
 * Marks from statements and proofs (marks.ts): ticks and arcs only for equalities a fact states or a
 * ✓ lemma proves, lemmas travelling with their constructions, classes joined into chains.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { analyseStructure } from '../src/kb/structure'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { drawFigure } from '../src/geometry/figure'
import { markClasses, chain, closureQueries, mergeByClosure, equalities, settledClasses, type Equality } from '../src/geometry/marks'
import { saturate } from '../src/kb/saturate'
import { closureAnswers, assumedOf } from '../src/geometry/closure'
import { buildModel, plan, realise } from '../src/geometry/construction'
import { computeRenderTransform } from '../src/geometry/view'
import { buildScene } from '../src/geometry/scene'
import { bookRules, bookLemmas } from './book'

const kb = new KnowledgeBase(bookRules)
const { equivalences } = analyseStructure(kb.allRules())

function figureFor(text: string, lemmas = bookLemmas) {
  const rt = buildRuntimeState(kb, parseSource(text))
  const x = extract(rt.kb, rt.configuration.allFacts())
  return { x, figure: drawFigure(rt.kb, x, lemmas)! }
}
const segmentClasses = (f: ReturnType<typeof figureFor>['figure']) =>
  f.marks.filter(m => m.k === 2).map(m => m.members.map(x => `${x.points.join('')}@${x.depth}`).sort())

describe('marks come from statements and proofs, not from the drawing', () => {
  it('an equilateral triangle alone draws its circles and marks nothing', () => {
    const { figure } = figureFor('eq-triangle a b c', [])
    expect(figure.circles).toHaveLength(2)
    expect(figure.marks).toEqual([])
  })

  it('its lemmas mark its sides: a proof becomes a mark', () => {
    const { figure } = figureFor('eq-triangle a b c')
    expect(segmentClasses(figure)).toEqual([['ab@0', 'ac@0', 'bc@0']])
  })

  it('a stated equality is marked', () => {
    const { figure } = figureFor('eq-lines a b c d', [])
    expect(segmentClasses(figure)).toEqual([['ab@0', 'cd@0']])
  })

  it('lemmas travel with their constructions, at their depth', () => {
    // I.2: a-l = b-c by transfer's own lemma; inside it, the equilateral triangle's sides, one level down.
    const { figure } = figureFor('transfer a b c l')
    const classes = segmentClasses(figure)
    expect(classes).toContainEqual(['al@0', 'bc@0'])
    expect(classes.some(c => c.length === 3 && c.every(m => m.endsWith('@1')))).toBe(true)
  })

  it('does not reach inside what is drawn: a circle\'s radii are not marked through it', () => {
    // `eq-lines o p o q: circle o a p, circle o a q` matches two drawn circles, never the radii they unfold to.
    const { x } = figureFor('circle o a b')
    expect(x.outline.map(f => f.name)).toEqual(['circle'])
    const { figure } = figureFor('circle o a b')
    expect(figure.marks).toEqual([])
  })
})

describe('equality chains', () => {
  const eq = (args: string, source = 'stated'): Equality =>
    ({ name: 'eq-lines', args: args.split(' '), depth: 0, source: { kind: 'stated', fact: { name: source, args: [], depth: 0 } } })

  it('joins p = x, x = y, y = q into one class, and explains p = q as the chain', () => {
    const [cls] = markClasses([eq('p a x b', 'one'), eq('x b y c', 'two'), eq('y c q d', 'three')], equivalences)
    expect(cls.members.map(m => m.points.join(''))).toEqual(['ap', 'bx', 'cy', 'dq'])
    const path = chain(cls, 0, 3)
    expect(path.map(e => (e.source as { fact: { name: string } }).fact.name)).toEqual(['one', 'two', 'three'])
  })

  it('takes a segment either way round, and drops a statement of a segment equal to itself', () => {
    expect(markClasses([eq('a b b a'), eq('a a c d')], equivalences)).toEqual([])
  })

  it('marks a class only where two members are on screen', () => {
    const { x, figure } = figureFor('eq-lines a b c d')
    const { drawing } = realise(plan(buildModel(x.constraints)))
    const coords = new Map(drawing.coords)
    const t = computeRenderTransform({ coords, energy: 0 }, 800, 600, 40, figure)!
    expect(buildScene(figure, coords, t, 800, 600).ticks).toHaveLength(2)
    coords.delete('d')
    expect(buildScene(figure, coords, t, 800, 600).ticks).toHaveLength(0)
  })
})

describe('classes merged by the closure', () => {
  // Union-find joins only what a stated or proven equality links: the hexagon's five equilateral
  // triangles would be five classes of 60° angles. The forward closure joins them.
  const merged = (name: string, args: string) => {
    const x = extract(kb, [{ name, args: args.split(' ') }])
    const classes = markClasses(equalities(x.outline, x.depicted, bookLemmas, equivalences), equivalences)
    const queries = closureQueries(classes)
    const sat = saturate(kb, [...x.constraints, ...x.outline])
    return { before: classes, after: mergeByClosure(classes, queries, queries.map(q => sat.holds(q.fact))) }
  }

  it('the hexagon\'s angles are one class, and its sides another', () => {
    const { before, after } = merged('hexagon', 'o a b c d e f')
    expect(before.filter(c => c.k === 3)).toHaveLength(5)
    expect(after.map(c => `${c.name} ${c.members.length}`).sort()).toEqual(['eq-angle 15', 'eq-lines 11'])
    const angles = after.find(c => c.k === 3)!
    expect(angles.edges.filter(e => e.source.kind === 'derived')).toHaveLength(4)
    expect(chain(angles, 0, 14).length).toBeGreaterThan(0)
  })

  it('the circumcentre\'s equilateral triangles on a shared side merge, the others stay apart', () => {
    const { before, after } = merged('circumcentre', 'a b c o')
    expect(before.filter(c => c.k === 3)).toHaveLength(4)
    expect(after.filter(c => c.k === 3)).toHaveLength(2)
  })
}, 60000)

describe('while the closure is pending', () => {
  it('draws only the classes that cannot change: the hexagon keeps its sides, its angles wait', () => {
    const x = extract(kb, [{ name: 'hexagon', args: 'o a b c d e f'.split(' ') }])
    const classes = markClasses(equalities(x.outline, x.depicted, bookLemmas, equivalences), equivalences)
    expect(settledClasses(classes, closureQueries(classes)).map(c => c.name)).toEqual(['eq-lines'])
  })
})

describe('right angles', () => {
  it('a right angle a lemma proves is drawn as a square: perpendicular', () => {
    const { figure } = figureFor('perpendicular a c d')
    expect(figure.angles.map(a => `${a.points.join('')} ${a.as}`)).toEqual(['acd square'])
    expect(figure.provenBy.get('right(a,c,d)')?.map(f => f.name)).toEqual(['perpendicular'])   // distinct a c: met by two names
  })

  it('a class of equal angles the closure knows to be right is drawn as squares: drop-perpendicular', () => {
    const x = extract(kb, [{ name: 'drop-perpendicular', args: 'p e f m'.split(' ') }])
    const classes = markClasses(equalities(x.outline, x.depicted, bookLemmas, equivalences), equivalences)
    const queries = closureQueries(classes, [{ name: 'right', arity: 3 }])
    const holds = closureAnswers(kb, [...x.constraints, ...x.outline], queries.map(q => q.fact), assumedOf([...new Set(x.constraints.flatMap(f => f.args))]))
    const merged = mergeByClosure(classes, queries, holds)
    expect(merged.filter(c => c.as === 'right').map(c => c.members.map(m => m.points.join('')).sort())).toEqual([['emp', 'fmp']])
  })
}, 60000)

describe('parallels are marked with arrows, not ticks', () => {
  const sceneOf = (text: string, lemmas = bookLemmas) => {
    const { x, figure } = figureFor(text, lemmas)
    const { drawing } = realise(plan(buildModel(x.constraints)))
    const t = computeRenderTransform({ coords: drawing.coords, energy: 0 }, 800, 600, 40, figure)!
    return { figure, scene: buildScene(figure, drawing.coords, t, 800, 600, 16) }
  }

  it('a stated parallel draws its two finite lines and arrows on both, one class one arrow each', () => {
    const { figure, scene } = sceneOf('parallel a b c d', [])
    expect(figure.strokes.map(s => s.ends.join(''))).toEqual(['ab', 'cd'])
    expect(scene.ticks).toHaveLength(0)
    expect(scene.arcs.filter(a => a.kind === 'arrow')).toHaveLength(2)
  })

  it('a parallelogram: arrows for its parallel sides, ticks only for sides proven equal', () => {
    const { figure, scene } = sceneOf('parallelogram a b c d')
    const kinds = figure.marks.map(m => m.name).sort()
    expect(kinds.filter(k => k === 'parallel')).toHaveLength(2)
    // Two classes of parallels: one arrow on each side of the first, two on each of the second.
    expect(scene.arcs.filter(a => a.kind === 'arrow')).toHaveLength(2 * 1 + 2 * 2)
    // Ticks come from equal lengths alone (the sides I.34 proves equal), never from a parallel: one
    // class of two sides with one tick each, the other with two.
    expect(figure.marks.filter(m => m.name === 'eq-lines').map(m => m.members.length)).toEqual([2, 2])
    expect(scene.ticks).toHaveLength(2 * 1 + 2 * 2)
    expect(new Set(scene.meta.ticks.map(si => figure.marks[scene.meta.segments[si].mark!.mark].name))).toEqual(new Set(['eq-lines']))
  })

  it('arrows of one class point one way', () => {
    const { scene } = sceneOf('parallel a b d c', [])
    const tips = scene.arcs.filter(a => a.kind === 'arrow').map(a => a.d.split(/[ML ]+/).filter(Boolean).map(Number))
    // Each chevron: back-left, tip, back-right; its direction is tip minus the middle of the backs.
    const dir = (p: number[]) => [p[2] - (p[0] + p[4]) / 2, p[3] - (p[1] + p[5]) / 2]
    const [u, v] = tips.map(dir)
    expect(u[0] * v[0] + u[1] * v[1]).toBeGreaterThan(0)
  })

  it('a proven parallel is drawn where its construction is: parallel-through shows its parallel', () => {
    const { figure, scene } = sceneOf('parallel-through a b p q')
    const cls = figure.marks.find(m => m.name === 'parallel')!
    expect(cls.members.map(m => m.points.join('')).sort()).toEqual(['ab', 'pq'])
    expect(scene.arcs.filter(a => a.kind === 'arrow')).toHaveLength(2)
  })
})

describe('triangles of equal area are hatched alike', () => {
  const sceneOf = (text: string, lemmas = bookLemmas) => {
    const { x, figure } = figureFor(text, lemmas)
    const { drawing } = realise(plan(buildModel(x.constraints)))
    const t = computeRenderTransform({ coords: drawing.coords, energy: 0 }, 800, 600, 40, figure)!
    return { figure, scene: buildScene(figure, drawing.coords, t, 800, 600, 16) }
  }

  it('a stated equal area hatches both triangles with one hatching, and draws their sides', () => {
    const { scene } = sceneOf('eq-area a b c d e f', [])
    expect(scene.fills.map(f => f.n)).toEqual([1, 1])
    expect(scene.meta.segments.map(s => s.ends.join('')).sort()).toEqual(['ab', 'bc', 'ca', 'de', 'ef', 'fd'])
    expect(scene.ticks).toHaveLength(0)
  })

  it('a parallelogram\'s halves, which chapter 4 proves equal, share a hatching', () => {
    const { figure, scene } = sceneOf('parallelogram a b c d')
    const halves = figure.marks.filter(m => m.name === 'eq-area')
    expect(halves).toHaveLength(1)
    expect(halves[0].members.length).toBeGreaterThanOrEqual(2)
    expect(new Set(scene.fills.map(f => f.n))).toEqual(new Set([1]))
  })
})
