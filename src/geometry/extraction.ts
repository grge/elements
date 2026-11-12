/**
 * Extraction: what a page's facts mean for the figure.
 *
 * Facts are unfolded as the logic unfolds them, all the way to open predicates, keeping the tree.
 * Three things are read off it, in one traversal:
 *
 *   constraints  the leaves the construction model can read (CONSTRAINT_RELATIONS): what the planner
 *                builds from. `circle a b c` arrives as its definition, `eq-lines a b a c`.
 *   depicted     on each path from a written fact, the first node the figure draws
 *                (DEPICTED_RELATIONS): a circle node is drawn as a circle, and what it unfolds to is
 *                not drawn again. Where unfolding stops is the logic's business, not the drawing's.
 *   unread       leaves the model cannot read (`eq-point`, `triangle`, a user's open predicate, a
 *                fact with the wrong number of points): reported, not silently dropped.
 *
 * What each relation is to the figure comes from one table, relations.ts.
 */

import { KnowledgeBase, unfoldTree, type GroundPredicate, type UnfoldNode } from '../kb/inference'
import { FreshNames } from '../kb/names'
import { RELATIONS, relationOf } from './relations'

/** Relations the construction model reads as constraints (relations.ts: those with a `read`). */
export const CONSTRAINT_RELATIONS: ReadonlySet<string> = new Set([...RELATIONS.values()].filter(r => r.read).map(r => r.name))

/** Relations the figure draws as themselves. `circle` is defined (equal radii) but drawn as a circle. */
export const DEPICTED_RELATIONS: ReadonlySet<string> = new Set([...RELATIONS.values()].filter(r => r.depicted).map(r => r.name))

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

export interface ExtractOptions {
  /** Auxiliary names, shared with another extraction that must not reuse them (a lemma's head). */
  fresh?: FreshNames
}

/** Unfold facts and read off their constraints, what to draw, and what the drawing cannot read. */
export function extract(kb: KnowledgeBase, facts: readonly GroundPredicate[], options: ExtractOptions = {}): Extraction {
  const sets = { constraints: new Map<string, DrawableFact>(), depicted: new Map<string, DrawableFact>(), unread: new Map<string, DrawableFact>() }
  const add = (into: Map<string, DrawableFact>, n: UnfoldNode) => {
    const key = `${n.fact.name}(${n.fact.args.join(',')})`
    // A fact reached twice keeps its shallowest depth.
    into.set(key, { ...n.fact, depth: Math.min(n.depth, into.get(key)?.depth ?? Infinity) })
  }
  const walk = (n: UnfoldNode, drawn: boolean) => {
    const relation = relationOf(n.fact)
    if (!drawn && relation?.depicted) { add(sets.depicted, n); drawn = true }
    if (n.children) { n.children.forEach(c => walk(c, drawn)); return }
    if (relation?.read) add(sets.constraints, n)
    else if (n.fact.name !== 'false') add(sets.unread, n)
  }
  // Shared across facts: two constructions in one drawing must not share auxiliary points.
  const fresh = options.fresh ?? new FreshNames()
  for (const fact of facts) walk(unfoldTree(fact, kb, { fresh }), false)
  return { constraints: [...sets.constraints.values()], depicted: [...sets.depicted.values()], unread: [...sets.unread.values()] }
}
