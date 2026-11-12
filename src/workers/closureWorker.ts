/**
 * Answers questions against the forward closure of a figure's facts, off the main thread: which of
 * these equalities does the engine derive? Used to merge classes of marks (geometry/marks.ts), where
 * saturating a figure can take a second or more.
 */

import type { Rule } from '../language/parser'
import { KnowledgeBase, type GroundPredicate } from '../kb/inference'
import { saturate } from '../kb/saturate'

export interface ClosureRequest { requestId: number; rules: Rule[]; facts: GroundPredicate[]; queries: GroundPredicate[] }
export type ClosureResponse = { requestId: number; holds: boolean[] } | { requestId: number; error: string }

self.onmessage = (event: MessageEvent<ClosureRequest>) => {
  const { requestId, rules, facts, queries } = event.data
  try {
    const sat = saturate(new KnowledgeBase(rules), facts)
    self.postMessage({ requestId, holds: queries.map(q => sat.holds(q)) } satisfies ClosureResponse)
  } catch (error) {
    self.postMessage({ requestId, error: `${error}` } satisfies ClosureResponse)
  }
}
