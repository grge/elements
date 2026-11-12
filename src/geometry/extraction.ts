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
 * A fact of the unfolding, with its depth: how many definitions were unfolded to reach it. A fact
 * written on the page is 0; the circles of an `eq-triangle` written there are 1; those of an
 * `eq-triangle` inside another construction are 2. The figure draws deeper facts fainter. `origin` is
 * the index of the written fact it was unfolded from (where it came from, for the page to say).
 */
export type DrawableFact = GroundPredicate & { depth: number; origin?: number }

export interface Extraction {
  /** What the planner builds from: the leaves the geometric model reads. */
  constraints: DrawableFact[]
  /** What the figure draws: the first drawn node on each path from a written fact. */
  depicted: DrawableFact[]
  /** Leaves with no geometric reading. */
  unread: DrawableFact[]
  /**
   * The outline: every node from a written fact down to what is drawn, inclusive (the written facts,
   * the definitions they use, and the drawn facts). What a lemma about a construction can match.
   */
  outline: DrawableFact[]
}

export interface ExtractOptions {
  /** Auxiliary names, shared with another extraction that must not reuse them (a lemma's head). */
  fresh?: FreshNames
}

/** A fact as a key: `circle(a,b,c)`. */
export const factKey = (f: { name: string; args: readonly string[] }) => `${f.name}(${f.args.join(',')})`

/** Unfold facts and read off their constraints, what to draw, and what the drawing cannot read. */
export function extract(kb: KnowledgeBase, facts: readonly GroundPredicate[], options: ExtractOptions = {}): Extraction {
  const sets = {
    constraints: new Map<string, DrawableFact>(), depicted: new Map<string, DrawableFact>(),
    unread: new Map<string, DrawableFact>(), outline: new Map<string, DrawableFact>(),
  }
  let origin = 0
  const add = (into: Map<string, DrawableFact>, n: UnfoldNode) => {
    const key = factKey(n.fact)
    // A fact reached twice keeps its shallowest depth, and where it came from there.
    const seen = into.get(key)
    if (!seen || n.depth < seen.depth) into.set(key, { ...n.fact, depth: n.depth, origin })
  }
  const walk = (n: UnfoldNode, drawn: boolean) => {
    const relation = relationOf(n.fact)
    if (!drawn) add(sets.outline, n)
    if (!drawn && relation?.depicted) { add(sets.depicted, n); drawn = true }
    if (n.children) { n.children.forEach(c => walk(c, drawn)); return }
    if (relation?.read) add(sets.constraints, n)
    else if (n.fact.name !== 'false') add(sets.unread, n)
  }
  // Shared across facts: two constructions in one drawing must not share auxiliary points.
  const fresh = options.fresh ?? new FreshNames()
  facts.forEach((fact, i) => { origin = i; walk(unfoldTree(fact, kb, { fresh }), false) })
  const list = (m: Map<string, DrawableFact>) => [...m.values()]
  return { constraints: list(sets.constraints), depicted: list(sets.depicted), unread: list(sets.unread), outline: list(sets.outline) }
}
