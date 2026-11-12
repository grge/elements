/**
 * Numeric evidence for a lemma: does its head hold in figures that satisfy its hypotheses?
 *
 * The hypotheses are unfolded to drawable facts and planned as a construction, like any figure; a
 * couple of dozen well-spread configurations are sampled, and the head, unfolded too, is evaluated
 * on each. One configuration where it fails refutes the lemma (a counterexample); holding in all of
 * them makes it probably true, not proven. Evidence is only offered when every hypothesis can be
 * drawn: a hypothesis the figure ignores would make a "counterexample" meaningless.
 *
 * The drawing takes distinct names for distinct points, so a lemma that is false only in a
 * degenerate configuration (two of its points coinciding) holds in every sample.
 */

import { unfold, type GroundPredicate, type KnowledgeBase } from '../kb/inference'
import { FreshNames, displayName } from '../kb/names'
import type { Lemma } from '../language/parser'
import { buildModel, configurations, plan, type Point } from './construction'
import { DEPICTED_RELATIONS as GEOMETRY_FRONTIER } from './extraction'
import { measureResidual } from './measure'

export type Evidence =
  | { kind: 'none'; why: string }
  | { kind: 'holds'; samples: number }
  | { kind: 'fails'; samples: number; coords: Map<string, Point>; failing: string }

/** Relations the evidence can evaluate in the head: the drawable ones, and equality of points. */
const EVALUABLE = new Set([...GEOMETRY_FRONTIER, 'eq-point'])

const SAMPLES = 24

export function numericEvidence(lemma: Lemma, kb: KnowledgeBase, samples = SAMPLES): Evidence {
  const fresh = new FreshNames()
  const stop = (p: GroundPredicate) => EVALUABLE.has(p.name)
  const hypotheses = lemma.hypotheses.flatMap(h => unfold({ name: h.name, args: h.args }, kb, new Set(), { stopPred: stop, fresh }).frontier)
  const undrawable = hypotheses.find(f => !GEOMETRY_FRONTIER.has(f.name))
  if (undrawable) return { kind: 'none', why: `${undrawable.name} cannot be drawn` }

  const known = new Set(hypotheses.flatMap(f => f.args))
  const goal = unfold({ name: lemma.head.name, args: lemma.head.args }, kb, new Set(), { stopPred: stop, fresh }).frontier
  const unevaluable = goal.find(f => !EVALUABLE.has(f.name))
  if (unevaluable) return { kind: 'none', why: `${unevaluable.name} cannot be measured` }
  // Points the head's own definition introduces would need witnesses: some point exists such that…
  if (goal.some(f => f.args.some(a => a.includes('#') && !known.has(a)))) {
    return { kind: 'none', why: 'the claim introduces points of its own' }
  }

  // Points only the head mentions are arbitrary: free points of the figure.
  const model = buildModel(hypotheses)
  for (const p of lemma.head.args) if (!model.points.includes(p)) model.points.push(p)
  const cp = plan(model)
  const figures = configurations(cp, samples)
  if (figures.length === 0) return { kind: 'none', why: 'no figure satisfies the hypotheses' }

  for (const coords of figures) {
    const failing = goal.find(f => !holds(f, coords))
    if (failing) {
      return { kind: 'fails', samples: figures.length, coords, failing: `${failing.name} ${failing.args.map(displayName).join(' ')}` }
    }
  }
  return { kind: 'holds', samples: figures.length }
}

/** Does a fact hold in a configuration, up to a tolerance relative to the figure's size? */
export function holds(f: GroundPredicate, coords: Map<string, Point>): boolean {
  const ps = f.args.map(a => coords.get(a))
  if (ps.some(p => !p)) return true   // a point the figure does not have: nothing to measure
  const size = Math.max(1, ...[...coords.values()].flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]))
  const tol = 1e-7 * size
  const d = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1])
  const [a, b, c, e] = ps as Point[]
  switch (f.name) {
    case 'eq-point': return d(a, b) <= tol
    case 'distinct': return d(a, b) > tol
    case 'circle': return Math.abs(d(a, b) - d(a, c)) <= tol
    case 'eq-lines': return Math.abs(d(a, b) - d(c, e)) <= tol
    case 'collinear': {
      const pts = ps as Point[]
      const [p, q] = farthestPair(pts)
      const len = d(p, q)
      return len <= tol || pts.every(r => Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / len <= tol)
    }
    case 'between': {
      const ac = d(a, c)
      if (ac <= tol) return d(a, b) <= tol
      const cross = Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / ac
      const t = ((b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1])) / (ac * ac)
      return cross <= tol && t >= -tol / ac && t <= 1 + tol / ac
    }
    case 'eq-angle': case 'eq-spread': case 'supp': {
      const r = measureResidual(f.name, f.args, p => coords.get(p))
      return Number.isNaN(r) || r <= 1e-7
    }
    default: return true
  }
}

function farthestPair(ps: Point[]): [Point, Point] {
  let best: [Point, Point] = [ps[0], ps[0]], len = -1
  for (const p of ps) for (const q of ps) {
    const l = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (l > len) { len = l; best = [p, q] }
  }
  return best
}
