/**
 * Extraction: from facts to drawable facts (collinear, between, circle, eq-lines, distinct) by
 * unfolding definitions, and from those to a GeometryProblem.
 */

import { KnowledgeBase, unfold, type GroundPredicate } from '../kb/inference'
import { FreshNames } from '../kb/names'
import type {
  GeometryProblem, Constraint,
  CollinearConstraint, BetweenConstraint, OnCircleConstraint, EqualDistConstraint,
} from './constraints'
import { canonicalise } from './canonicalization'

export const GEOMETRY_FRONTIER = new Set(['collinear', 'between', 'circle', 'eq-lines', 'distinct', 'eq-angle', 'eq-spread', 'supp'])

export class UnsupportedPrimitiveError extends Error {}

/** A drawable fact with the wrong number of points, e.g. `circle a b` while it is being typed. */
export class MalformedFactError extends Error {}

function mergeProblems(problems: GeometryProblem[]): GeometryProblem {
  return {
    points: new Set(problems.flatMap(p => Array.from(p.points))),
    constraints: problems.flatMap(p => p.constraints),
    lines: problems.flatMap(p => p.lines),
    circles: problems.flatMap(p => p.circles),
  }
}

function problemFromPrimitive(goal: GroundPredicate & { depth?: number }): GeometryProblem {
  const points = new Set<string>()
  const constraints: Constraint[] = []
  const depth = goal.depth ?? 0

  goal.args.forEach(a => points.add(a))

  switch (goal.name) {
    case 'collinear':
      if (goal.args.length < 3) throw new MalformedFactError(`collinear needs 3+ points`)
      constraints.push({ kind: 'collinear', points: [...goal.args], depth } satisfies CollinearConstraint)
      break

    case 'between':
      if (goal.args.length !== 3) throw new MalformedFactError(`between needs 3 points`)
      constraints.push({
        kind: 'between',
        middle: goal.args[1],
        endpoints: [goal.args[0], goal.args[2]],
        depth,
      } satisfies BetweenConstraint)
      // Betweenness implies collinearity; state it so the canonical line structure exists
      // for the planner and renderer. The order constraint above is kept separately.
      constraints.push({ kind: 'collinear', points: [...goal.args], depth } satisfies CollinearConstraint)
      break

    case 'circle':
      if (goal.args.length !== 3) throw new MalformedFactError(`circle needs 3 points`)
      constraints.push({
        kind: 'on-circle',
        center: goal.args[0],
        radiusPoint: goal.args[1],
        targetPoint: goal.args[2],
        depth,
      } satisfies OnCircleConstraint)
      break

    case 'eq-lines':
      if (goal.args.length !== 4) throw new MalformedFactError(`eq-lines needs 4 points`)
      constraints.push({
        kind: 'eq-dist',
        pair1: [goal.args[0], goal.args[1]],
        pair2: [goal.args[2], goal.args[3]],
        depth,
      } satisfies EqualDistConstraint)
      break

    case 'distinct':
      break  // no constraint on positions; the construction planner keeps the points apart

    case 'eq-angle': case 'eq-spread': case 'supp':
      if (goal.args.length !== (goal.name === 'eq-spread' ? 8 : 6)) throw new MalformedFactError(`${goal.name} needs ${goal.name === 'eq-spread' ? 8 : 6} points`)
      constraints.push({ kind: 'measure', name: goal.name, args: [...goal.args], depth })
      break

    default:
      throw new UnsupportedPrimitiveError(`Unsupported primitive: ${goal.name}`)
  }

  return { points, constraints, lines: [], circles: [] }
}

/**
 * A drawable fact, with its depth: how many definitions were unfolded to reach it. A fact written
 * on the page is 0; the circles of an `eq-triangle` written there are 1; those of an `eq-triangle`
 * inside another construction are 2. The figure draws deeper facts fainter.
 */
export type DrawableFact = GroundPredicate & { depth: number }

/** Unfold facts to the drawable facts they mean; anything else they unfold to is dropped. */
export function drawableFacts(kb: KnowledgeBase, facts: readonly GroundPredicate[]): DrawableFact[] {
  const frontier = new Map<string, DrawableFact>()
  // Shared across facts: two constructions in one drawing must not share auxiliary points.
  const fresh = new FreshNames()

  for (const fact of facts) {
    const u = unfold(fact, kb, new Set(), { stopPred: p => GEOMETRY_FRONTIER.has(p.name), fresh })
    u.frontier.forEach((pred, i) => {
      if (!GEOMETRY_FRONTIER.has(pred.name)) return
      const key = `${pred.name}(${pred.args.join(',')})`
      const depth = Math.min(u.depths[i], frontier.get(key)?.depth ?? Infinity)
      frontier.set(key, { ...pred, depth })
    })
  }

  return [...frontier.values()]
}

/**
 * Build the canonical problem from drawable facts; facts the renderer cannot draw are skipped,
 * including ones with the wrong number of points (a line still being typed).
 */
export function geometryProblemFromFacts(facts: readonly GroundPredicate[]): GeometryProblem | null {
  const problems = facts.filter(f => GEOMETRY_FRONTIER.has(f.name)).flatMap(f => {
    try { return [problemFromPrimitive(f)] }
    catch (e) { if (e instanceof MalformedFactError) return []; throw e }
  })
  if (problems.length === 0) return null
  const merged = mergeProblems(problems)
  canonicalise(merged)
  return merged
}
