/**
 * Answers against the forward closure of a figure's facts (run in a worker: workers/closureWorker.ts).
 *
 * The figure takes distinct names for distinct points (the planner keeps them apart, and numeric
 * evidence samples only such figures), so the closure may assume it: `distinct` for each two points
 * (relations.ts `byNames`). Should that contradict the facts (the closure derives `false`), the facts
 * are saturated again without it, so the convention can never make everything derivable.
 */

import { KnowledgeBase, type GroundPredicate } from '../kb/inference'
import { saturate } from '../kb/saturate'
import { RELATIONS } from './relations'

/** What the figure's convention assumes of these points: `distinct` for each two of them. */
export function assumedOf(points: readonly string[]): GroundPredicate[] {
  const out: GroundPredicate[] = []
  for (const r of RELATIONS.values()) {
    if (!r.byNames || r.arity !== 2) continue
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) out.push({ name: r.name, args: [points[i], points[j]] })
  }
  return out
}

export function closureAnswers(kb: KnowledgeBase, facts: readonly GroundPredicate[], queries: readonly GroundPredicate[], assume: readonly GroundPredicate[] = []): boolean[] {
  let sat = saturate(kb, [...facts, ...assume])
  if (assume.length && sat.holds({ name: 'false', args: [] })) sat = saturate(kb, facts)
  return queries.map(q => sat.holds(q))
}
