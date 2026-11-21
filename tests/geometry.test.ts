/** From facts to geometry: unfolding, what the figure draws, and the numerical solver. */

import { describe, it, expect } from 'vitest'
import { parseSource, parseRules } from '../src/language/parser'
import { KnowledgeBase, unfold } from '../src/kb/inference'
import { saturate } from '../src/kb/saturate'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { figureOf } from '../src/geometry/figure'
import { buildModel, plan, realise, execute } from '../src/geometry/construction'
import { relationOf } from '../src/geometry/relations'
import { solve } from '../src/geometry/solver'
import { bookRules, fixtureRules } from './book'

const kb = new KnowledgeBase([...bookRules, ...fixtureRules])

// ── Inference ──────────────────────────────────────────────────────────

describe('inference', () => {
  it('unfold returns the goal itself when there is no matching rule', () => {
    const goal = { name: 'nonexistent', args: ['a'] }
    const result = unfold(goal, kb)
    expect(result.frontier).toEqual([goal])
    expect(result.expanded).toBe(false)
  })

  it('unfold stops at circle leaves when given a stopPred', () => {
    const goal = { name: 'eq-triangle', args: ['a','b','c'] }
    const result = unfold(goal, kb, new Set(), { stopPred: p => p.name === 'circle' })
    const leaves = result.frontier.map(f => `${f.name}(${f.args.join(',')})`)
    expect(leaves).toContain('circle(a,b,c)')
    expect(leaves).toContain('circle(b,a,c)')
  })

  it('saturation collapses a segment equal to a zero-length one', () => {
    const seed = [{ name: 'eq-lines', args: ['a','b','c','c'] }]
    const sat = saturate(kb, seed)
    expect(sat.holds({ name: 'eq-point', args: ['a', 'b'] })).toBe(true)
  })
})

// ── Geometry pipeline ──────────────────────────────────────────────────

function solveGoal(goalStr: string) {
  const goals = parseSource(goalStr).flatMap(i => i.kind === 'goal' ? [i.pred] : [])
  const x = extract(kb, goals)
  // The solver works from the same model as the planner; the figure is what is drawn through it.
  return { figure: figureOf(x.depicted)!, witness: solve(buildModel(x.constraints)) }
}

/** Run solveGoal multiple times and expect at least `minPasses` successes */
function reliableSolve(goalStr: string, minPasses = 4, runs = 5) {
  let passes = 0
  for (let i = 0; i < runs; i++) {
    const { witness } = solveGoal(goalStr)
    if (witness.energy < 0.05) passes++
  }
  return passes >= minPasses
}

describe('the figure', () => {
  it('eq-triangle draws 2 circles', () => {
    const { figure } = solveGoal('eq-triangle a b c')
    expect(figure.circles.length).toBe(2)
    expect(figure.lines.length).toBe(0)
  })

  it('line-line-intersection draws 2 lines', () => {
    const { figure } = solveGoal('line-line-intersection a b c d i')
    expect(figure.lines.length).toBe(2)
  })

  it('draws between as a finite straight line, its line continuing faint', () => {
    const figure = figureOf([{ name: 'between', args: ['a', 'b', 'c'] }])!
    expect(figure.strokes.map(s => s.ends)).toEqual([['a', 'c']])
    expect(figure.lines).toMatchObject([{ points: ['a', 'b', 'c'], faint: true }])
    // A line stated through the same points is drawn at full strength.
    const both = figureOf([{ name: 'between', args: ['a', 'b', 'c'] }, { name: 'collinear', args: ['a', 'c', 'd'] }])!
    expect(both.lines).toMatchObject([{ faint: false }])
  })

  it('draws a supplement with its arms (its marks are equal angles, marks.ts), a right angle as a square', () => {
    const supp = figureOf([{ name: 'supp', args: ['a', 'b', 'c', 'c', 'b', 'd'] }])!
    expect(supp.angles).toEqual([])
    expect(supp.strokes.map(s => s.ends.join(''))).toEqual(['ba', 'bc', 'bc', 'bd'])
    const right = figureOf([{ name: 'right', args: ['a', 'b', 'c'] }])!
    expect(right.angles.map(a => `${a.points.join('')} ${a.as}`)).toEqual(['abc square'])
  })

  it('draws nothing for distinct', () => {
    const figure = figureOf([{ name: 'distinct', args: ['a', 'b'] }])!
    expect([figure.lines, figure.strokes, figure.circles, figure.angles]).toEqual([[], [], [], []])
  })

  it('merges circles with the same centre and a radius stated equal', () => {
    const figure = figureOf([
      { name: 'circle', args: ['o', 'a', 'b'] }, { name: 'circle', args: ['o', 'c', 'd'] },
      { name: 'eq-lines', args: ['o', 'a', 'o', 'c'] },
    ])!
    expect(figure.circles).toEqual([{ center: 'o', points: ['a', 'b', 'c', 'd'], depth: 0, facts: ['circle(o,a,b)', 'circle(o,c,d)'] }])
  })
})

describe('geometry solver', () => {
  it('eq-triangle solves reliably', () => {
    expect(reliableSolve('eq-triangle a b c', 5, 5)).toBe(true)
  })

  // Known limitation: the numerical solver cannot find I.2 (its order facts defeat gradient descent).
  // Figures are drawn by the ruler-and-compass construction (construction.ts), which handles I.2; the
  // solver is only a fallback. If the solver improves, this test starts failing: then make it an `it`.
  it.fails('copy-segment solves reliably (known solver limitation)', () => {
    expect(reliableSolve('copy-segment a l b c', 5, 5)).toBe(true)
  })

  it('circle-circle-intersection solves reliably', () => {
    expect(reliableSolve('circle-circle-intersection o a p b i', 5, 5)).toBe(true)
  })

  it('line-line-intersection solves reliably', () => {
    expect(reliableSolve('line-line-intersection a b c d i', 5, 5)).toBe(true)
  })

  it('circle-line-intersection solves reliably', () => {
    expect(reliableSolve('circle-line-intersection o a b c i', 5, 5)).toBe(true)
  })

  it('four right angles: solved from the construction\'s own attempt, every fact met', () => {
    // The planner cannot construct a quadrilateral of four right angles (it would need the parallel
    // postulate's consequences), so the page solves it, starting from the planner's attempt. From
    // random starts the solver used to settle with each right angle's supplement point beyond the
    // wrong vertex, where the angles it copies are one angle and trivially equal.
    const rt = buildRuntimeState(kb, parseSource('right d a b\nright a b c\nright b c d\nright c d a'))
    const model = buildModel(extract(rt.kb, rt.configuration.allFacts()).constraints)
    const cp = plan(model)
    const attempt = execute(cp, realise(cp).params).coords
    expect(attempt.size).toBe(model.points.length)
    const { coords } = solve(model, undefined, attempt)
    const scale = Math.max(1, ...[...coords.values()].map(p => Math.hypot(...p)))
    for (const f of model.facts) {
      const r = relationOf(f)!
      const ps = f.args.map(p => coords.get(p)!)
      // As the page judges a solved figure (useWorkspace's SOLVED_TOL): a measure by its residual,
      // an order or a distinctness at the figure's scale.
      if (r.residual) expect(r.residual(ps), `${f.name} ${f.args.join(' ')}`).toBeLessThan(1e-3)
      else expect(r.holds(ps, 1e-3 * scale), `${f.name} ${f.args.join(' ')}`).toBe(true)
    }
  })

  it('witness has all expected points', () => {
    const { witness } = solveGoal('eq-triangle a b c')
    expect(witness.coords.has('a')).toBe(true)
    expect(witness.coords.has('b')).toBe(true)
    expect(witness.coords.has('c')).toBe(true)
  })

  it('circle points equidistant from center', () => {
    // Solve 5 times, check best
    let best = Infinity
    for (let i = 0; i < 5; i++) {
      const { figure, witness } = solveGoal('eq-triangle a b c')
      if (witness.energy < best) {
        best = witness.energy
        // Check circle constraint
        for (const circle of figure.circles) {
          const [cx, cy] = witness.coords.get(circle.center)!
          const radii = [...circle.points].map(p => {
            const [x, y] = witness.coords.get(p)!
            return Math.hypot(x - cx, y - cy)
          })
          const mean = radii.reduce((a, b) => a + b) / radii.length
          for (const r of radii) {
            expect(Math.abs(r - mean)).toBeLessThan(0.1)
          }
        }
      }
    }
  })
})

// ── From a runtime configuration ───────────────────────────────────────

describe('runtime to geometry extraction', () => {
  it('draws the figure of runtime ground facts', () => {
    const kb = new KnowledgeBase(parseRules(`eq-triangle a b c: circle a b c, circle b a c`))
    const runtime = buildRuntimeState(kb, parseSource('eq-triangle a b c'))
    const figure = figureOf(extract(runtime.kb, runtime.configuration.allFacts()).depicted)
    expect(figure?.circles.length).toBe(2)
  })

  it('draws a predicate from its head, as its page does', () => {
    const runtime = buildRuntimeState(
      new KnowledgeBase([]),
      parseSource('eq-triangle a b c: circle a b c, circle b a c')
    )
    runtime.configuration.addFact({ name: 'eq-triangle', args: ['a', 'b', 'c'] })
    const figure = figureOf(extract(runtime.kb, runtime.configuration.allFacts()).depicted)
    expect(figure?.circles.length).toBe(2)
  })
})

describe('a line still being typed', () => {
  it('skips a drawable fact with too few points instead of throwing', () => {
    const facts = [
      { name: 'circle', args: ['a', 'b', 'c'] },
      { name: 'between', args: ['a', 'b'] },
      { name: 'eq-lines', args: ['a', 'b', 'c'] },
      { name: 'circle', args: [] },
    ]
    const figure = figureOf(facts)
    expect(figure?.points.sort()).toEqual(['a', 'b', 'c'])
    expect(figureOf([{ name: 'between', args: ['a'] }])).toBeNull()
  })
})
