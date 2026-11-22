/**
 * Saturation: the forward closure of a knowledge base, computed using the structure recognised in its
 * rules (structure.ts). It computes the same facts as the reference `forwardClosure`; it is just faster.
 *
 *   equality      one union-find over objects; substitutable argument positions are stored as class
 *                 representatives, so substitution of equals costs nothing
 *   equivalences  a union-find over canonical argument tuples (e.g. unordered pairs of points)
 *   symmetries    facts stored in a canonical argument order
 *   flips         a relation that is an equivalence with one side's sign reversed (a supplement is an
 *                 equal angle on the other side): kept as signed classes of the equivalence, each
 *                 member with a parity, never as facts of its own
 *
 * Every rule that the structure already implies is skipped (`prepare` proves this rule by rule); every
 * other rule is fired normally against the structured store. So the closure is exactly that of the
 * rules: the structure adds nothing the rules do not entail, and drops nothing they do.
 *
 * Positions that do not admit substitution are stored literally. A variable bound at a substitutable
 * position stands for its whole class ("flexible") and is narrowed to one member when it meets a
 * literal position, or expanded to every member when it is written into one.
 */

import type { Predicate, Rule } from '../language/parser'
import type { GroundPredicate, KnowledgeBase } from './inference'
import { analyseStructure, type Difference, type Equivalence, type Structure, type Sum } from './structure'
import { Lattice, type Vector } from './lattice'
import { ruleSymmetries, type SymmetryBreak } from './symmetry'
import { fingerprint, Lru } from './rules'
import type { Proof, ProofStep } from './proof'

const OBJECT = '__object__'
const key2 = (f: GroundPredicate) => f.name + '\u0001' + f.args.join('\u0001')
const SEP = '\u0001'

/**
 * The default budget of work (`SaturateOptions.maxWork`): what a search may do before it gives up (the
 * checker's, and the marks closure's). Work is in proportion to time, so this, not the budget of
 * derivations, is what binds (the checker's derivations are a distant safety valve). Enough for
 * Pythagoras with whole squares (2.1 million), and a page that runs out gives up in under a minute.
 */
export const MAX_WORK = 3_000_000

interface Binding { v: string; flex: boolean }

/**
 * Why a fact, a union or a merge is in the store (provenance, for proofs: proof.ts). Recorded when
 * something new is asserted; a rule's premises are worked out from its match only then.
 */
type Cause =
  | { kind: 'given' }
  | { kind: 'rule'; rule: Rule; s: Subst; solved?: Map<number, Extract<Cause, { kind: 'solver' }>> }
  | { kind: 'solver'; relation: string; equations: GroundPredicate[]; coefficients: number[]; guards: GroundPredicate[]; links: GroundPredicate[] }
interface Recorded { atom: GroundPredicate; cause: Cause; t: number }
const GIVEN: Cause = { kind: 'given' }
type Subst = Map<string, Binding>

export interface SaturateOptions {
  /** Stop as soon as this goal holds. */
  goal?: GroundPredicate
  /** Budget on derivations, as a safety valve. When it runs out, `exhausted` is set. */
  maxDerivations?: number
  /**
   * Budget on work (`Saturation.work`: partial matches and tuples considered), which is in
   * proportion to time, as derivations are not: with definitions abbreviated, the cheap derivations
   * of defined facts no longer use up a budget of derivations, so it would buy far more search.
   */
  maxWork?: number
  /**
   * Read definitions as abbreviations (the default): a defined predicate's facts are never stored;
   * asking whether one holds asks whether its definition does (`Prepared.defined`). False keeps every
   * clause firing, for the definitions analysis, which decides what is a definition.
   */
  abbreviate?: boolean
  /**
   * The predicates that will be asked about (by default the goal's): rules whose head cannot help
   * derive one of them, `false` or the equality are not fired (`relevant`). A sound cut: what they
   * would derive could only feed rules that are cut too.
   */
  relevant?: readonly string[]
}

export interface Prepared {
  structure: Structure
  /** Rules implied by the structure, and so never fired. */
  redundant: Rule[]
  axioms: Rule[]
  rules: Rule[]
  /**
   * Predicates read as abbreviations, with their definitions. Their clauses never fire (a defined
   * fact only renames what its definition says, and storing it costs matching on every round); a
   * rule that mentions one in its body has it replaced by its definition, the definition's own
   * points becoming new variables; and whether one holds is asked of its definition (`holds`).
   * The meaning is unchanged: only when the work is done.
   */
  defined: Map<string, Rule>
  /** Each rule's own symmetries (symmetry.ts): matches that are images of a lesser one are skipped. */
  breaks: Map<Rule, SymmetryBreak>
  /** The rule as written, for each rule whose body had a definition unfolded (proofs cite the written one). */
  origins?: Map<Rule, Rule>
}

const preparedByKB = new WeakMap<KnowledgeBase, Prepared>()
const preparedByRules = new Lru<Prepared>(16)
const plainByKB = new WeakMap<KnowledgeBase, Prepared>()
const plainByRules = new Lru<Prepared>(16)

let freshVariable = 0

/**
 * Atoms with every defined predicate replaced by its definition, recursively (definitions are not
 * recursive). The definition's head variables take the atom's arguments; its body-only variables
 * become new variables (`?1`, which no name can be), so they are found by matching: some point such
 * that…
 */
export function expandDefined(atoms: readonly Predicate[], defined: ReadonlyMap<string, Rule>): Predicate[] {
  return atoms.flatMap(atom => {
    const d = defined.get(atom.name)
    if (!d || d.head.args.length !== atom.args.length) return [atom]
    const sub = new Map(d.head.args.map((v, i) => [v, atom.args[i]]))
    const body = d.body.map(b => ({
      name: b.name,
      args: b.args.map(v => sub.get(v) ?? (sub.set(v, `?${++freshVariable}`), sub.get(v)!)),
    }))
    return expandDefined(body, defined)
  })
}

/** Recognise the structure of a knowledge base's rules and work out which rules it makes redundant. */
export function prepare(kb: KnowledgeBase, abbreviate = true): Prepared {
  const [byKB, byRules] = abbreviate ? [preparedByKB, preparedByRules] : [plainByKB, plainByRules]
  const hit = byKB.get(kb)
  if (hit) return hit
  const key = fingerprint(kb.allRules())
  const shared = byRules.get(key)
  if (shared) { byKB.set(kb, shared); return shared }
  const structure = analyseStructure(kb.allRules())
  const redundant = kb.allRules().filter(r => impliedByStructure(r, structure))
  const skip = new Set(redundant)
  // Abbreviated: predicates with a definition, whose head is plain variables, other than the
  // equality and recognised equivalences, which the store keeps in its own way.
  const defined = new Map<string, Rule>()
  if (abbreviate) {
    for (const [name, status] of kb.definitions()) {
      if (status.kind !== 'definition' || name === 'false' || name === structure.equality || structure.equivalences.has(name)) continue
      if (new Set(status.clause.head.args).size !== status.clause.head.args.length) continue
      defined.set(name, status.clause)
    }
  }
  // A difference's faithful rule is implemented by its solver, not fired (structure.ts, `Difference`).
  for (const d of structure.differences.values()) if (d.faithful) skip.add(d.faithful)
  const origins = new Map<Rule, Rule>()
  const live = kb.allRules()
    .filter(r => !skip.has(r) && !defined.has(r.head.name))
    .map(r => {
      if (!r.body.some(b => defined.has(b.name))) return r
      const x = { ...r, body: expandDefined(r.body, defined) }
      origins.set(x, r)
      return x
    })
  const breaks = new Map<Rule, SymmetryBreak>()
  for (const r of live) { const b = ruleSymmetries(r, structure); if (b) breaks.set(r, b) }
  const out: Prepared = {
    structure,
    redundant,
    axioms: live.filter(r => r.body.length === 0),
    rules: live.filter(r => r.body.length > 0),
    defined,
    breaks,
    origins,
  }
  byKB.set(kb, out)
  byRules.set(key, out)
  return out
}

/** Does the structure alone derive the rule's head from its body (on fresh constants)? */
function impliedByStructure(rule: Rule, structure: Structure): boolean {
  const sat = new Saturation({ structure, redundant: [], axioms: [], rules: [], defined: new Map(), breaks: new Map() })
  for (const b of rule.body) sat.assert({ name: b.name, args: b.args })
  sat.assert({ name: OBJECT, args: rule.head.args })
  return sat.holds({ name: rule.head.name, args: rule.head.args })
}

/**
 * A tuple's images under a group, memoised per group: the same tuples are matched over and over, and
 * computing their images was the largest single cost of a search. The images are shared: callers
 * must not change them.
 */
const orbits = new WeakMap<number[][], Map<string, string[][]>>()

function orbit(group: number[][], args: readonly string[]): string[][] {
  return orbitByKey(group, args.join(SEP), args)
}

/** The orbit of the tuple whose key (its points joined) is `key`. */
function orbitByKey(group: number[][], key: string, args?: readonly string[]): string[][] {
  let memo = orbits.get(group)
  if (!memo) orbits.set(group, memo = new Map())
  let out = memo.get(key)
  if (!out) {
    out = orbitOf(group, args ?? key.split(SEP))
    if (memo.size > 200_000) memo.clear()
    memo.set(key, out)
  }
  return out
}

function orbitOf(group: number[][], args: readonly string[]): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const perm of group) {
    const img = perm.map(i => args[i])
    const key = img.join(SEP)
    if (!seen.has(key)) { seen.add(key); out.push(img) }
  }
  return out
}

/** The least image of a tuple under a group (its canonical form), memoised as orbits are. */
const minima = new WeakMap<number[][], Map<string, string[]>>()

function orbitMin(group: number[][], args: readonly string[]): string[] {
  let memo = minima.get(group)
  if (!memo) minima.set(group, memo = new Map())
  const key = args.join(SEP)
  let out = memo.get(key)
  if (!out) {
    out = orbitMinOf(group, args)
    if (memo.size > 200_000) memo.clear()
    memo.set(key, out)
  }
  return [...out]
}

function orbitMinOf(group: number[][], args: readonly string[]): string[] {
  let best: string[] = [...args]
  let bestKey = best.join(SEP)
  for (const perm of group) {
    const img = perm.map(i => args[i])
    const key = img.join(SEP)
    if (key < bestKey) { best = img; bestKey = key }
  }
  return best
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>((acc, list) => acc.flatMap(prefix => list.map(x => [...prefix, x])), [[]])
}

/**
 * A block equivalence's classes. For an equivalence with a flip (structure.ts, `Flip`), each key's
 * parity relative to its parent (`par`, absent for 0), and the classes some member of which is its
 * own flip (`odd`: an angle equal to its own supplement), where every two members are both.
 */
interface TupleClasses { parent: Map<string, string>; members: Map<string, Set<string>>; par?: Map<string, number>; odd?: Set<string> }

export class Saturation {
  private readonly st: Structure
  private readonly eq: string | null

  // objects and the equality
  private parent = new Map<string, string>()
  private names = new Set<string>()
  private reps = new Set<string>()
  private classes = new Map<string, Set<string>>()

  // block equivalences
  private tuples = new Map<string, TupleClasses>()

  // all other relations, canonical
  private facts = new Map<string, GroundPredicate>()
  private byName = new Map<string, GroundPredicate[]>()

  private version = 0
  /** Per stored relation, (position, value) to the images of its facts: a bound argument is a lookup. */
  private index = new Map<string, Map<string, string[][]>>()
  /** Per equivalence, (position in a block, value) to the keys whose images have that value there. */
  private tupleIndex = new Map<string, Map<string, string[]>>()
  /** Equivalences that have a flip: their classes are signed. */
  private signed = new Set<string>()
  // provenance: what made each stored fact, each union of tuples (with its sign) and each merge of points
  private cause: Cause = GIVEN
  private clock = 0
  private reasons = new Map<string, Recorded>()
  private unions = new Map<string, (Recorded & { sign: number })[]>()
  private merges: Recorded[] = []
  /** Prepared rules are copies where a definition was unfolded in a body: the rule as written. */
  private original = (r: Rule) => this.prep.origins?.get(r) ?? r

  /** While a rule is matched: its head, if the early head check applies to it (`headCheckable`). */
  private head: { rule: Rule; vars: string[]; literal: Set<string> } | null = null
  private derivations = 0
  /** Partial matches considered: the search's work, deterministic and in proportion to its time. */
  work = 0
  private lastRun = new Map<Rule, number>()
  exhausted = false

  constructor(private readonly prep: Prepared, private opts: SaturateOptions = {}) {
    this.st = prep.structure
    this.eq = prep.structure.equality
    for (const f of this.st.flips?.values() ?? []) this.signed.add(f.of)
  }

  // ───────────────────────── objects ─────────────────────────

  private find(x: string): string {
    let r = x
    for (let p = this.parent.get(r); p !== undefined && p !== r; p = this.parent.get(r)) r = p
    return r
  }

  private members(rep: string): Iterable<string> {
    return this.classes.get(rep) ?? [rep]
  }

  private introduce(names: readonly string[]): boolean {
    let fresh = false
    for (const n of names) {
      if (this.names.has(n)) continue
      this.names.add(n)
      if (this.find(n) === n) this.reps.add(n)
      fresh = true
    }
    if (fresh) this.version++
    return fresh
  }

  private mergeObjects(a: string, b: string): boolean {
    const ra = this.find(a), rb = this.find(b)
    if (ra === rb) return false
    const [win, lose] = ra < rb ? [ra, rb] : [rb, ra]
    this.parent.set(lose, win)
    const merged = new Set([...this.members(win), ...this.members(lose)])
    this.classes.set(win, merged)
    this.classes.delete(lose)
    this.reps.delete(lose)
    this.renormalise()
    return true
  }

  /** After a merge, rewrite every stored fact and tuple over the new representatives. */
  private renormalise(): void {
    const old = [...this.facts.values()]
    const reasons = this.reasons
    this.facts = new Map()
    this.byName = new Map()
    this.index = new Map()
    this.tupleIndex = new Map()
    this.reasons = new Map()
    for (const f of old) {
      const args = this.canonArgs(f.name, f.args)
      this.store(f.name, args)
      const r = reasons.get(this.factKey(f.name, f.args)), key = this.factKey(f.name, args), prev = this.reasons.get(key)
      if (r && (!prev || r.t < prev.t)) this.reasons.set(key, r)
    }

    for (const [p, classes] of this.tuples) {
      const e = this.st.equivalences.get(p)!
      const fresh: TupleClasses = { parent: new Map(), members: new Map() }
      this.tuples.set(p, fresh)
      const remap = (key: string) => this.tupleKey(p, e, key.split(SEP))
      for (const [key] of classes.parent) {
        this.unionTuples(p, remap(key), remap(this.rootIn(classes.parent, key)), this.parityOf(classes, key))
      }
      for (const r of classes.odd ?? []) this.unionTuples(p, remap(r), remap(r), 1)
    }
    this.version++
  }

  // ───────────────────────── canonical forms ─────────────────────────

  private maskOf(p: string, n: number): boolean[] {
    const m = this.st.congruent.get(p)
    return m && m.length === n ? m : Array(n).fill(false)
  }

  private canonArgs(p: string, args: readonly string[]): string[] {
    const mask = this.maskOf(p, args.length)
    const out = args.map((a, i) => mask[i] ? this.find(a) : a)
    const group = this.st.symmetries.get(p)
    return group && group[0].length === out.length ? orbitMin(group, out) : out
  }

  private factKey(p: string, args: readonly string[]): string {
    return p + SEP + args.join(SEP)
  }

  private store(p: string, args: string[]): boolean {
    const key = this.factKey(p, args)
    if (this.facts.has(key)) return false
    const f = { name: p, args }
    this.facts.set(key, f)
    let list = this.byName.get(p)
    if (!list) this.byName.set(p, list = [])
    list.push(f)
    let ix = this.index.get(p)
    if (!ix) this.index.set(p, ix = new Map())
    const group = this.st.symmetries.get(p)
    for (const img of group ? orbit(group, args) : [args]) {
      for (let i = 0; i < img.length; i++) {
        const k = i + SEP + img[i]
        let l = ix.get(k)
        if (!l) ix.set(k, l = [])
        l.push(img)
      }
    }
    return true
  }

  // ───────────────────────── block equivalences ─────────────────────────

  private tupleKey(p: string, e: Equivalence, tuple: readonly string[]): string {
    const substitutable = this.maskOf(p, 2 * e.k)[0]
    const t = tuple.map(a => substitutable ? this.find(a) : a)
    return orbitMin(e.blockGroup, t).join(SEP)
  }

  private rootIn(parent: Map<string, string>, k: string): string {
    let r = k
    for (let p = parent.get(r); p !== undefined && p !== r; p = parent.get(r)) r = p
    return r
  }

  private classesOf(p: string): TupleClasses {
    let c = this.tuples.get(p)
    if (!c) this.tuples.set(p, c = { parent: new Map(), members: new Map() })
    return c
  }

  private tupleRoot(p: string, key: string): string {
    return this.rootIn(this.classesOf(p).parent, key)
  }

  /** A key's parity relative to its class's root: 0 unless the classes are signed. */
  private parityOf(c: TupleClasses, k: string): number {
    if (!c.par) return 0
    let x = 0
    for (let r = k, up = c.parent.get(r); up !== undefined && up !== r; r = up, up = c.parent.get(r)) x ^= c.par.get(r) ?? 0
    return x
  }

  /** Index a key newly mentioned in an equivalence's classes, by each value of each of its images. */
  private indexTuple(p: string, key: string): void {
    const e = this.st.equivalences.get(p)!
    let ix = this.tupleIndex.get(p)
    if (!ix) this.tupleIndex.set(p, ix = new Map())
    for (const img of orbitByKey(e.blockGroup, key)) for (let j = 0; j < img.length; j++) {
      const k = j + SEP + img[j]
      let l = ix.get(k)
      if (!l) ix.set(k, l = [])
      if (l[l.length - 1] !== key) l.push(key)
    }
  }

  /**
   * Join the classes of two keys; `sign` 1 says they are each other's flip (supplements) rather than
   * equal. In a signed class, a sign that contradicts the parities makes the class odd: every two of
   * its members are then both equal and flipped (structure.ts, `Flip`).
   */
  private unionTuples(p: string, k1: string, k2: string, sign = 0): boolean {
    const c = this.classesOf(p)
    const r1 = this.rootIn(c.parent, k1), r2 = this.rootIn(c.parent, k2)
    if (this.signed.has(p)) {
      c.par ??= new Map(); c.odd ??= new Set()
      if (r1 === r2) {
        if ((this.parityOf(c, k1) ^ this.parityOf(c, k2)) === sign || c.odd.has(r1)) return false
        if (!c.parent.has(k1)) { this.indexTuple(p, k1); c.parent.set(k1, k1) }
        c.odd.add(r1)
        return true
      }
    } else if (r1 === r2) return false
    if (!c.parent.has(k1)) this.indexTuple(p, k1)
    if (!c.parent.has(k2) && k2 !== k1) this.indexTuple(p, k2)
    const [win, lose] = r1 < r2 ? [r1, r2] : [r2, r1]
    if (c.par) {
      c.par.set(lose, this.parityOf(c, k1) ^ this.parityOf(c, k2) ^ sign)
      if (c.odd!.has(lose)) { c.odd!.delete(lose); c.odd!.add(win) }
    }
    const wm = c.members.get(win) ?? new Set([win])
    for (const m of c.members.get(lose) ?? [lose]) wm.add(m)
    c.members.set(win, wm)
    c.members.delete(lose)
    c.parent.set(lose, win)
    if (!c.parent.has(win)) c.parent.set(win, win)
    return true
  }

  // ───────────────────────── asserting and querying ─────────────────────────

  /** Assert a ground fact. Returns true if anything changed. */
  assert(f: GroundPredicate): boolean {
    this.derivations++
    if (f.name === OBJECT) return this.introduce(f.args)
    // A rule's certificates for the premises a solver answered, taken before this fact changes anything.
    this.certified(this.cause)
    let changed = this.introduce(f.args)
    const flip = this.st.flips?.get(f.name)
    const e = this.st.equivalences.get(f.name)
    if (flip && f.args.length === 2 * this.st.equivalences.get(flip.of)!.k) {
      const q = flip.of, qe = this.st.equivalences.get(q)!
      const u = this.unionTuples(q, this.tupleKey(q, qe, f.args.slice(0, qe.k)), this.tupleKey(q, qe, f.args.slice(qe.k)), 1)
      if (u) this.recordUnion(q, f, 1)
      changed = u || changed
    } else if (f.name === this.eq && f.args.length === 2) {
      const m = this.mergeObjects(f.args[0], f.args[1])
      if (m) this.merges.push({ atom: f, cause: this.certified(this.cause), t: ++this.clock })
      changed = m || changed
    } else if (e && f.args.length === 2 * e.k) {
      // A difference's pair of one point has no value (a line or a segment of one point): a fact naming
      // one says nothing, and kept it would be equal to everything, gluing every class together. So it
      // is not kept. (Turns' rules were once unsound this way; ratios' degenerate betweens were too.)
      if (this.st.differences.has(f.name) && this.degeneratePair(f.args)) return changed
      const k1 = this.tupleKey(f.name, e, f.args.slice(0, e.k))
      const k2 = this.tupleKey(f.name, e, f.args.slice(e.k))
      const u = this.unionTuples(f.name, k1, k2)
      if (u) this.recordUnion(f.name, f, 0)
      changed = u || changed
    } else {
      const args = this.canonArgs(f.name, f.args)
      const st = this.store(f.name, args)
      if (st) this.reasons.set(this.factKey(f.name, args), { atom: f, cause: this.certified(this.cause), t: ++this.clock })
      changed = st || changed
    }
    if (changed) this.version++
    return changed
  }

  private recordUnion(p: string, atom: GroundPredicate, sign: number): void {
    let l = this.unions.get(p)
    if (!l) this.unions.set(p, l = [])
    l.push({ atom, cause: this.certified(this.cause), t: ++this.clock, sign })
  }

  /**
   * A rule's cause, with a certificate for each premise a solver answered (a difference's atom whose
   * blocks no class joins), taken now: later, the solver's equations may include facts that came after.
   */
  private certified(cause: Cause): Cause {
    if (cause.kind !== 'rule' || cause.solved) return cause
    const solved = new Map<number, Extract<Cause, { kind: 'solver' }>>()
    cause.rule.body.forEach((b, i) => {
      const d = this.st.differences.get(b.name), e = this.st.equivalences.get(b.name)
      if (!d || !e || b.args.length !== 2 * e.k) return
      const args = b.args.map(a => cause.s.get(a)!.v)
      if (this.tupleRoot(b.name, this.tupleKey(b.name, e, args.slice(0, e.k))) === this.tupleRoot(b.name, this.tupleKey(b.name, e, args.slice(e.k)))) return
      const cached = this.latticeFor(b.name, d)
      const v: Vector = new Map()
      if (!this.blockVector(d, cached.unknown, args.slice(0, e.k), 1, v) || !this.blockVector(d, cached.unknown, args.slice(e.k), -1, v)) return
      const cert = cached.lattice.certificate(v)
      if (cert) solved.set(i, this.solverCause(b.name, cert, cached.atoms, [], { name: b.name, args }) as Extract<Cause, { kind: 'solver' }>)
    })
    cause.solved = solved
    return cause
  }

  /** Does a difference's fact name a pair of one point? */
  private degeneratePair(args: readonly string[]): boolean {
    for (let i = 0; i < args.length; i += 2) if (this.find(args[i]) === this.find(args[i + 1])) return true
    return false
  }

  holds(f: GroundPredicate): boolean {
    if (f.name === OBJECT) return f.args.every(a => this.names.has(a))
    if (this.prep.defined.has(f.name)) return this.holdsDefined(f)
    if (f.name === this.eq && f.args.length === 2) return this.find(f.args[0]) === this.find(f.args[1])
    const flip = this.st.flips?.get(f.name)
    const q = flip ? flip.of : f.name
    if (this.signed.has(q)) {
      const qe = this.st.equivalences.get(q)!
      if (f.args.length !== 2 * qe.k) return false
      const c = this.classesOf(q)
      const k1 = this.tupleKey(q, qe, f.args.slice(0, qe.k)), k2 = this.tupleKey(q, qe, f.args.slice(qe.k))
      const r = this.rootIn(c.parent, k1)
      if (r !== this.rootIn(c.parent, k2)) return false
      return !!c.odd?.has(r) || (this.parityOf(c, k1) ^ this.parityOf(c, k2)) === (flip ? 1 : 0)
    }
    const e = this.st.equivalences.get(f.name)
    if (e && f.args.length === 2 * e.k) {
      if (this.tupleRoot(f.name, this.tupleKey(f.name, e, f.args.slice(0, e.k)))
        === this.tupleRoot(f.name, this.tupleKey(f.name, e, f.args.slice(e.k)))) return true
      const d = this.st.differences.get(f.name)
      return d ? this.differenceHolds(f.name, e, d, f.args) : false
    }
    if (this.facts.has(this.factKey(f.name, this.canonArgs(f.name, f.args)))) return true
    const sum = this.st.sums.get(f.name)
    return sum && f.args.length === 6 ? this.sumHolds(f.name, sum, f.args) : false
  }

  // ───────────────────────── sums: a solver ─────────────────────────

  private sumLattices = new Map<string, { version: number; lattice: Lattice; unknown: Map<string, number>; pairOf: Map<string, [string, string]>; atoms: GroundPredicate[] }>()

  /** A pair's value as an unknown's key: its class under the values' equivalence; null for one point (no length: value nothing). */
  private sumValue(sum: Sum, a: string, b: string): string | null {
    if (this.find(a) === this.find(b)) return null
    const q = this.st.equivalences.get(sum.values)!
    return this.tupleRoot(sum.values, this.tupleKey(sum.values, q, [a, b]))
  }

  /** value(a b) + value(c d) - value(e f), as a vector (a pair of one point adds nothing). */
  private sumVector(sum: Sum, unknown: Map<string, number>, pairOf: Map<string, [string, string]> | null, args: readonly string[]): Vector {
    const v: Vector = new Map()
    ;[1, 1, -1].forEach((c, i) => {
      const [a, b] = [args[2 * i], args[2 * i + 1]]
      const key = this.sumValue(sum, a, b)
      if (key === null) return
      let k = unknown.get(key)
      if (k === undefined) { unknown.set(key, k = unknown.size); pairOf?.set(key, [a, b]) }
      const x = (v.get(k) ?? 0) + c
      if (x === 0) v.delete(k)
      else v.set(k, x)
    })
    return v
  }

  /** A sum relation's facts as a lattice of equations, at the store's current version. */
  private sumLattice(p: string, sum: Sum) {
    let cached = this.sumLattices.get(p)
    if (!cached || cached.version !== this.version) {
      const lattice = new Lattice(), unknown = new Map<string, number>(), pairOf = new Map<string, [string, string]>()
      const atoms: GroundPredicate[] = []
      for (const f of this.byName.get(p) ?? []) { lattice.add(this.sumVector(sum, unknown, pairOf, f.args)); atoms.push(f) }
      this.sumLattices.set(p, cached = { version: this.version, lattice, unknown, pairOf, atoms })
    }
    return cached
  }

  /** Does a sum follow, by adding and subtracting the known ones (integer combinations: sound in any group)? */
  private sumHolds(p: string, sum: Sum, args: readonly string[]): boolean {
    return this.answered(p + SEP + args.join(SEP), () => this.sumHoldsNow(p, sum, args))
  }

  private sumHoldsNow(p: string, sum: Sum, args: readonly string[]): boolean {
    const cached = this.sumLattice(p, sum)
    return cached.lattice.contains(this.sumVector(sum, new Map(cached.unknown), null, args))
  }

  /**
   * For each sum relation: pairs the solver shows to have one value are asserted equivalent under its
   * values' equivalence (equal quadrances, equal lengths). The parts determine the whole is one of the
   * rules the sum was recognised by; the solver takes it further, through values no pair has (as the
   * turns' solver does). True if anything changed.
   */
  private feedBackSums(): boolean {
    let changed = false
    for (const [p, sum] of this.st.sums) {
      if (!this.byName.get(p)?.length) continue
      const cached = this.sumLattice(p, sum)
      const keys = [...cached.unknown.keys()]
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        if (this.sumValue(sum, ...cached.pairOf.get(keys[i])!) === this.sumValue(sum, ...cached.pairOf.get(keys[j])!)) continue
        const v: Vector = new Map([[cached.unknown.get(keys[i])!, 1], [cached.unknown.get(keys[j])!, -1]])
        const cert = cached.lattice.certificate(v)
        if (!cert) continue
        this.cause = this.solverCause(p, cert, cached.atoms, [])
        changed = this.assert({ name: sum.values, args: [...cached.pairOf.get(keys[i])!, ...cached.pairOf.get(keys[j])!] }) || changed
        this.cause = GIVEN
      }
    }
    return changed
  }

  // ───────────────────────── differences: a solver ─────────────────────────

  /** Per difference relation: its equations as a lattice, built at a version of the store. */
  private lattices = new Map<string, { version: number; lattice: Lattice; unknown: Map<string, number>; atoms: GroundPredicate[] }>()

  /** The value of a pair, as an unknown's key: its class under the pairs' equivalence. Null for a pair of one point. */
  private pairValue(d: Difference, a: string, b: string): string | null {
    if (this.find(a) === this.find(b)) return null
    const q = d.pairs ? this.st.equivalences.get(d.pairs) : undefined
    if (d.pairs && q) return this.tupleRoot(d.pairs, this.tupleKey(d.pairs, q, [a, b]))
    const [x, y] = [this.find(a), this.find(b)]
    return x < y ? `${x}${SEP}${y}` : `${y}${SEP}${x}`
  }

  /** A block a b c d as an equation's side: value(c d) - value(a b). Null if a pair is one point. */
  private blockVector(d: Difference, unknown: Map<string, number>, block: readonly string[], sign: number, into: Vector): boolean {
    const from = this.pairValue(d, block[0], block[1]), to = this.pairValue(d, block[2], block[3])
    if (from === null || to === null) return false
    for (const [key, c] of [[to, sign], [from, -sign]] as const) {
      let i = unknown.get(key)
      if (i === undefined) unknown.set(key, i = unknown.size)
      const x = (into.get(i) ?? 0) + c
      if (x === 0) into.delete(i)
      else into.set(i, x)
    }
    return true
  }

  /**
   * Does a difference follow by adding and subtracting the known ones (structure.ts, `Difference`)?
   * Every class of the relation says its members are equal: each member minus the first is an
   * equation, and the question is whether the asked one is an integer combination of them. The
   * solver sees values no pair of the figure has (the sum of two turns); that is the step it adds to
   * the rules, deliberately.
   */
  /** The solvers' answers, at a version of the store: the same atom is asked again and again in joins. */
  private answers = { version: -1, map: new Map<string, boolean>() }
  private answered(key: string, compute: () => boolean): boolean {
    if (this.answers.version !== this.version) this.answers = { version: this.version, map: new Map() }
    let v = this.answers.map.get(key)
    if (v === undefined) this.answers.map.set(key, v = compute())
    return v
  }

  private differenceHolds(p: string, e: Equivalence, d: Difference, args: readonly string[]): boolean {
    return this.answered(p + SEP + args.join(SEP), () => this.differenceHoldsNow(p, e, d, args))
  }

  private differenceHoldsNow(p: string, e: Equivalence, d: Difference, args: readonly string[]): boolean {
    const cached = this.latticeFor(p, d)
    const v: Vector = new Map()
    if (!this.blockVector(d, cached.unknown, args.slice(0, e.k), 1, v) || !this.blockVector(d, cached.unknown, args.slice(e.k), -1, v)) return false
    return cached.lattice.contains(v)
  }

  /** A difference relation's equations as a lattice, at the store's current version. */
  private latticeFor(p: string, d: Difference): { version: number; lattice: Lattice; unknown: Map<string, number>; atoms: GroundPredicate[] } {
    let cached = this.lattices.get(p)
    if (!cached || cached.version !== this.version) {
      const lattice = new Lattice(), unknown = new Map<string, number>()
      const atoms: GroundPredicate[] = []
      for (const members of this.classesOf(p).members.values()) {
        const blocks = [...members].map(key => key.split(SEP))
        const first = blocks.find(b => this.blockVector(d, unknown, b, 1, new Map()))
        if (!first) continue
        for (const b of blocks) {
          if (b === first) continue
          const v: Vector = new Map()
          if (this.blockVector(d, unknown, b, 1, v) && this.blockVector(d, unknown, first, -1, v)) { lattice.add(v); atoms.push({ name: p, args: [...b, ...first] }) }
        }
      }
      this.lattices.set(p, cached = { version: this.version, lattice, unknown, atoms })
    }
    return cached
  }

  /**
   * Does a defined fact hold: is there an instance of its definition? Its arguments are bound, as
   * if variables of those names had matched them (up to equality), and its definition's own points
   * are searched for.
   */
  private holdsDefined(f: GroundPredicate): boolean {
    const atoms = expandDefined([{ name: f.name, args: [...f.args] }], this.prep.defined)
    const s: Subst = new Map(f.args.map(a => [a, { v: a, flex: true }]))
    // Not a rule's match: no head to check against (and the variables are the definition's own).
    const outer = this.head
    this.head = null
    try { return !this.join(atoms, s).next().done } finally { this.head = outer }
  }

  /**
   * Let the solvers hand back what they now show (equal values, lines that turn by nothing), firing no
   * rule: what a replay asks of a solver's step (proof.ts). True if anything changed.
   */
  settle(): boolean {
    let changed = false
    while (this.feedBackDifferences() || this.feedBackSums()) changed = true
    return changed
  }

  // ───────────────────────── explanation: proofs from provenance ─────────────────────────

  /**
   * A solver's step, taken when it acts: its equations and coefficients, and the equalities of values
   * they rely on as the store has them now (later, the very fact the step gives may have joined them).
   */
  private solverCause(relation: string, cert: Map<number, number>, atoms: GroundPredicate[], guards: GroundPredicate[], fact?: GroundPredicate): Cause {
    const used = [...cert].filter(([, c]) => c !== 0)
    const equations = used.map(([i]) => atoms[i])
    const links = this.valueLinks(relation, fact && fact.name === relation ? [fact, ...equations] : equations)
    return { kind: 'solver', relation, equations, coefficients: used.map(([, c]) => c), guards, links }
  }

  /**
   * Why `goal` holds: a proof (proof.ts) whose steps are each a rule applied, a solver's combination,
   * an equivalence's chain, the same fact read another way, or a definition's instance, every premise
   * a hypothesis or an earlier step. Null if it does not hold.
   */
  explain(goal: GroundPredicate, hypotheses: readonly GroundPredicate[]): Proof | null {
    if (!this.holds(goal)) return null
    const steps: ProofStep[] = []
    const done = new Map<string, number>()   // a fact's key to the time bound it was explained under
    const given = new Set(hypotheses.map(f => f.name + SEP + f.args.join(SEP)))
    const key = (f: GroundPredicate) => f.name + SEP + f.args.join(SEP)
    const active = new Set<string>()

    const add = (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => {
      const k = key(fact)
      if (done.has(k) || given.has(k)) return
      done.set(k, steps.length)
      steps.push({ fact, by, premises })
    }

    /** Explain `f` using only what was recorded before time `T`; false if it cannot be. */
    const show = (f: GroundPredicate, T: number, depth = 0): boolean => {
      const k = key(f)
      if (given.has(k) || done.has(k) || f.name === OBJECT) return true
      if (depth > 500 || active.has(k)) return false
      active.add(k)
      try {
        const ok = this.explainFact(f, T, depth, show, add)
        return ok
      } finally { active.delete(k) }
    }

    if (!show(goal, Infinity)) return null
    return { goal, hypotheses: [...hypotheses], steps }
  }

  private explainFact(
    f: GroundPredicate, T: number, depth: number,
    show: (f: GroundPredicate, T: number, depth?: number) => boolean,
    add: (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => void,
  ): boolean {
    const next = depth + 1
    // An equality of points: a chain of recorded merges.
    if (f.name === this.eq && f.args.length === 2) {
      if (f.args[0] === f.args[1]) return true
      const edges = this.merges.filter(m => m.t < T).map(m => ({ r: m, a: m.atom.args[0], b: m.atom.args[1], sign: 0 }))
      const path = this.pathBetween(edges, f.args[0], f.args[1], 0)
      return !!path && this.chainStep(f, path, next, show, add)
    }
    // A defined fact: an instance of its definition.
    if (this.prep.defined.has(f.name)) {
      const atoms = expandDefined([{ name: f.name, args: [...f.args] }], this.prep.defined)
      const s0: Subst = new Map(f.args.map(a => [a, { v: a, flex: true }]))
      const outer = this.head
      this.head = null
      const m = this.join(atoms, s0).next()
      this.head = outer
      if (m.done) return false
      const premises = atoms.map(a => ({ name: a.name, args: a.args.map(x => m.value.get(x)?.v ?? x) }))
      if (!premises.every(p => show(p, T, next))) return false
      add(f, { kind: 'definition' }, premises)
      return true
    }
    // An equivalence, or its flip: a chain through recorded unions, signs counted.
    const flip = this.st.flips?.get(f.name)
    const q = flip ? flip.of : f.name
    const e = this.st.equivalences.get(q)
    if (e && f.args.length === 2 * e.k) {
      const k1 = this.tupleKey(q, e, f.args.slice(0, e.k)), k2 = this.tupleKey(q, e, f.args.slice(e.k))
      if (k1 === k2 && !flip) return true
      const edges = (this.unions.get(q) ?? []).filter(u => u.t < T).map(u => ({
        r: u, a: this.tupleKey(q, e, u.atom.args.slice(0, e.k)), b: this.tupleKey(q, e, u.atom.args.slice(e.k)), sign: u.sign,
      }))
      const path = this.pathBetween(edges, k1, k2, flip ? 1 : 0)
      if (path) return this.chainStep(f, path, next, show, add)
      const d = this.st.differences.get(q)
      if (d) {
        const cached = this.latticeFor(q, d)
        const v: Vector = new Map()
        if (!this.blockVector(d, cached.unknown, f.args.slice(0, e.k), 1, v) || !this.blockVector(d, cached.unknown, f.args.slice(e.k), -1, v)) return false
        const cert = cached.lattice.certificate(v)
        if (!cert) return false
        return this.solverStep(f, this.solverCause(q, cert, cached.atoms, [], f) as Extract<Cause, { kind: 'solver' }>, T, next, show, add)
      }
      return false
    }
    // A stored fact: what recorded it, then (if it was recorded under another reading) the same fact.
    const k = this.factKey(f.name, this.canonArgs(f.name, f.args))
    const rec = this.reasons.get(k)
    if (rec && rec.t < T) {
      if (!this.causeStep(rec.atom, rec.cause, rec.t, next, show, add)) return false
      if (key2(rec.atom) !== key2(f)) return this.sameStep(f, rec.atom, T, next, show, add)
      return true
    }
    const sum = this.st.sums.get(f.name)
    if (sum && f.args.length === 6) {
      const cached = this.sumLattice(f.name, sum)
      const cert = cached.lattice.certificate(this.sumVector(sum, new Map(cached.unknown), null, f.args))
      if (!cert) return false
      return this.solverStep(f, this.solverCause(f.name, cert, cached.atoms, [], f) as Extract<Cause, { kind: 'solver' }>, T, next, show, add)
    }
    return false
  }

  /** A step from its recorded cause: a rule's instance, a solver's combination, or given. */
  private causeStep(
    fact: GroundPredicate, cause: Cause, t: number, depth: number,
    show: (f: GroundPredicate, T: number, depth?: number) => boolean,
    add: (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => void,
  ): boolean {
    if (cause.kind === 'given') return true
    if (cause.kind === 'solver') return this.solverStep(fact, cause, t, depth, show, add)
    const rule = cause.rule
    const premises = rule.body.map(b => ({ name: b.name, args: b.args.map(a => cause.s.get(a)!.v) }))
    const ok = premises.every((p, i) => {
      const solved = cause.solved?.get(i)
      return solved ? this.solverStep(p, solved, t, depth, show, add) : show(p, t, depth)
    })
    if (!ok) return false
    add(fact, { kind: 'rule', rule: this.original(rule) }, premises)
    return true
  }

  private solverStep(
    fact: GroundPredicate, cause: Extract<Cause, { kind: 'solver' }>, T: number, depth: number,
    show: (f: GroundPredicate, T: number, depth?: number) => boolean,
    add: (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => void,
  ): boolean {
    const premises = [...cause.equations, ...cause.guards, ...cause.links]
    if (!premises.every(p => show(p, T, depth))) return false
    add(fact, { kind: 'solver', relation: cause.relation, coefficients: cause.coefficients }, premises)
    return true
  }

  /**
   * The equalities a solver's equations rely on: pairs it takes for one value (lines that run one way,
   * for turns; equal lengths, for quadrances; equal points, where pairs are points), each linked to the
   * first pair of its value. A replay needs them to add the equations up.
   */
  private valueLinks(relation: string, atoms: readonly GroundPredicate[]): GroundPredicate[] {
    const d = this.st.differences.get(relation), sum = this.st.sums.get(relation)
    const value = d ? (a: string, b: string) => this.pairValue(d, a, b) : sum ? (a: string, b: string) => this.sumValue(sum, a, b) : null
    const eqName = d ? d.pairs : sum ? sum.values : null
    if (!value) return []
    const first = new Map<string, [string, string]>()
    const out: GroundPredicate[] = []
    for (const f of atoms) for (let i = 0; i + 1 < f.args.length; i += 2) {
      const a = f.args[i], b = f.args[i + 1], v = value(a, b)
      if (v === null) continue
      const f0 = first.get(v)
      if (!f0) { first.set(v, [a, b]); continue }
      if (f0[0] === a && f0[1] === b) continue
      if (eqName) out.push({ name: eqName, args: [...f0, a, b] })
      else if (this.eq) for (const [x, y] of [[f0[0], a], [f0[1], b]]) if (x !== y) out.push({ name: this.eq, args: [x, y] })
    }
    return out
  }

  /** A fact recorded under another reading (a symmetry, or equal points): the same fact. */
  private sameStep(
    fact: GroundPredicate, recorded: GroundPredicate, T: number, depth: number,
    show: (f: GroundPredicate, T: number, depth?: number) => boolean,
    add: (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => void,
  ): boolean {
    const eqs: GroundPredicate[] = []
    if (this.eq) {
      const names = new Set(recorded.args)
      for (const a of fact.args) if (!names.has(a)) {
        const b = recorded.args.find(x => this.find(x) === this.find(a))
        if (b !== undefined) eqs.push({ name: this.eq, args: [b, a] })
      }
    }
    if (!eqs.every(p => show(p, T, depth))) return false
    // Read another way only (a symmetry): structure gives it, no step.
    if (eqs.length === 0) return true
    add(fact, { kind: 'same' }, [recorded, ...eqs])
    return true
  }

  private chainStep(
    fact: GroundPredicate, path: Recorded[], depth: number,
    show: (f: GroundPredicate, T: number, depth?: number) => boolean,
    add: (fact: GroundPredicate, by: ProofStep['by'], premises: GroundPredicate[]) => void,
  ): boolean {
    for (const r of path) if (!this.causeStep(r.atom, r.cause, r.t, depth, show, add)) return false
    // One link is the fact itself, perhaps read another way: structure gives it, no step.
    if (path.length === 1) return true
    add(fact, { kind: 'chain' }, path.map(r => r.atom))
    return true
  }

  /** The shortest path of recorded edges from `from` to `to` whose signs add up to `parity`. */
  private pathBetween(edges: { r: Recorded; a: string; b: string; sign: number }[], from: string, to: string, parity: number): Recorded[] | null {
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

  /** Stored relations, plus each object's equality with its representative. */
  allFacts(): GroundPredicate[] {
    const out = [...this.facts.values()]
    if (this.eq) for (const n of this.names) out.push({ name: this.eq, args: [n, this.find(n)] })
    return out
  }

  // ───────────────────────── matching ─────────────────────────

  /** Extend `s` so that `pattern` matches `tuple`, respecting which positions are substitutable. */
  private unifyArgs(s: Subst, pattern: readonly string[], tuple: readonly string[], mask: readonly boolean[]): Subst | null {
    let out: Subst | null = null
    for (let i = 0; i < pattern.length; i++) {
      const x = pattern[i], val = tuple[i]
      const cur = (out ?? s).get(x)
      if (!cur) {
        if (!out) out = new Map(s)
        out.set(x, mask[i] ? { v: this.find(val), flex: true } : { v: val, flex: false })
      } else if (mask[i]) {
        if (this.find(cur.v) !== this.find(val)) return null
      } else if (!cur.flex) {
        if (cur.v !== val) return null
      } else {
        if (this.find(val) !== this.find(cur.v)) return null
        if (!out) out = new Map(s)
        out.set(x, { v: val, flex: false })
      }
    }
    return out ?? s
  }

  private *match(atom: Predicate, s: Subst): Generator<Subst> {
    const { name, args } = atom
    const mask = this.maskOf(name, args.length)

    if (name === this.eq && args.length === 2) {
      const bound = s.get(args[0]) ?? s.get(args[1])
      const candidates = bound ? [this.find(bound.v)] : this.reps
      for (const r of candidates) { const t = this.unifyArgs(s, args, [r, r], mask); if (t) yield t }
      return
    }

    const e = this.st.equivalences.get(name)
    if (e && args.length === 2 * e.k) {
      // A solved relation's atom with every argument bound: whether it holds, solver included.
      if (this.st.differences.has(name) && args.every(a => s.has(a))) {
        if (this.holds({ name, args: args.map(a => s.get(a)!.v) })) yield s
        return
      }
      yield* this.matchEquivalence(name, e, args, s, mask)
      return
    }
    const flip = this.st.flips?.get(name)
    if (flip) {
      const qe = this.st.equivalences.get(flip.of)!
      if (args.length === 2 * qe.k) yield* this.matchEquivalence(flip.of, qe, args, s, this.maskOf(flip.of, args.length), 1)
      return
    }

    // A bound argument (exact, or a class where equals substitute) is a lookup: the fewest images
    // that have its value there.
    let images: string[][] | null = null
    const ix = this.index.get(name)
    for (let i = 0; i < args.length; i++) {
      const b = s.get(args[i])
      if (!b || (!mask[i] && b.flex)) continue
      const l = ix?.get(i + SEP + (mask[i] ? this.find(b.v) : b.v)) ?? []
      if (!images || l.length < images.length) images = l
      if (l.length === 0) return
    }
    if (images) {
      for (const img of images) {
        if (img.length !== args.length) continue
        const t = this.unifyArgs(s, args, img, mask)
        if (t) yield t
      }
      return
    }
    const group = this.st.symmetries.get(name)
    for (const f of this.byName.get(name) ?? []) {
      if (f.args.length !== args.length) continue
      for (const img of group ? orbit(group, f.args) : [f.args]) {
        const t = this.unifyArgs(s, args, img, mask)
        if (t) yield t
      }
    }
  }

  /**
   * Match an atom of an equivalence, or of its flip (`want` 1: members of opposite signs). In a
   * signed class two members match as equal when their parities agree, as flips when they differ,
   * and as both in an odd class.
   */
  private *matchEquivalence(p: string, e: Equivalence, args: readonly string[], s: Subst, mask: boolean[], want = 0): Generator<Subst> {
    const k = e.k
    const cls = this.classesOf(p)
    const imagesOf = (key: string) => orbitByKey(e.blockGroup, key)
    const classMembers = (root: string) => cls.members.get(root) ?? [root]
    const signed = this.signed.has(p)
    const fits = (x: string, y: string) => !signed || !!cls.odd?.has(this.rootIn(cls.parent, x)) || (this.parityOf(cls, x) ^ this.parityOf(cls, y)) === want
    // A block can be looked up directly when all its variables are bound and their values are exact.
    const lookup = (vars: readonly string[]) => {
      const bs = vars.map(v => s.get(v))
      if (bs.some(b => !b) || (!mask[0] && bs.some(b => b!.flex))) return null
      return bs.map(b => b!.v)
    }
    const first = lookup(args.slice(0, k)), second = lookup(args.slice(k))

    if (first || second) {
      const known = (first ?? second)!
      const knownKey = this.tupleKey(p, e, known)
      const root = this.tupleRoot(p, knownKey)
      for (const m of classMembers(root)) {
        if (!fits(knownKey, m)) continue
        for (const img of imagesOf(m)) {
          const t = this.unifyArgs(s, args, first ? [...known, ...img] : [...img, ...known], mask)
          if (t) yield t
        }
      }
      return
    }

    const mentioned = cls.parent
    // An argument bound (exactly, or a class where equals substitute): only the keys whose images
    // have its value there, each with every member of its class (the index of keys).
    let pick: { side: number; j: number; v: string; keys: string[] } | null = null
    const ix = this.tupleIndex.get(p)
    for (let side = 0; side < 2; side++) for (let j = 0; j < k; j++) {
      const b = s.get(args[side * k + j])
      if (!b || (!mask[0] && b.flex)) continue
      const v = mask[0] ? this.find(b.v) : b.v
      const keys = ix?.get(j + SEP + v) ?? []
      if (!pick || keys.length < pick.keys.length) pick = { side, j, v, keys }
    }
    if (pick) {
      for (const m of pick.keys) {
        this.work++
        const xs = imagesOf(m).filter(x => x[pick!.j] === pick!.v)
        if (!xs.length) continue
        for (const mm of classMembers(this.tupleRoot(p, m))) {
          if (!fits(m, mm)) continue
          for (const y of imagesOf(mm)) for (const x of xs) {
            const t = this.unifyArgs(s, args, pick.side === 0 ? [...x, ...y] : [...y, ...x], mask)
            if (t) yield t
          }
        }
      }
    } else {
      // Every class of tuples mentioned.
      const seen = new Set<string>()
      for (const key of mentioned.keys()) {
        this.work++
        const root = this.tupleRoot(p, key)
        if (seen.has(root)) continue
        seen.add(root)
        const ms = [...classMembers(root)]
        for (const m1 of ms) for (const m2 of ms) {
          if (!fits(m1, m2)) continue
          for (const x of imagesOf(m1)) for (const y of imagesOf(m2)) {
            const t = this.unifyArgs(s, args, [...x, ...y], mask)
            if (t) yield t
          }
        }
      }
    }
    // A tuple never mentioned is a class of its own, so it matches only reflexively: both blocks are
    // images of the one tuple. (Never as its own flip: a class where a member is its own flip is
    // mentioned.) Only tuples consistent with what is bound can match: generate them from the block
    // with fewer unbound variables (bound positions fixed, the rest over every point), each paired
    // with its images in the other block.
    if (want === 1) return
    const pool = [...(mask[0] ? this.reps : this.names)]
    const blocks = [args.slice(0, k), args.slice(k)]
    const unbound = (b: readonly string[]) => b.filter(v => !s.has(v)).length
    const from = unbound(blocks[0]) <= unbound(blocks[1]) ? 0 : 1
    const choices = blocks[from].map(v => {
      const b = s.get(v)
      if (!b) return pool
      return mask[0] ? [this.find(b.v)] : b.flex ? [...this.members(this.find(b.v))] : [b.v]
    })
    for (const t of cartesian<string>(choices)) {
      this.work++
      if (mentioned.has(this.tupleKey(p, e, t))) continue
      for (const y of orbit(e.blockGroup, t)) {
        const u = this.unifyArgs(s, args, from === 0 ? [...t, ...y] : [...y, ...t], mask)
        if (u) yield u
      }
    }
  }

  /**
   * Can this partial match still be the least of its family under the rule's symmetries? At the first
   * variable (in the break's order) where it and its image differ, it must be the lesser; undecided
   * while that variable or its image is unbound. Values compared as names: a family's images rename
   * the same values, so its least member is the same however equal points are named.
   */
  private leastSoFar(s: Subst, brk: SymmetryBreak): boolean {
    for (const perm of brk.perms) {
      for (const x of brk.order) {
        const u = s.get(x), v = s.get(perm.get(x) ?? x)
        if (!u || !v) break
        if (u.v === v.v) continue
        if (u.v > v.v) return false
        break
      }
    }
    return true
  }

  private *join(body: readonly Predicate[], s: Subst, brk?: SymmetryBreak): Generator<Subst> {
    this.work++
    if (brk && !this.leastSoFar(s, brk)) return
    if (body.length === 0) { yield s; return }
    // The early head check: once the head is one fact, and the store already has it, nothing this
    // match goes on to find can add anything. Only where the head is one fact: every head variable
    // bound, and none standing for a class where equals do not substitute (there the head is a fact
    // for each member, and one holding says nothing of the others).
    const h = this.head
    if (h && h.vars.every(v => { const b = s.get(v); return b && (!b.flex || !h.literal.has(v)) })) {
      if (this.holds({ name: h.rule.head.name, args: h.rule.head.args.map(a => s.get(a)!.v) })) return
    }
    // Greedy: match the atom with the largest share of already-bound arguments next. An atom of a
    // solved relation (a difference) waits until the others have bound its arguments, if they can:
    // then it is asked of the solver too (`match`), which knows equalities no stored class has.
    let best = 0, bestScore = -Infinity
    for (let i = 0; i < body.length; i++) {
      const bound = body[i].args.filter(a => s.has(a)).length
      let score = bound / Math.max(1, body[i].args.length)
      if (this.st.differences.has(body[i].name) && bound < body[i].args.length) score -= 1
      if (score > bestScore) { best = i; bestScore = score }
    }
    const rest = body.filter((_, i) => i !== best)
    for (const s1 of this.match(body[best], s)) yield* this.join(rest, s1, brk)
  }

  private checkable = new Map<Rule, { rule: Rule; vars: string[]; literal: Set<string> } | null>()
  /**
   * The early head check's view of a rule, or null where it does not apply: a head with a variable
   * the body does not bind (it ranges over every object), or one whose holding is not a lookup (a
   * defined relation, or one a solver answers: there the solver may know more than the store, and
   * asserting it still changes the store).
   */
  private headCheckable(rule: Rule): { rule: Rule; vars: string[]; literal: Set<string> } | null {
    if (this.checkable.has(rule)) return this.checkable.get(rule)!
    const { name, args } = rule.head
    const inBody = new Set(rule.body.flatMap(b => b.args))
    const mask = this.maskOf(name, args.length)
    const ok = args.every(a => inBody.has(a)) && name !== OBJECT && !this.prep.defined.has(name)
      && !this.st.differences.has(name) && !this.st.sums.has(name)
    const out = ok ? { rule, vars: [...new Set(args)], literal: new Set(args.filter((_, i) => !mask[i])) } : null
    this.checkable.set(rule, out)
    return out
  }

  /** Ground instances of a rule's head under `s`; head-only variables range over all objects. */
  private heads(rule: Rule, s: Subst): GroundPredicate[] {
    const { name, args } = rule.head
    const mask = this.maskOf(name, args.length)
    const vars = [...new Set(args)]
    const literal = new Set(args.filter((_, i) => !mask[i]))
    const choices = vars.map(x => {
      const b = s.get(x)
      if (b && !b.flex) return [b.v]
      if (b) return literal.has(x) ? [...this.members(this.find(b.v))] : [this.find(b.v)]
      return literal.has(x) ? [...this.names] : [...this.reps]
    })
    return cartesian(choices).map(values => {
      const val = new Map(vars.map((x, i) => [x, values[i]]))
      return { name, args: args.map(a => val.get(a)!) }
    })
  }

  // ───────────────────────── saturation ─────────────────────────

  /**
   * Is the search over: the goal found, or the budget spent? A defined goal is a search of its own
   * (`holdsDefined`), so between rules, not after every fact, it is asked only when `full`.
   */
  /** Whether the last check was a full one (a defined goal is asked only then). */
  private lastCheckFull = true

  private done(full = true): boolean {
    this.lastCheckFull = full
    const goal = this.opts.goal
    if (goal && (full || !this.prep.defined.has(goal.name)) && this.holds(goal)) return true
    if (this.derivations >= (this.opts.maxDerivations ?? 200_000) || this.work >= (this.opts.maxWork ?? MAX_WORK)) { this.exhausted = true; return true }
    return false
  }

  /**
   * Where a run stopped inside a round: the rule it was at, and the matches of that rule not yet
   * asserted. A later run (`resume`) carries on from exactly there, so a search continued towards a
   * second goal is step for step the search a fresh one would make.
   */
  private round: { i: number; before: number; rule: Rule | null; matches: Subst[]; m: number } | null = null

  run(): void {
    const rules = [...this.prep.axioms, ...this.prep.rules]
    for (;;) {
      if (!this.round) {
        if (this.done()) return
        this.round = { i: 0, before: this.version, rule: null, matches: [], m: 0 }
      }
      const r = this.round
      while (r.i < rules.length) {
        const rule = rules[r.i]
        if (r.rule !== rule) {
          if (this.lastRun.get(rule) === this.version) { r.i++; continue }
          this.lastRun.set(rule, this.version)
          // Materialise first: asserting mutates the structures being matched against.
          this.head = this.headCheckable(rule)
          r.matches = [...this.join(rule.body, new Map(), this.prep.breaks.get(rule))]
          this.head = null
          r.rule = rule
          r.m = 0
        }
        while (r.m < r.matches.length) {
          const s = r.matches[r.m++]
          this.cause = { kind: 'rule', rule, s }
          for (const h of this.heads(rule, s)) this.assert(h)
          this.cause = GIVEN
          if (this.done(false)) return
        }
        r.rule = null
        r.matches = []
        r.i++
        if (this.done()) return
      }
      this.round = null
      // The solvers' findings go back to the store after every round, not only at the end: a goal
      // that needs them (collinear, from equal directions) may not wait for a quiet round.
      const fedDifferences = this.feedBackDifferences(), fedSums = this.feedBackSums()
      const fed = fedDifferences || fedSums
      if (this.done()) return
      if (this.version === r.before && !fed) return
    }
  }

  /**
   * Carry the search on towards another goal, from where it stopped, under the same budgets (counted
   * from the start, as a fresh search counts them). The closure only grows, and the search is
   * deterministic, so the verdict is the one a fresh search would give.
   */
  resume(goal: GroundPredicate): void {
    this.opts = { ...this.opts, goal }
    this.exhausted = false
    // First the check the search stopped at, now asked of this goal: a fresh search would ask it there.
    if (this.done(this.lastCheckFull)) return
    this.run()
  }


  /**
   * For each difference whose faithful rule the book states: pairs the solver shows to have one value
   * are asserted equivalent under the pairs' equivalence, where the rule's guards hold of them (lines
   * that turn by nothing are parallel). True if anything changed.
   */
  private feedBackDifferences(): boolean {
    let changed = false
    for (const [p, d] of this.st.differences) {
      if (!d.faithful || !d.pairs || !this.classesOf(p).members.size) continue
      const cached = this.latticeFor(p, d)
      const keys = [...cached.unknown.keys()]
      const [a, b, c, dd] = d.faithful.head.args
      const guards = d.faithful.body.filter(x => x.name !== p)
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const v: Vector = new Map([[cached.unknown.get(keys[i])!, 1], [cached.unknown.get(keys[j])!, -1]])
        const cert = cached.lattice.certificate(v)
        if (!cert) continue
        const [x1, x2] = keys[i].split(SEP), [y1, y2] = keys[j].split(SEP)
        const bind = new Map([[a, x1], [b, x2], [c, y1], [dd, y2]])
        const ground = guards.map(g => ({ name: g.name, args: g.args.map(v2 => bind.get(v2) ?? v2) }))
        if (!ground.every(g => this.holds(g))) continue
        this.cause = this.solverCause(p, cert, cached.atoms, ground)
        changed = this.assert({ name: d.pairs, args: [x1, x2, y1, y2] }) || changed
        this.cause = GIVEN
      }
    }
    return changed
  }
}

/**
 * The prepared rules cut to those that can help derive `names`: working back from them (and from
 * `false` and the equality, which every check may ask and every fact may use), through the bodies of
 * rules whose heads are needed. A predicate nothing is concluded from, such as `eq-turn` in the book,
 * then costs nothing to a proof that does not ask for it.
 */
const relevantCache = new WeakMap<Prepared, Map<string, Prepared>>()
export function relevant(prep: Prepared, names: readonly string[]): Prepared {
  const key = [...new Set(names)].sort().join(' ')
  let byKey = relevantCache.get(prep)
  if (!byKey) relevantCache.set(prep, byKey = new Map())
  const hit = byKey.get(key)
  if (hit) return hit
  const needed = new Set<string>(['false', ...names, ...(prep.structure.equality ? [prep.structure.equality] : [])])
  const add = (n: string) => {
    if (needed.has(n)) return false
    needed.add(n)
    return true
  }
  const all = [...prep.axioms, ...prep.rules]
  for (let grew = true; grew;) {
    grew = false
    // A difference that feeds its pairs' equivalence back (its faithful rule, implemented by the
    // solver rather than fired) is needed wherever that equivalence is, with the faithful rule's body.
    // A sum feeds its values' equivalence back through its solver: needed wherever that is.
    for (const [p, sum] of prep.structure.sums) if (needed.has(sum.values)) grew = add(p) || grew
    // A flip's facts are its equivalence's signed classes, and the classes answer for both: each is
    // needed wherever the other is.
    for (const [p, flip] of prep.structure.flips ?? []) {
      if (needed.has(flip.of)) grew = add(p) || grew
      if (needed.has(p)) grew = add(flip.of) || grew
    }
    for (const [p, d] of prep.structure.differences) {
      if (!d.faithful || !d.pairs || !needed.has(d.pairs)) continue
      for (const b of d.faithful.body) grew = add(b.name) || grew
      grew = add(p) || grew
    }
    for (const n of [...needed]) {
      const d = prep.defined.get(n)
      if (d) for (const b of expandDefined(d.body, prep.defined)) grew = add(b.name) || grew
    }
    for (const r of all) if (needed.has(r.head.name)) for (const b of r.body) grew = add(b.name) || grew
  }
  const out: Prepared = {
    ...prep,
    axioms: prep.axioms.filter(r => needed.has(r.head.name)),
    rules: prep.rules.filter(r => needed.has(r.head.name)),
  }
  byKey.set(key, out)
  return out
}

/**
 * Recent searches, by their rules (the relevant cut, which depends on the goal's predicate), their
 * seeds and their budgets: lemmas with the same hypotheses and a goal of the same predicate (the
 * windmill's two) share one search, each carrying it on from where the last stopped (`resume`).
 */
const searches = new WeakMap<Prepared, Map<string, Saturation>>()
const SEARCHES_KEPT = 8

export function saturate(
  kb: KnowledgeBase,
  seeds: readonly GroundPredicate[],
  opts: SaturateOptions = {},
): Saturation {
  if (opts.goal && !opts.relevant) {
    const prep = relevant(prepare(kb, opts.abbreviate ?? true), [opts.goal.name])
    const key = [opts.maxDerivations ?? '', opts.maxWork ?? '', ...seeds.map(f => f.name + ' ' + f.args.join(' '))].join('\n')
    let byKey = searches.get(prep)
    if (!byKey) searches.set(prep, byKey = new Map())
    const kept = byKey.get(key)
    if (kept) {
      byKey.delete(key); byKey.set(key, kept)   // most recent last
      kept.resume(opts.goal)
      return kept
    }
    const sat = new Saturation(prep, opts)
    for (const f of seeds) sat.assert(f)
    sat.run()
    byKey.set(key, sat)
    if (byKey.size > SEARCHES_KEPT) byKey.delete(byKey.keys().next().value!)
    return sat
  }
  const prep = prepare(kb, opts.abbreviate ?? true)
  const names = opts.relevant ?? (opts.goal ? [opts.goal.name] : null)
  const sat = new Saturation(names ? relevant(prep, names) : prep, opts)
  for (const f of seeds) sat.assert(f)
  sat.run()
  return sat
}
