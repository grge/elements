/**
 * A construction step of a written proof, checked on the figures (tools.md, *A construction step*).
 *
 * "Let d be a point such that…" is sound when two things hold of the step (the checker sees to a
 * third, that its new points are not in the claim):
 *   - it is conservative: it says where its new points are and nothing more about the points above.
 *     Then any figure of what is above has such points, and the claim, which does not name them,
 *     follows from what is above alone;
 *   - its points exist in every such figure: always (a locus that always exists; a line through a
 *     circle's centre meeting it), or only as the figures witness it (Euclid's own gap: when do two
 *     circles meet?).
 *
 * The step is planned after the figure of what is above it, that figure's steps kept exactly, so it
 * can only place its new points. Then:
 *   1. conservative: every equation the step adds is used to place one of its new points; one left
 *      over would be a condition on the points above (a right angle there, a length). The checker
 *      also asks that each of the step's facts naming only points above follows from them;
 *   2. determined, or freely chosen: its new points are fixed by it, or some are free;
 *   3. apart: in every sampled figure every new point stands apart from every other point. Only then
 *      does the checker's convention (different names, different points) cover it;
 *   4. exists: always, or only as the figures witness it (`locusAlwaysExists`, and the line through a
 *      centre).
 * A figure with no sample at all usually means a new point falls on a named one (the planner refuses
 * a meeting point that lands on another point); the point it falls on is named where it can be.
 */

import type { GroundPredicate, KnowledgeBase } from '../kb/inference'
import type { ConstructionCheck } from '../kb/checker'
import { FreshNames, displayName } from '../kb/names'
import type { Predicate } from '../language/parser'
import { buildModel, centre, configurations, locusAlwaysExists, paramCount, pivots, plan, type Point, type Step } from './construction'
import { extract } from './extraction'
import { holds } from './relations'
import { MARGIN } from './evidence'

const SAMPLES = 24

const ground = (p: Predicate): GroundPredicate => ({ name: p.name, args: p.args })
const names = (ps: readonly string[]) => ps.map(displayName).join(', ')

/** Does this step place its point whatever the figure? */
function always(step: Step): boolean {
  if (step.kind === 'free') return true
  if (step.kind === 'on') return locusAlwaysExists(step.locus)
  const [a, b] = step.loci
  if (!locusAlwaysExists(a) || !locusAlwaysExists(b)) return false
  // A straight line through a circle's centre meets the circle (twice).
  const through = (circle: typeof a, line: typeof a) => { const c = centre(circle); return !!c && pivots(line).includes(c) }
  return through(a, b) || through(b, a)
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

  // The figure of what is above, then the step's points after it, that figure's steps kept as they are.
  const plan0 = plan(buildModel(before.constraints))
  const plan1 = plan(buildModel(after.constraints), { after: plan0.steps })
  const old = new Set(plan0.steps.map(s => s.point))
  const placing = plan1.steps.filter(s => !old.has(s.point))

  // 1. Conservative: the equations the step adds, each used to place a new point.
  const used = placing.reduce((n, s) => n + 2 - paramCount(s), 0)
  const added = plan1.equations - plan0.equations
  if (added > used) return refuse(`it says more than where ${names(newPoints)} ${newPoints.length === 1 ? 'is' : 'are'}: it would put a condition on the points above`)

  // 2. Determined, or freely chosen.
  const determined = placing.every(s => paramCount(s) === 0)

  const figures = configurations(plan1, samples)
  if (!figures.length) return refuse(coincidence(kb, step, above, newPoints, plan0) ?? `no figure has ${names(newPoints)} where this step puts ${newPoints.length === 1 ? 'it' : 'them'}`)

  // 3. Apart from every other point, in every figure.
  for (const coords of figures) {
    const scale = size(coords)
    for (const { point: p } of placing) for (const [q, at] of coords) {
      if (q === p) continue
      const here = coords.get(p)!
      if (Math.hypot(here[0] - at[0], here[1] - at[1]) < MARGIN * scale) {
        return { ok: true, apart: false, determined, existence: 'witnessed', why: `${displayName(p)} meets ${displayName(q)} in a figure` }
      }
    }
  }

  // 4. Exists.
  return { ok: true, apart: true, determined, existence: placing.every(always) ? 'unconditional' : 'witnessed' }
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
