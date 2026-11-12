/**
 * Extraction: what a page's facts mean for the figure.
 *
 * Facts are unfolded as the logic unfolds them, all the way to open predicates, keeping the tree.
 * Three things are read off it, in one traversal:
 *
 *   constraints  the leaves the geometric model can read (CONSTRAINT_RELATIONS): what the planner
 *                builds from. `circle a b c` arrives as its definition, `eq-lines a b a c`.
 *   depicted     on each path from a written fact, the first node the figure draws
 *                (DEPICTED_RELATIONS): a circle node is drawn as a circle, and what it unfolds to is
 *                not drawn again. Where unfolding stops is the logic's business, not the drawing's.
 *   unread       leaves with no geometric reading (`eq-point`, `triangle`, a user's open predicate):
 *                reported, not silently dropped.
 */

import { KnowledgeBase, unfoldTree, type GroundPredicate, type UnfoldNode } from '../kb/inference'
import { FreshNames } from '../kb/names'
import type {
  GeometryProblem, Constraint,
  CollinearConstraint, BetweenConstraint, OnCircleConstraint, EqualDistConstraint,
} from './constraints'
import { canonicalise } from './canonicalization'

/** Open predicates the geometric model reads as constraints (equations, loci, choices). */
export const CONSTRAINT_RELATIONS = new Set(['collinear', 'between', 'eq-lines', 'distinct', 'eq-angle', 'eq-spread', 'supp'])

/** Relations the figure draws. `circle` is defined (equal radii) but drawn as a circle. */
export const DEPICTED_RELATIONS = new Set([...CONSTRAINT_RELATIONS, 'circle'])

/** Everything the drawing layer understands. */
export const GEOMETRY_FRONTIER = DEPICTED_RELATIONS

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

export interface Extraction {
  /** What the planner builds from: the leaves the geometric model reads. */
  constraints: DrawableFact[]
  /** What the figure draws: the first drawn node on each path from a written fact. */
  depicted: DrawableFact[]
  /** Leaves with no geometric reading. */
  unread: DrawableFact[]
}

/** Unfold facts and read off their constraints, what to draw, and what the drawing cannot read. */
export function extract(kb: KnowledgeBase, facts: readonly GroundPredicate[]): Extraction {
  const sets = { constraints: new Map<string, DrawableFact>(), depicted: new Map<string, DrawableFact>(), unread: new Map<string, DrawableFact>() }
  const add = (into: Map<string, DrawableFact>, n: UnfoldNode) => {
    const key = `${n.fact.name}(${n.fact.args.join(',')})`
    // A fact reached twice keeps its shallowest depth.
    into.set(key, { ...n.fact, depth: Math.min(n.depth, into.get(key)?.depth ?? Infinity) })
  }
  const walk = (n: UnfoldNode, drawn: boolean) => {
    if (!drawn && DEPICTED_RELATIONS.has(n.fact.name)) { add(sets.depicted, n); drawn = true }
    if (n.children) { n.children.forEach(c => walk(c, drawn)); return }
    if (CONSTRAINT_RELATIONS.has(n.fact.name)) add(sets.constraints, n)
    else if (n.fact.name !== 'false') add(sets.unread, n)
  }
  // Shared across facts: two constructions in one drawing must not share auxiliary points.
  const fresh = new FreshNames()
  for (const fact of facts) walk(unfoldTree(fact, kb, { fresh }), false)
  return { constraints: [...sets.constraints.values()], depicted: [...sets.depicted.values()], unread: [...sets.unread.values()] }
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
