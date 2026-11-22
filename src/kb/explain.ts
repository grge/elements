/**
 * Proofs from provenance (proof.ts, engine.md *Part 1*): why a fact holds, as the search recorded it.
 * Shared by both engines (saturate.ts's `Saturation`, core.ts's `Core`), each of which answers for its
 * store through `ExplainStore`.
 *
 * - A stored fact: the cause recorded with it (a rule's instance, a solver's combination, or given),
 *   then, if it was recorded under another reading, the same fact read so.
 * - A membership in a class (an equivalence, its flip, or equal points): the shortest path through
 *   recorded unions, signs counted (proof-producing union-find).
 * - A difference or a sum no class gives: the solver's certificate.
 * - A defined fact: an instance of its definition.
 * Every explanation is bounded by time (only what was recorded before what it explains), so it never
 * goes round a cycle; steps that structure gives for nothing are not steps.
 */
import type { Rule } from '../language/parser'
import type { GroundPredicate } from './inference'
import type { Proof, ProofStep } from './proof'

/** A solver's step: its equations and their coefficients, the guards it needed, and the equalities of values it relied on. */
export interface SolverCause { kind: 'solver'; relation: string; equations: GroundPredicate[]; coefficients: number[]; guards: GroundPredicate[]; links: GroundPredicate[] }
/**
 * Why something is in the store. A rule's premises are its body under the match (`premises`), and
 * `solved` has a certificate for each premise a solver answered, taken before the store changed.
 */
export type Cause =
  | { kind: 'given' }
  | { kind: 'rule'; rule: Rule; premises: () => GroundPredicate[]; solved?: Map<number, SolverCause> }
  | SolverCause
export interface Recorded { atom: GroundPredicate; cause: Cause; t: number }
export const GIVEN: Cause = { kind: 'given' }

/** What explaining asks of an engine's store. */
export interface ExplainStore {
  readonly equality: string | null
  holds(f: GroundPredicate): boolean
  /** Two names for one point. */
  samePoint(a: string, b: string): boolean
  /** A defined fact's instance of its definition (the definition's atoms, its own points found), or null. */
  definedInstance(f: GroundPredicate): GroundPredicate[] | null
  isDefined(name: string): boolean
  /** The merges of points recorded, in order. */
  merges(): readonly Recorded[]
  /** The equivalence an atom belongs to (itself, or what it is the flip of), with its block size. */
  equivalenceOf(f: GroundPredicate): { q: string; k: number; flip: boolean } | null
  /** A block's key in an equivalence: two blocks are one class member when their keys are equal. */
  blockKey(q: string, block: readonly string[]): string
  /** The unions recorded in an equivalence, with their signs (1: the two are each other's flip). */
  unions(q: string): readonly (Recorded & { sign: number })[]
  /** For a difference: the solver's step that gives `f`, if its certificate exists. */
  differenceCause(f: GroundPredicate): SolverCause | null
  /** For a sum: likewise. */
  sumCause(f: GroundPredicate): SolverCause | null
  /** The record of a stored fact (under its canonical reading), if any. */
  reasonOf(f: GroundPredicate): Recorded | undefined
  /** The rule as written, for a prepared rule whose body had a definition unfolded. */
  original(rule: Rule): Rule
}

const SEP = '\u0001'
const OBJECT = '__object__'
const key = (f: GroundPredicate) => f.name + SEP + f.args.join(SEP)

type Show = (f: GroundPredicate, T: number, depth?: number) => boolean
type Add = (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => void

/** Explain `goal` from `hypotheses`, by what the store recorded; null if it does not hold or cannot be explained. */
export function explain(store: ExplainStore, goal: GroundPredicate, hypotheses: readonly GroundPredicate[]): Proof | null {
  if (!store.holds(goal)) return null
  const steps: ProofStep[] = []
  const done = new Map<string, number>()
  const given = new Set(hypotheses.map(key))
  const active = new Set<string>()
  const add: Add = (fact, by, premises) => {
    const k = key(fact)
    if (done.has(k) || given.has(k)) return
    done.set(k, steps.length)
    steps.push({ fact, by, premises })
  }
  /** Explain `f` using only what was recorded before time `T`; false if it cannot be. */
  const show: Show = (f, T, depth = 0) => {
    const k = key(f)
    if (given.has(k) || done.has(k) || f.name === OBJECT) return true
    if (depth > 500 || active.has(k)) return false
    active.add(k)
    try { return explainFact(store, f, T, depth, show, add) } finally { active.delete(k) }
  }
  if (!show(goal, Infinity)) return null
  return { goal, hypotheses: [...hypotheses], steps }
}

function explainFact(store: ExplainStore, f: GroundPredicate, T: number, depth: number, show: Show, add: Add): boolean {
  const next = depth + 1
  // An equality of points: a chain of recorded merges.
  if (f.name === store.equality && f.args.length === 2) {
    if (f.args[0] === f.args[1]) return true
    const edges = store.merges().filter(m => m.t < T).map(m => ({ r: m, a: m.atom.args[0], b: m.atom.args[1], sign: 0 }))
    const path = pathBetween(edges, f.args[0], f.args[1], 0)
    return !!path && chainStep(store, f, path, next, show, add)
  }
  // A defined fact: an instance of its definition.
  if (store.isDefined(f.name)) {
    const premises = store.definedInstance(f)
    if (!premises || !premises.every(p => show(p, T, next))) return false
    add(f, { kind: 'definition' }, premises)
    return true
  }
  // An equivalence, or its flip: a chain through recorded unions, signs counted.
  const eq = store.equivalenceOf(f)
  if (eq) {
    const { q, k, flip } = eq
    const k1 = store.blockKey(q, f.args.slice(0, k)), k2 = store.blockKey(q, f.args.slice(k))
    if (k1 === k2 && !flip) return true
    const edges = store.unions(q).filter(u => u.t < T).map(u => ({
      r: u, a: store.blockKey(q, u.atom.args.slice(0, k)), b: store.blockKey(q, u.atom.args.slice(k)), sign: u.sign,
    }))
    const path = pathBetween(edges, k1, k2, flip ? 1 : 0)
    if (path) return chainStep(store, f, path, next, show, add)
    const solved = store.differenceCause(f)
    return !!solved && solverStep(f, solved, T, next, show, add)
  }
  // A stored fact: what recorded it, then (if it was recorded under another reading) the same fact.
  const rec = store.reasonOf(f)
  if (rec && rec.t < T) {
    if (!causeStep(store, rec.atom, rec.cause, rec.t, next, show, add)) return false
    if (key(rec.atom) !== key(f)) return sameStep(store, f, rec.atom, T, next, show, add)
    return true
  }
  const summed = store.sumCause(f)
  return !!summed && solverStep(f, summed, T, next, show, add)
}

/** A step from its recorded cause: a rule's instance, a solver's combination, or given. */
function causeStep(store: ExplainStore, fact: GroundPredicate, cause: Cause, t: number, depth: number, show: Show, add: Add): boolean {
  if (cause.kind === 'given') return true
  if (cause.kind === 'solver') return solverStep(fact, cause, t, depth, show, add)
  const premises = cause.premises()
  const ok = premises.every((p, i) => {
    const solved = cause.solved?.get(i)
    return solved ? solverStep(p, solved, t, depth, show, add) : show(p, t, depth)
  })
  if (!ok) return false
  add(fact, { kind: 'rule', rule: store.original(cause.rule) }, premises)
  return true
}

function solverStep(fact: GroundPredicate, cause: SolverCause, T: number, depth: number, show: Show, add: Add): boolean {
  const premises = [...cause.equations, ...cause.guards, ...cause.links]
  if (!premises.every(p => show(p, T, depth))) return false
  add(fact, { kind: 'solver', relation: cause.relation, coefficients: cause.coefficients }, premises)
  return true
}

/** A fact recorded under another reading (a symmetry, or equal points): the same fact. */
function sameStep(store: ExplainStore, fact: GroundPredicate, recorded: GroundPredicate, T: number, depth: number, show: Show, add: Add): boolean {
  const eqs: GroundPredicate[] = []
  if (store.equality) {
    const names = new Set(recorded.args)
    for (const a of fact.args) if (!names.has(a)) {
      const b = recorded.args.find(x => store.samePoint(x, a))
      if (b !== undefined) eqs.push({ name: store.equality, args: [b, a] })
    }
  }
  if (!eqs.every(p => show(p, T, depth))) return false
  // Read another way only (a symmetry): structure gives it, no step.
  if (eqs.length === 0) return true
  add(fact, { kind: 'same' }, [recorded, ...eqs])
  return true
}

function chainStep(store: ExplainStore, fact: GroundPredicate, path: Recorded[], depth: number, show: Show, add: Add): boolean {
  for (const r of path) if (!causeStep(store, r.atom, r.cause, r.t, depth, show, add)) return false
  // One link is the fact itself, perhaps read another way: structure gives it, no step.
  if (path.length === 1) return true
  add(fact, { kind: 'chain' }, path.map(r => r.atom))
  return true
}

/** The shortest path of recorded edges from `from` to `to` whose signs add up to `parity`. */
function pathBetween(edges: { r: Recorded; a: string; b: string; sign: number }[], from: string, to: string, parity: number): Recorded[] | null {
  const adj = new Map<string, { r: Recorded; to: string; sign: number }[]>()
  for (const x of edges) {
    if (!adj.has(x.a)) adj.set(x.a, [])
    if (!adj.has(x.b)) adj.set(x.b, [])
    adj.get(x.a)!.push({ r: x.r, to: x.b, sign: x.sign }); adj.get(x.b)!.push({ r: x.r, to: x.a, sign: x.sign })
  }
  const at = (k: string, p: number) => k + '|' + p
  const back = new Map<string, { r: Recorded; from: string } | null>([[at(from, 0), null]])
  const queue: [string, number][] = [[from, 0]]
  while (queue.length) {
    const [k, p] = queue.shift()!
    if (k === to && p === parity) break
    for (const n of adj.get(k) ?? []) {
      const s = at(n.to, p ^ n.sign)
      if (!back.has(s)) { back.set(s, { r: n.r, from: at(k, p) }); queue.push([n.to, p ^ n.sign]) }
    }
  }
  const goal = at(to, parity)
  if (!back.has(goal) || (from === to && parity === 0)) return from === to && parity === 0 ? [] : null
  const out: Recorded[] = []
  for (let s = goal; back.get(s); s = back.get(s)!.from) out.unshift(back.get(s)!.r)
  return out
}
