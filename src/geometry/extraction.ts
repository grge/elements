/**
 * Extraction: from the facts of a configuration to drawable facts (collinear, between, circle,
 * eq-lines) by unfolding definitions, and from those to a GeometryProblem.
 */

import { KnowledgeBase, unfold, type GroundPredicate } from '../kb/inference'
import { FreshNames } from '../kb/names'
import type { RuntimeState } from '../kb/runtime'
import type {
  GeometryProblem, Constraint,
  CollinearConstraint, BetweenConstraint, OnCircleConstraint, EqualDistConstraint,
} from './constraints'
import { canonicalise } from './canonicalization'

export const GEOMETRY_FRONTIER = new Set(['collinear', 'between', 'circle', 'eq-lines', 'distinct'])

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

function problemFromPrimitive(goal: GroundPredicate): GeometryProblem {
  const points = new Set<string>()
  const constraints: Constraint[] = []

  goal.args.forEach(a => points.add(a))

  switch (goal.name) {
    case 'collinear':
      if (goal.args.length < 3) throw new MalformedFactError(`collinear needs 3+ points`)
      constraints.push({ kind: 'collinear', points: [...goal.args] } satisfies CollinearConstraint)
      break

    case 'between':
      if (goal.args.length !== 3) throw new MalformedFactError(`between needs 3 points`)
      constraints.push({
        kind: 'between',
        middle: goal.args[1],
        endpoints: [goal.args[0], goal.args[2]],
      } satisfies BetweenConstraint)
      // Betweenness implies collinearity; state it so the canonical line structure exists
      // for the planner and renderer. The order constraint above is kept separately.
      constraints.push({ kind: 'collinear', points: [...goal.args] } satisfies CollinearConstraint)
      break

    case 'circle':
      if (goal.args.length !== 3) throw new MalformedFactError(`circle needs 3 points`)
      constraints.push({
        kind: 'on-circle',
        center: goal.args[0],
        radiusPoint: goal.args[1],
        targetPoint: goal.args[2],
      } satisfies OnCircleConstraint)
      break

    case 'eq-lines':
      if (goal.args.length !== 4) throw new MalformedFactError(`eq-lines needs 4 points`)
      constraints.push({
        kind: 'eq-dist',
        pair1: [goal.args[0], goal.args[1]],
        pair2: [goal.args[2], goal.args[3]],
      } satisfies EqualDistConstraint)
      break

    case 'distinct':
      break  // no constraint on positions; the construction planner keeps the points apart

    default:
      throw new UnsupportedPrimitiveError(`Unsupported primitive: ${goal.name}`)
  }

  return { points, constraints, lines: [], circles: [] }
}

/** Legacy/single-goal entrypoint: unfold one goal to the geometry frontier, then map it. */
export function extractProblem(goal: GroundPredicate, kb: KnowledgeBase): GeometryProblem {
  const frontier = unfold(goal, kb, new Set(), { stopPred: p => GEOMETRY_FRONTIER.has(p.name) }).frontier
  return mergeProblems(frontier.map(problemFromPrimitive))
}

export function frontierFactsFromRuntime(runtime: RuntimeState): GroundPredicate[] {
  const facts = runtime.configuration.allFacts()
  const frontier = new Map<string, GroundPredicate>()
  // Shared across facts: two constructions in one drawing must not share auxiliary points.
  const fresh = new FreshNames()

  for (const fact of facts) {
    for (const pred of unfold(fact, runtime.kb, new Set(), { stopPred: p => GEOMETRY_FRONTIER.has(p.name), fresh }).frontier) {
      frontier.set(`${pred.name}(${pred.args.join(',')})`, pred)
    }
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

export function geometryProblemFromRuntime(runtime: RuntimeState): GeometryProblem | null {
  return geometryProblemFromFacts(frontierFactsFromRuntime(runtime))
}

export function seedPredicateHeadFact(head: GroundPredicate): GroundPredicate {
  return { name: head.name, args: [...head.args] }
}
