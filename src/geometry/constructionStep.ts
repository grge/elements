/**
 * A construction step of a written proof, checked on the figures (tools.md, *A construction step*).
 *
 * The step's new points are planned with the figure of what is drawn above it (the hypotheses and
 * earlier constructions), its inputs kept as inputs, and sampled as evidence is (evidence.ts). Four
 * checks:
 *   1. built from the points above: no point above is placed by means of a new one;
 *   2. determined, or freely chosen: the figure's freedom is unchanged, or it grows;
 *   3. apart: in every sampled figure, every new point stands apart from every other point. Only then
 *      does the checker's convention (different names, different points) cover it;
 *   4. exists: unconditionally (a free point, a point on one locus, a line through a circle's centre
 *      meeting it), or only as the figures witness it (two lines, two circles, a line missing the
 *      centre: Euclid's own gap).
 * A figure with no sample at all usually means a new point falls on a named one (the planner refuses
 * a meeting point that lands on another point); the point it falls on is named where it can be.
 */

import type { GroundPredicate, KnowledgeBase } from '../kb/inference'
import type { ConstructionCheck } from '../kb/checker'
import { FreshNames, displayName } from '../kb/names'
import type { Predicate } from '../language/parser'
import { buildModel, configurations, paramCount, plan, type Locus, type Point, type Step } from './construction'
import { extract } from './extraction'
import { holds } from './relations'
import { MARGIN } from './evidence'

const SAMPLES = 24

const ground = (p: Predicate): GroundPredicate => ({ name: p.name, args: p.args })
const names = (ps: readonly string[]) => ps.map(displayName).join(', ')

/** Does this step place its point anywhere it is wanted, whatever the figure? */
function unconditional(step: Step): boolean {
  if (step.kind !== 'meet') return true
  const [a, b] = step.loci
  const centreOf = (l: Locus) => l.kind === 'circle' ? l.center : null
  const through = (l: Locus): string[] => l.kind === 'line' ? l.through : l.kind === 'perpendicular' ? [l.at] : l.kind === 'parallel' ? [l.through] : []
  // A straight line through a circle's centre meets the circle (twice).
  return (!!centreOf(a) && through(b).includes(centreOf(a)!)) || (!!centreOf(b) && through(a).includes(centreOf(b)!))
}

/** The points a locus is built from. */
function pointsOf(l: Locus): string[] {
  const out: string[] = []
  const walk = (v: unknown) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(walk) }
  for (const [k, v] of Object.entries(l)) if (k !== 'kind') walk(v)
  return out
}

function size(coords: ReadonlyMap<string, Point>): number {
  const ps = [...coords.values()], xs = ps.map(p => p[0]), ys = ps.map(p => p[1])
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

export function checkConstruction(
  kb: KnowledgeBase,
  step: Predicate,
  above: readonly Predicate[],
  newPoints: readonly string[],
  samples = SAMPLES,
): ConstructionCheck {
  const refuse = (why: string): ConstructionCheck => ({ ok: false, apart: false, determined: false, existence: 'witnessed', why })
  // The same fresh names for the facts above, before and after, so the two figures share their points.
  const before = extract(kb, above.map(ground), { fresh: new FreshNames() })
  const after = extract(kb, [...above, step].map(ground), { fresh: new FreshNames() })
  if (before.unread.length) return refuse(`${before.unread[0].name} cannot be drawn, so the construction cannot be checked`)
  if (after.unread.length) return refuse(`${step.name} cannot be drawn: a construction must be a figure`)

  const plan0 = plan(buildModel(before.constraints))
  const inputs = plan0.steps.filter(s => s.kind === 'free').map(s => s.point)
  const model1 = buildModel(after.constraints)
  const plan1 = plan(model1, { free: inputs })
  const old = new Set(plan0.steps.map(s => s.point))
  const fresh = plan1.steps.map(s => s.point).filter(p => !old.has(p))

  // 1. Built from the points above: none of them is placed by means of a new point.
  const uses = (st: Step): string[] => st.kind === 'free' ? [] : (st.kind === 'on' ? [st.locus] : st.loci).flatMap(pointsOf)
  const needed = plan1.steps.filter(st => old.has(st.point)).flatMap(uses).filter(p => !old.has(p))
  if (needed.length) return refuse(`the points above would have to be placed by means of ${names([...new Set(needed)])}: it cannot be built from them`)

  // 2. Determined, or freely chosen.
  const dof = (steps: readonly Step[]) => steps.reduce((n, s) => n + paramCount(s), 0)
  const determined = dof(plan1.steps) <= dof(plan0.steps)

  const figures = configurations(plan1, samples)
  if (!figures.length) return refuse(coincidence(kb, step, above, newPoints, plan0) ?? `no figure has ${names(newPoints)} where this step puts ${newPoints.length === 1 ? 'it' : 'them'}`)

  // 3. Apart from every other point, in every figure.
  for (const coords of figures) {
    const scale = size(coords)
    for (const p of fresh) for (const [q, at] of coords) {
      if (q === p) continue
      const here = coords.get(p)!
      if (Math.hypot(here[0] - at[0], here[1] - at[1]) < MARGIN * scale) {
        return { ok: true, apart: false, determined, existence: 'witnessed', why: `${displayName(p)} meets ${displayName(q)} in a figure` }
      }
    }
  }

  // 4. Exists.
  const placing = plan1.steps.filter(s => !old.has(s.point))
  return { ok: true, apart: true, determined, existence: placing.every(unconditional) ? 'unconditional' : 'witnessed' }
}

/**
 * Is a new point one already named, in every figure of the points above? The step, with the point
 * renamed, holds in all of them (the centroid: where c-f meets a-d is g). Only for steps whose
 * figure has no points of its own.
 */
function coincidence(kb: KnowledgeBase, step: Predicate, above: readonly Predicate[], newPoints: readonly string[], plan0: ReturnType<typeof plan>): string | null {
  if (newPoints.length !== 1) return null
  const figures = configurations(plan0, 8)
  if (!figures.length) return null
  const p = newPoints[0]
  for (const q of plan0.steps.map(s => s.point)) {
    if (q.includes('#')) continue
    const renamed = { name: step.name, args: step.args.map(a => a === p ? q : a) }
    const facts = extract(kb, [ground(renamed)], { fresh: new FreshNames() }).constraints
    if (!facts.length || facts.some(f => f.args.some(a => !figures[0].has(a)))) continue
    if (figures.every(coords => facts.every(f => holds(f, coords)))) {
      return `${displayName(p)} is ${displayName(q)} in every figure: say so (eq-point), or use ${displayName(q)}`
    }
  }
  return null
}
