/**
 * Marks merged by the forward closure (geometry/marks.ts), computed in a worker. While the closure is
 * pending, a figure draws only the classes of marks that cannot change (`settledClasses`), so it never
 * shows an arc it will take back; the rest appear when the answer arrives.
 *
 * Answers are remembered: in memory for the session, and in localStorage across visits (keyed by the
 * rules, the facts and the questions, so an edited knowledge base asks again). The book does not
 * change between visits, so only the first visit waits. The page has a worker of its own, so it never
 * waits behind the contents' thumbnails.
 */

import type { KnowledgeBase, GroundPredicate } from '../kb/inference'
import type { Rule } from '../language/parser'
import { fingerprint } from '../kb/rules'
import type { Extraction } from '../geometry/extraction'
import type { Figure } from '../geometry/figure'
import { closureQueries, mergeByClosure, settledClasses } from '../geometry/marks'
import type { ClosureRequest, ClosureResponse } from '../workers/closureWorker'

export type Lane = 'page' | 'background'
const workers = new Map<Lane, Worker>()
let nextId = 0
const pending = new Map<number, (r: ClosureResponse) => void>()
const asked = new Map<string, Promise<boolean[] | null>>()
const answered = new Map<string, boolean[]>()

const STORE = 'elements.closure.'
const STORE_INDEX = 'elements.closure-index'
const STORE_MAX = 300

const fingerprints = new WeakMap<KnowledgeBase, string>()
function hash(s: string): string {
  let h1 = 2166136261, h2 = 5381
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2, 33) ^ c }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)
}
function keyOf(kb: KnowledgeBase, facts: readonly GroundPredicate[], queries: readonly GroundPredicate[]): string {
  let fp = fingerprints.get(kb)
  if (!fp) fingerprints.set(kb, fp = hash(fingerprint(kb.allRules())))
  const show = (fs: readonly GroundPredicate[]) => fs.map(f => `${f.name}(${f.args.join(',')})`).join(' ')
  return `${fp}.${hash(`${show(facts)}|${show(queries)}`)}`
}

function recall(key: string): boolean[] | undefined {
  const hit = answered.get(key)
  if (hit) return hit
  try {
    const raw = localStorage.getItem(STORE + key)
    if (!raw) return undefined
    const value = JSON.parse(raw) as boolean[]
    answered.set(key, value)
    return value
  } catch { return undefined }
}

function remember(key: string, value: boolean[]) {
  answered.set(key, value)
  try {
    localStorage.setItem(STORE + key, JSON.stringify(value))
    const index = (JSON.parse(localStorage.getItem(STORE_INDEX) ?? '[]') as string[]).filter(k => k !== key)
    index.push(key)
    for (const old of index.splice(0, Math.max(0, index.length - STORE_MAX))) localStorage.removeItem(STORE + old)
    localStorage.setItem(STORE_INDEX, JSON.stringify(index))
  } catch { /* storage full or unavailable: the session cache still holds it */ }
}

function ask(key: string, kb: KnowledgeBase, facts: GroundPredicate[], queries: GroundPredicate[], lane: Lane): Promise<boolean[] | null> {
  const known = recall(key)
  if (known) return Promise.resolve(known)
  const inFlight = asked.get(key)
  if (inFlight) return inFlight
  let worker = workers.get(lane)
  if (!worker) {
    worker = new Worker(new URL('../workers/closureWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ClosureResponse>) => { pending.get(e.data.requestId)?.(e.data); pending.delete(e.data.requestId) }
    workers.set(lane, worker)
  }
  const requestId = ++nextId
  const answer = new Promise<boolean[] | null>(resolve => {
    pending.set(requestId, r => {
      asked.delete(key)
      if ('holds' in r) { remember(key, r.holds); resolve(r.holds) } else resolve(null)
    })
  })
  const plain = (f: GroundPredicate) => ({ name: f.name, args: [...f.args] })
  worker.postMessage({ requestId, rules: kb.allRules() as Rule[], facts: facts.map(plain), queries: queries.map(plain) } satisfies ClosureRequest)
  asked.set(key, answer)
  return answer
}

/** The facts saturated: the leaves and the outline (forward rules fire from definitions' bodies). */
const closureFacts = (x: Extraction) => [...x.constraints, ...x.outline]

/**
 * A figure's marks as far as they are known now: merged, if the closure's answer is remembered;
 * otherwise only the classes that cannot change, with `settled: false` saying the rest are pending.
 */
export function marksNow(kb: KnowledgeBase, x: Extraction, figure: Figure): { figure: Figure; settled: boolean } {
  const queries = closureQueries(figure.marks)
  if (!queries.length) return { figure, settled: true }
  const holds = recall(keyOf(kb, closureFacts(x), queries.map(q => q.fact)))
  if (holds) return { figure: { ...figure, marks: mergeByClosure(figure.marks, queries, holds) }, settled: true }
  return { figure: { ...figure, marks: settledClasses(figure.marks) }, settled: false }
}

/** The figure with its marks merged by the closure, when it answers; the figure unmerged if it fails. */
export async function mergedMarks(kb: KnowledgeBase, x: Extraction, figure: Figure, lane: Lane = 'page'): Promise<Figure> {
  const queries = closureQueries(figure.marks)
  if (!queries.length) return figure
  const facts = closureFacts(x)
  const holds = await ask(keyOf(kb, facts, queries.map(q => q.fact)), kb, facts, queries.map(q => q.fact), lane)
  return holds ? { ...figure, marks: mergeByClosure(figure.marks, queries, holds) } : figure
}
