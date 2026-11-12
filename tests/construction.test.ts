import { describe, it, expect } from 'vitest'
import { parseSource } from '../src/language/parser'
import { bookRules, fixtureRules } from './book'
import { KnowledgeBase, type GroundPredicate } from '../src/kb/inference'
import { buildRuntimeState } from '../src/kb/runtime'
import { drawableFacts } from '../src/geometry/extraction'
import { buildModel, plan, realise, execute, drag, paramCount, type Point, type ConstructionPlan } from '../src/geometry/construction'
import { measureResidual } from '../src/geometry/measure'

// The book plus Euclid I.2 and I.3 (tests/fixtures/constructions.geo), good stress tests for the planner.
const kb = new KnowledgeBase([...bookRules, ...fixtureRules])

const factsOf = (text: string) => { const rt = buildRuntimeState(kb, parseSource(text)); return drawableFacts(rt.kb, rt.configuration.allFacts()) }

// Independent oracle: does a drawing satisfy every fact of the figure?
function worstFact(facts: GroundPredicate[], c: Map<string, Point>): { residual: number; fact: string } {
  const d = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1])
  const scale = Math.max(1, ...[...c.values()].map(p => Math.hypot(...p)))
  let worst = { residual: 0, fact: '' }
  for (const f of facts) {
    const [a, b, x, y] = f.args.map(n => c.get(n)!)
    let r = 0
    if (f.name === 'circle') r = Math.abs(d(a, b) - d(a, x))
    if (f.name === 'eq-lines') r = Math.abs(d(a, b) - d(x, y))
    if (f.name === 'distinct') r = d(a, b) < 1e-9 ? 1 : 0
    if (f.name === 'collinear' || f.name === 'between') {
      const ab = [b[0] - a[0], b[1] - a[1]], ax = [x[0] - a[0], x[1] - a[1]]
      r = Math.abs(ab[0] * ax[1] - ab[1] * ax[0]) / Math.max(1e-12, Math.hypot(ax[0], ax[1]))
      if (f.name === 'between') {
        const L = ax[0] ** 2 + ax[1] ** 2
        const t = L > 1e-12 ? (ab[0] * ax[0] + ab[1] * ax[1]) / L : 0
        r += Math.max(0, -t, t - 1) * Math.sqrt(L)
      }
    }
    if (f.name === 'eq-angle' || f.name === 'supp' || f.name === 'eq-spread') {
      const m = measureResidual(f.name, f.args, n => c.get(n))
      r = Number.isNaN(m) ? 0 : m * scale    // radians, on the figure's scale like the rest
    }
    if (r / scale > worst.residual) worst = { residual: r / scale, fact: `${f.name} ${f.args.join(' ')}` }
  }
  return worst
}

function seeded(seed: number) {
  let a = seed
  return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648 }
}

/** Perturb every parameter (simulated drags of all inputs at once) and re-execute. */
function wiggle(cp: ConstructionPlan, params: number[], random: () => number): number[] {
  return params.map(p => p + (random() - 0.5) * 0.8)
}

const figures: Array<{ text: string; dof: number; mayFail?: boolean }> = [
  { text: 'eq-triangle a b c', dof: 4 },
  { text: 'circle o a b\ncircle o a c', dof: 6 },               // a circle through three points
  { text: 'midpoint m a b', dof: 4 },                           // needs the perpendicular bisector
  { text: 'eq-lines a b c d\ncircle a b x', dof: 8 },           // needs a compass that carries a length
  { text: 'double a b c', dof: 4 },
  { text: 'vesica a b c d', dof: 4 },
  { text: 'march a b c d e', dof: 4 },
  { text: 'hexagon o a b c d e f', dof: 4 },                     // needs "the other intersection"
  { text: 'copy-segment a l b c', dof: 6 },
  { text: 'cut-segment a b x c d', dof: 8, mayFail: true },     // only possible when cd < ab
  { text: 'copy-segment a l b c\ncopy-segment p q r s', dof: 12 },
  { text: 'circle-circle-intersection o a p b i', dof: 8, mayFail: true },  // the circles may not meet
  { text: 'line-line-intersection a b c d i', dof: 8 },
  // Chapter 2: angles placed by rays and bisectors, not by the numerical solver.
  { text: 'eq-angle a b c d e f', dof: 11 },
  { text: 'supp a b c d e f', dof: 11 },
  { text: 'right a b c', dof: 6 },
  { text: 'copy-angle a b c e g d', dof: 9 },
  { text: 'bisect-angle a b c d', dof: 6, mayFail: true },     // only possible when ba < bc
  { text: 'perpendicular a c d', dof: 4 },
  { text: 'drop-perpendicular p e f m', dof: 5 },
]

describe('construction planning', () => {
  for (const { text, dof, mayFail } of figures) {
    describe(text.replace(/\n/g, '; '), () => {
      const facts = factsOf(text)
      const cp = plan(buildModel(facts))

      it(`has ${dof} degrees of freedom and uses every equation`, () => {
        expect(cp.dof).toBe(dof)
        expect(cp.used).toBe(cp.equations)
      })

      it('finds a valid starting configuration without a solver', () => {
        const r = realise(cp)
        expect(r.valid).toBe(true)
        expect(worstFact(facts, r.drawing.coords).residual).toBeLessThan(1e-9)
      })

      it('never draws a figure that violates its facts while dragging', () => {
        const random = seeded(7)
        const start = realise(cp)
        let failures = 0
        for (let i = 0; i < 300; i++) {
          const d = execute(cp, wiggle(cp, start.params, random), { previous: start.drawing.coords })
          if (d.failure) { failures++; continue }
          const w = worstFact(facts, d.coords)
          expect(w.residual, w.fact).toBeLessThan(1e-9)
          expect(d.violations).toEqual([])
        }
        if (!mayFail) expect(failures).toBe(0)
      })
    })
  }
})

describe('construction details', () => {
  it('checks a theorem on every frame: the isosceles angles hold however the figure is dragged', () => {
    const facts = factsOf('circle a b c\neq-angle a b c a c b')
    const cp = plan(buildModel(facts))
    expect(cp.used).toBe(cp.equations - 1)   // the angles follow from the circle: a check, not a locus
    const random = seeded(3)
    const start = realise(cp)
    expect(start.valid).toBe(true)
    for (let i = 0; i < 100; i++) {
      const d = execute(cp, wiggle(cp, start.params, random), { previous: start.drawing.coords })
      expect(d.violations).toEqual([])
    }
  })

  it('builds I.2 the way Euclid does: g beyond b, l beyond a', () => {
    const facts = factsOf('copy-segment a l b c')
    const cp = plan(buildModel(facts))
    expect(cp.steps.filter(s => s.kind !== 'meet').map(s => s.point).sort()).toEqual(['a', 'b', 'c'])
    const { drawing } = realise(cp)
    expect(drawing.violations).toEqual([])
    expect(worstFact(facts, drawing.coords).residual).toBeLessThan(1e-9)
  })

  it('reports where and why a construction fails instead of drawing nonsense', () => {
    const cp = plan(buildModel(factsOf('cut-segment a b x c d')))
    // Make c-d much longer than a-b: the circle about a cannot meet the segment a-b.
    const params: number[] = []
    for (const s of cp.steps) {
      if (s.kind === 'free') params.push(...({ a: [0, 0], b: [1, 0], c: [0, 3], d: [5, 3] } as Record<string, number[]>)[s.point] ?? [0, 0])
      else for (let i = 0; i < paramCount(s); i++) params.push(0.5)
    }
    const d = execute(cp, params)
    expect(d.failure?.point).toBe('x')
    expect(d.failure?.reason).toMatch(/order|meet/)
    expect(d.coords.has('a')).toBe(true)  // the drawing up to the failing step is kept
  })

  it('can make a determined point free by choosing another order', () => {
    const model = buildModel(factsOf('copy-segment a l b c'))
    const cp = plan(model, { free: ['l'] })
    expect(cp.steps[0]).toMatchObject({ kind: 'free', point: 'l' })
    expect(cp.dof).toBe(6)
    expect(cp.used).toBe(cp.equations)
  })

  it('keeps a slider point inside the interval its order facts allow', () => {
    const facts = factsOf('between a m b')
    const cp = plan(buildModel(facts))
    const r = realise(cp)
    let params = r.params
    for (const target of [[5, 5], [-5, 0], [0.3, 0.2]] as Point[]) {
      params = drag(cp, params, 'm', target)
      const d = execute(cp, params)
      expect(worstFact(facts, d.coords).residual).toBeLessThan(1e-9)
    }
  })

  it('keeps previous positions when the figure is re-planned', () => {
    const cp = plan(buildModel(factsOf('eq-triangle a b c')))
    const first = realise(cp)
    const again = realise(cp, { previous: first.drawing.coords })
    for (const [p, xy] of first.drawing.coords) {
      expect(again.drawing.coords.get(p)![0]).toBeCloseTo(xy[0], 9)
      expect(again.drawing.coords.get(p)![1]).toBeCloseTo(xy[1], 9)
    }
  })
})

describe('reusing previous positions', () => {
  it('does not reuse positions that would make distinct points coincide', () => {
    // The previous figure's apex c sits exactly where copy-segment's auxiliary apex will be.
    const before = realise(plan(buildModel(factsOf('eq-triangle a b c'))))
    const after = realise(plan(buildModel(factsOf('copy-segment a l b c'))), { previous: before.drawing.coords })
    const pts = [...after.drawing.coords.values()]
    const closest = Math.min(...pts.flatMap((p, i) => pts.slice(i + 1).map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))))
    expect(closest).toBeGreaterThan(1e-3)
  })
})

describe('the other intersection', () => {
  const minGap = (c: Map<string, Point>) => {
    const ps = [...c.values()]
    return Math.min(...ps.flatMap((p, i) => ps.slice(i + 1).map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))))
  }

  it('takes the meeting point a distinct fact allows', () => {
    const cp = plan(buildModel(factsOf('eq-triangle o a b\neq-triangle o b c\ndistinct c a')))
    const start = realise(cp)
    const random = seeded(3)
    for (let i = 0; i < 100; i++) {
      const d = execute(cp, wiggle(cp, start.params, random), { previous: start.drawing.coords })
      expect(d.failure).toBeUndefined()
      expect(minGap(d.coords)).toBeGreaterThan(1e-6)
    }
  })

  it('prefers a meeting point not already in use even without a distinct fact', () => {
    const cp = plan(buildModel(factsOf('eq-triangle o a b\neq-triangle o b c')))
    expect(minGap(realise(cp).drawing.coords)).toBeGreaterThan(1e-6)
  })
})
