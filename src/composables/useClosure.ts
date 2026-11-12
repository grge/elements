/**
 * Marks merged by the forward closure (geometry/marks.ts), computed in a worker: a figure is drawn at
 * once with the classes its stated and proven equalities give, and its classes merge when the closure
 * answers. The page has a worker of its own, so it never waits behind the contents' thumbnails;
 * answers are cached per knowledge base.
 */

import type { KnowledgeBase, GroundPredicate } from '../kb/inference'
import type { Rule } from '../language/parser'
import type { Extraction } from '../geometry/extraction'
import type { Figure } from '../geometry/figure'
import { closureQueries, mergeByClosure } from '../geometry/marks'
import type { ClosureRequest, ClosureResponse } from '../workers/closureWorker'

export type Lane = 'page' | 'background'
const workers = new Map<Lane, Worker>()
let nextId = 0
const pending = new Map<number, (r: ClosureResponse) => void>()
const answers = new WeakMap<KnowledgeBase, Map<string, Promise<boolean[] | null>>>()

function ask(kb: KnowledgeBase, facts: GroundPredicate[], queries: GroundPredicate[], lane: Lane): Promise<boolean[] | null> {
  let known = answers.get(kb)
  if (!known) answers.set(kb, known = new Map())
  const key = JSON.stringify([facts, queries])
  const hit = known.get(key)
  if (hit) return hit
  let worker = workers.get(lane)
  if (!worker) {
    worker = new Worker(new URL('../workers/closureWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ClosureResponse>) => { pending.get(e.data.requestId)?.(e.data); pending.delete(e.data.requestId) }
    workers.set(lane, worker)
  }
  const requestId = ++nextId
  const answer = new Promise<boolean[] | null>(resolve => {
    pending.set(requestId, r => resolve('holds' in r ? r.holds : null))
  })
  const plain = (f: GroundPredicate) => ({ name: f.name, args: [...f.args] })
  worker.postMessage({ requestId, rules: kb.allRules() as Rule[], facts: facts.map(plain), queries: queries.map(plain) } satisfies ClosureRequest)
  known.set(key, answer)
  return answer
}

/**
 * The figure with its classes of marks merged by the closure of the extraction's facts, or null if
 * there is nothing to merge (or the closure failed). The facts saturated are the leaves and the
 * outline: forward rules fire from definitions' bodies, so a written construction needs its leaves.
 */
export async function mergedMarks(kb: KnowledgeBase, x: Extraction, figure: Figure, lane: Lane = 'page'): Promise<Figure | null> {
  const queries = closureQueries(figure.marks)
  if (!queries.length) return null
  const holds = await ask(kb, [...x.constraints, ...x.outline], queries.map(q => q.fact), lane)
  if (!holds || !holds.some(Boolean)) return null
  return { ...figure, marks: mergeByClosure(figure.marks, queries, holds) }
}
