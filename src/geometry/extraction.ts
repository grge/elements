/**
 * EL2 Geometry — extraction.
 * Translate logical/runtime ground facts into a GeometryProblem.
 */

import { KnowledgeBase, unfold, type GroundPredicate } from '../kb/inference'
import type { RuntimeState } from '../kb/runtime'
import type {
  GeometryProblem, Constraint,
  CollinearConstraint, BetweenConstraint, OnCircleConstraint, EqualDistConstraint,
} from './constraints'
import { canonicalise } from './canonicalization'

export const GEOMETRY_FRONTIER = new Set(['collinear', 'between', 'circle', 'eq-lines'])

export class UnsupportedPrimitiveError extends Error {}

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
      if (goal.args.length < 3) throw new Error(`collinear needs 3+ points`)
      constraints.push({ kind: 'collinear', points: [...goal.args] } satisfies CollinearConstraint)
      break

    case 'between':
      if (goal.args.length !== 3) throw new Error(`between needs 3 points`)
      constraints.push({
        kind: 'between',
        middle: goal.args[1],
        endpoints: [goal.args[0], goal.args[2]],
      } satisfies BetweenConstraint)
      break

    case 'circle':
      if (goal.args.length !== 3) throw new Error(`circle needs 3 points`)
      constraints.push({
        kind: 'on-circle',
        center: goal.args[0],
        radiusPoint: goal.args[1],
        targetPoint: goal.args[2],
      } satisfies OnCircleConstraint)
      break

    case 'eq-lines':
      if (goal.args.length !== 4) throw new Error(`eq-lines needs 4 points`)
      constraints.push({
        kind: 'eq-dist',
        pair1: [goal.args[0], goal.args[1]],
        pair2: [goal.args[2], goal.args[3]],
      } satisfies EqualDistConstraint)
      break

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

  for (const fact of facts) {
    for (const pred of unfold(fact, runtime.kb, new Set(), { stopPred: p => GEOMETRY_FRONTIER.has(p.name) }).frontier) {
      frontier.set(`${pred.name}(${pred.args.join(',')})`, pred)
    }
  }

  return [...frontier.values()]
}

export function geometryProblemFromRuntime(runtime: RuntimeState): GeometryProblem | null {
  const goals = frontierFactsFromRuntime(runtime)
  if (goals.length === 0) return null
  const merged = mergeProblems(goals.map(problemFromPrimitive))
  canonicalise(merged)
  return merged
}

export function seedPredicateHeadFact(head: GroundPredicate): GroundPredicate {
  return { name: head.name, args: [...head.args] }
}
