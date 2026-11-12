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
    expect(settledClasses(classes).map(c => c.name)).toEqual(['eq-lines'])
  })
})
