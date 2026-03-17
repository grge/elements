/**
 * EL2 Geometry — extraction.
 * Expand an EL2 goal via KB and map primitive predicates to constraints.
 */

import { KnowledgeBase, expandUnique, groundKey } from '../kb/inference'
import type { GroundPredicate } from '../kb/inference'
import type {
  GeometryProblem, Constraint,
  CollinearConstraint, BetweenConstraint, OnCircleConstraint, EqualDistConstraint,
} from './constraints'

export const PRIMITIVES = new Set(['collinear', 'between', 'circle', 'eq-lines'])

export class UnsupportedPrimitiveError extends Error {}

export function extractProblem(goal: GroundPredicate, kb: KnowledgeBase): GeometryProblem {
  const leafKeys = expandUnique(goal, kb, new Set(), p => PRIMITIVES.has(p.name))

  const points = new Set<string>()
  const constraints: Constraint[] = []

  for (const key of leafKeys) {
    const pred = parseGroundKey(key)
    pred.args.forEach(a => points.add(a))

    switch (pred.name) {
      case 'collinear':
        if (pred.args.length < 3) throw new Error(`collinear needs 3+ points: ${key}`)
        constraints.push({ kind: 'collinear', points: pred.args } satisfies CollinearConstraint)
        break

      case 'between':
        if (pred.args.length !== 3) throw new Error(`between needs 3 points: ${key}`)
        constraints.push({
          kind: 'between',
          middle: pred.args[1],
          endpoints: [pred.args[0], pred.args[2]],
        } satisfies BetweenConstraint)
        break

      case 'circle':
        if (pred.args.length !== 3) throw new Error(`circle needs 3 points: ${key}`)
        constraints.push({
          kind: 'on-circle',
          center: pred.args[0],
          radiusPoint: pred.args[1],
          targetPoint: pred.args[2],
        } satisfies OnCircleConstraint)
        break

      case 'eq-lines':
        if (pred.args.length !== 4) throw new Error(`eq-lines needs 4 points: ${key}`)
        constraints.push({
          kind: 'eq-dist',
          pair1: [pred.args[0], pred.args[1]],
          pair2: [pred.args[2], pred.args[3]],
        } satisfies EqualDistConstraint)
        break

      default:
        throw new UnsupportedPrimitiveError(`Unsupported primitive: ${pred.name}`)
    }
  }

  return { points, constraints, lines: [], circles: [] }
}

/** Parse a groundKey string like "circle(a,b,c)" back to name+args */
function parseGroundKey(key: string): { name: string; args: string[] } {
  const i = key.indexOf('(')
  const name = key.slice(0, i)
  const args = key.slice(i + 1, -1).split(',')
  return { name, args }
}
