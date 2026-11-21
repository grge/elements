import { describe, it, expect } from 'vitest'
import { parseSource } from '../src/language/parser'
import { bookRules, fixtureRules } from './book'
import { KnowledgeBase, type GroundPredicate } from '../src/kb/inference'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { buildModel, plan, realise, execute, drag, paramCount, unconstructed, describeFact, legibility, type Point, type ConstructionPlan } from '../src/geometry/construction'
import { RELATIONS } from '../src/geometry/relations'

// The book plus Euclid I.2 and I.3 (tests/fixtures/constructions.geo), good stress tests for the planner.
const kb = new KnowledgeBase([...bookRules, ...fixtureRules])

const factsOf = (text: string) => { const rt = buildRuntimeState(kb, parseSource(text)); return extract(rt.kb, rt.configuration.allFacts()).constraints }

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
      const m = RELATIONS.get(f.name)!.residual!(f.args.map(n => c.get(n)!))
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
  // Chains of equal angles: two arms from one vertex meet only there, so the second equality is
  // taken up by another point, not by collapsing one onto a vertex.
  { text: 'eq-angle a b c d e f\neq-angle d e f g h i', dof: 16 },
  { text: 'eq-angle a b c d e f\neq-angle a b c g h i', dof: 16 },
  { text: 'eq-angle a b c c b d\neq-angle c b d d b e', dof: 8 },
  { text: 'eq-angle a b c d b e\neq-angle d b e g b h', dof: 12 },
  { text: 'supp a b c d e f\nsupp d e f g h i', dof: 16 },
  { text: 'eq-angle a b c d e f\neq-angle b c a e f d', dof: 10 },     // similar triangles
  { text: 'eq-angle a b c a c b', dof: 5 },                            // equal base angles: a perpendicular bisector
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

describe('no point collapses onto another', () => {
  // Two loci through one placed point meet only there; such a point used to be drawn on top of it.
  for (const text of ['eq-angle a b c d e f\neq-angle d e f g h i', 'eq-angle a b c c b d\neq-angle c b d d b e', 'eq-angle a b c d e f\neq-angle d e f a b c']) {
    it(text.replace(/\n/g, '; '), () => {
      const { drawing } = realise(plan(buildModel(factsOf(text))))
      const ps = [...drawing.coords.values()]
      const closest = Math.min(...ps.flatMap((p, i) => ps.slice(i + 1).map(q => Math.hypot(p[0] - q[0], p[1] - q[1]))))
      expect(closest).toBeGreaterThan(1e-3)
    })
  }
})

describe('facts a plan does not construct', () => {
  it('names the fact and the point left to the solver', () => {
    const cp = plan(buildModel(factsOf('eq-angle b a c a b c\neq-angle a b c b c a')))
    expect(realise(cp).valid).toBe(false)
    expect(unconstructed(cp).map(u => [u.point, describeFact(u.fact)])).toEqual([['c', 'eq-angle a b c b c a']])
  })
  it('prefers a named point to an auxiliary one', () => {
    // A bisected angle whose halves are each a base angle: d is overdetermined, and so is the bisector's
    // auxiliary point e₁; the fact about e₁ is said to place d.
    const cp = plan(buildModel(factsOf('bisect-angle a b c d\neq-angle a b d b d a\neq-angle d b c b c d')))
    const u = unconstructed(cp)
    expect(u.length).toBe(2)
    expect(new Set(u.map(x => x.point))).toEqual(new Set(['d']))
  })
  it('finds none in a figure the plan constructs', () => {
    expect(unconstructed(plan(buildModel(factsOf('eq-triangle a b c'))))).toEqual([])
  })
})

describe('parallels', () => {
  it('holds for parallel lines and the same line, not for crossing ones', () => {
    const p = RELATIONS.get('parallel')!
    expect(p.holds([[0, 0], [1, 0], [0, 1], [3, 1]], 1e-9)).toBe(true)
    expect(p.holds([[0, 0], [1, 0], [2, 0], [5, 0]], 1e-9)).toBe(true)
    expect(p.holds([[0, 0], [1, 0], [0, 1], [3, 1.1]], 1e-9)).toBe(false)
  })
  it('constructs a parallelogram: the fourth corner where two parallels meet', () => {
    const cp = plan(buildModel(factsOf('parallel a b d c\nparallel a d b c')))
    expect(cp.steps.map(s => s.kind)).toEqual(['free', 'free', 'free', 'meet'])
    const c = cp.steps[3]
    expect(c.kind === 'meet' && c.loci.map(l => l.kind)).toEqual(['parallel', 'parallel'])
    const r = realise(cp)
    expect(r.valid).toBe(true)
    const d = execute(cp, r.params)
    expect(d.violations).toEqual([])
  })
  it('redrawn from where it was realised, keeps its branches (parallel-through)', () => {
    // a is one of two circle intersections; on the other, line q-a runs parallel to p-b and the
    // construction cannot go on. Redrawn with another figure's positions as the reference for branches
    // it got stuck about half the time; with its own, never.
    const cp = plan(buildModel(factsOf('parallel-through a b p q')))
    for (let seed = 0; seed < 20; seed++) {
      const r = realise(cp)
      expect(r.valid).toBe(true)
      const stale = new Map<string, Point>([['a', [Math.cos(seed), Math.sin(1.7 * seed)]], ['b', [0.3, -0.2]]])
      for (const previous of [r.drawing.coords, new Map([...stale, ...r.drawing.coords])]) {
        expect(execute(cp, r.params, { previous }).failure).toBeUndefined()
      }
    }
  })
})

describe('equal areas', () => {
  const size = (a: Point, b: Point, c: Point) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2

  it('holds by the sizes of the triangles, whatever the order of their corners', () => {
    const p = RELATIONS.get('eq-area')!
    expect(p.holds([[0, 0], [2, 0], [0, 1], [5, 5], [5, 6], [7, 5]], 1e-9)).toBe(true)     // 1 and 1
    expect(p.holds([[0, 0], [2, 0], [0, 1], [5, 5], [5, 7], [7, 5]], 1e-9)).toBe(false)    // 1 and 2
  })

  it('places a corner on a parallel to its base, at the height that makes the area', () => {
    const cp = plan(buildModel(factsOf('eq-area a b c d e f')))
    const f = cp.steps[5]
    expect(f.kind === 'on' && f.locus).toEqual({ kind: 'area', base: ['d', 'e'], area: ['a', 'b', 'c'] })
    const { valid, drawing } = realise(cp)
    expect(valid).toBe(true)
    const at = (q: string) => drawing.coords.get(q)!
    expect(size(at('d'), at('e'), at('f'))).toBeCloseTo(size(at('a'), at('b'), at('c')), 9)
  })

  it('shears a triangle: a corner where that parallel meets another locus', () => {
    const cp = plan(buildModel(factsOf('eq-area a b c a b d\ncircle a b d')))
    const d = cp.steps[3]
    expect(d.kind === 'meet' && d.loci.map(l => l.kind).sort()).toEqual(['area', 'circle'])
    const { valid } = realise(cp)
    expect(valid).toBe(true)
  })
})

describe('branches the order facts decide only later', () => {
  it('the windmill constructs: its squares stand outside the triangle, which only its crossings say', () => {
    // c slides on the parallel to b-f through a, and d is one of two meeting points; that c and d are
    // on the far sides of a-b and b-c is checked only where f-c and a-d cross, after both are placed.
    const cp = plan(buildModel(factsOf('windmill a b c f g d e l x y')))
    const r = realise(cp)
    expect(r.valid).toBe(true)
    expect(execute(cp, r.params, { previous: r.drawing.coords }).violations).toEqual([])
  })
})

describe('figures that read well', () => {
  const triangle = plan(buildModel(factsOf('triangle a b c')))
  const fig = (ps: Record<string, Point>) => new Map(Object.entries(ps))

  it('scores a sliver, crowded points or a special-looking figure below a plain one', () => {
    const plain = legibility(triangle, fig({ a: [0, 0], b: [1, 0], c: [0.3, 0.8] }))
    expect(legibility(triangle, fig({ a: [0, 0], b: [1, 0], c: [0.5, 0.03] }))).toBeLessThan(plain)   // a sliver
    expect(legibility(triangle, fig({ a: [0, 0], b: [1, 0], c: [0.97, 0.3] }))).toBeLessThan(plain)   // c crowds b
    expect(legibility(triangle, fig({ a: [0, 0], b: [1, 0], c: [0.5, 0.85] }))).toBeLessThan(plain)   // nearly equilateral
    expect(legibility(triangle, fig({ a: [0, 0], b: [1, 0], c: [0.02, 0.7] }))).toBeLessThan(plain)   // nearly right
  })

  it('does not count what holds: a midpoint on its segment, or an equality the figure states', () => {
    const midpoint = plan(buildModel(factsOf('midpoint m a b')))
    expect(legibility(midpoint, fig({ a: [0, 0], b: [2, 0], m: [1, 0] }))).toBeCloseTo(0.5, 9)
  })

  it("draws a triangle as any triangle: not isosceles, not right-angled", () => {
    const { drawing, valid } = realise(triangle)
    expect(valid).toBe(true)
    const at = (p: string) => drawing.coords.get(p)!
    const sides = [['a', 'b'], ['b', 'c'], ['c', 'a']].map(([p, q]) => Math.hypot(at(p)[0] - at(q)[0], at(p)[1] - at(q)[1])).sort((x, y) => x - y)
    expect(sides[1] / sides[0]).toBeGreaterThan(1.05)
    expect(sides[2] / sides[1]).toBeGreaterThan(1.05)
    expect(Math.abs(sides[2] ** 2 - sides[0] ** 2 - sides[1] ** 2) / sides[2] ** 2).toBeGreaterThan(0.1)
  })

  it('polishes the sampled figure: the chapter 4 constructions read better than their best sample', () => {
    // Below this, points crowd or a triangle is a sliver at the size the page draws them.
    // The windmill draws both whole squares: fourteen points, more crowded.
    for (const [text, least] of [['drop-corner a b c d e', 0.09], ['triangle-to-rectangle a b c e f g', 0.09], ['windmill a b c f g d e l x y', 0.06]] as const) {
      const cp = plan(buildModel(factsOf(text), text.split(' ').slice(1)))
      const { drawing, valid } = realise(cp)
      expect(valid).toBe(true)
      expect(legibility(cp, drawing.coords)).toBeGreaterThan(least)
    }
  })
})

describe('right angles', () => {
  const constructs = (text: string) => {
    const cp = plan(buildModel(factsOf(text)))
    const r = realise(cp)
    expect(r.valid).toBe(true)
    expect(worstFact(cp.checks.map(c => c.fact), r.drawing.coords).residual).toBeLessThan(1e-7)
    return cp
  }

  it('places a right angle\'s arm on the perpendicular at its vertex, its extension point after', () => {
    const cp = constructs('right a b c')
    expect(cp.steps.map(s => s.point)).toEqual(['a', 'b', 'c', 'd#1'])
    expect(cp.steps[2]).toMatchObject({ kind: 'on', locus: { kind: 'perpendicular', at: 'b', to: 'a' } })
  })

  it('places a vertex after both arms on the circle on them (Thales): the foot of a perpendicular', () => {
    // Three feet from one point: no order places every vertex before its arms.
    const cp = constructs('triangle a b c\ncollinear b c d\nright a d b\ncollinear c a e\nright b e c\ncollinear a b f\nright c f a')
    expect(cp.steps.some(s => s.kind === 'meet' && s.loci.some(l => l.kind === 'thales'))).toBe(true)
    expect(cp.dof).toBe(6 + 3)   // the triangle, and each right angle's extension point
  })

  it('constructs the figures that need it: four right angles, the orthocentre, the Simson line', () => {
    constructs('right d a b\nright a b c\nright b c d\nright c d a')
    constructs('triangle a b c\nbetween b h c\nright a h b\nbetween a k c\nright b k a\nbetween a o h\nbetween b o k')
    constructs('circle o a b\ncircle o a c\ncircle o a p\ntriangle a b c\ncollinear b c d\nright p d b\ncollinear c a e\nright p e c\ncollinear a b f\nright p f a')
  })

  it('takes two loci that a theorem makes one curve as one condition (Thales on a diameter)', () => {
    const cp = constructs('circle o a c\nbetween a o c\ncircle o a b\ndistinct b a\ndistinct b c\nright a b c')
    const b = cp.steps.find(s => s.point === 'b')!
    expect(b.kind).toBe('on')
  })

  it('builds triangle-to-rectangle from the triangle', () => {
    const cp = plan(buildModel(factsOf('triangle-to-rectangle a b c e f g'), ['a', 'b', 'c', 'e', 'f', 'g']))
    expect(cp.steps.slice(0, 3).map(s => [s.point, s.kind])).toEqual([['a', 'free'], ['b', 'free'], ['c', 'free']])
  })
})

describe('dragging after the construction is reversed', () => {
  it('keeps the branches as drawn: the square from c, then d₁ pressed, stays where it was', () => {
    // Pressing c (determined) re-plans with c free, so b is where two loci meet; the parameters do not
    // say which of the two, the drawing does.
    const model = buildModel(factsOf('square a b c d'), ['a', 'b', 'c', 'd'])
    const first = realise(plan(model))
    const alt = plan(model, { free: ['c'] })
    const r = realise(alt, { previous: first.drawing.coords })
    const drawn = execute(alt, r.params, { previous: r.drawing.coords }).coords
    for (const p of ['a', 'b', 'c']) {
      const [x, y] = drawn.get(p)!
      expect(Math.hypot(x - first.drawing.coords.get(p)![0], y - first.drawing.coords.get(p)![1])).toBeLessThan(1e-9)
    }
    const at = drawn.get('d#1')!
    const after = execute(alt, drag(alt, r.params, 'd#1', at, drawn), { previous: drawn }).coords.get('d#1')!
    expect(Math.hypot(after[0] - at[0], after[1] - at[1])).toBeLessThan(1e-9)
  })
})

describe("Euclid's moves only", () => {
  const passes = (text: string) => realise(plan(buildModel(factsOf(text)), { euclid: true })).valid
  it('draws a construction made of them: the equilateral triangle, the perpendicular (I.11)', () => {
    expect(passes('eq-triangle a b c')).toBe(true)
    expect(passes('perpendicular a c d')).toBe(true)
  })
  it('does not draw what needs the planner: a carried length, a right angle by definition, a parallel', () => {
    expect(passes('copy-angle a b c e g d')).toBe(false)
    expect(passes('right a b c')).toBe(false)
    expect(passes('parallelogram a b c d')).toBe(false)
  })
})
