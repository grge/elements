/**
 * Saturation: the forward closure of a knowledge base, computed using the structure recognised in its
 * rules (structure.ts). It computes the same facts as the reference `forwardClosure`; it is just faster.
 *
 *   equality      one union-find over objects; substitutable argument positions are stored as class
 *                 representatives, so substitution of equals costs nothing
 *   equivalences  a union-find over canonical argument tuples (e.g. unordered pairs of points)
 *   symmetries    facts stored in a canonical argument order
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

const OBJECT = '__object__'
const SEP = '\u0001'

/**
 * The default budget of work (`SaturateOptions.maxWork`): what a search may do before it gives up (the
 * checker's, and the marks closure's). Work is in proportion to time, so this, not the budget of
 * derivations, is what binds (the checker's derivations are a distant safety valve). Enough for
 * Pythagoras with whole squares (2.1 million), and a page that runs out gives up in under a minute.
 */
export const MAX_WORK = 3_000_000

interface Binding { v: string; flex: boolean }
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
  const live = kb.allRules()
    .filter(r => !skip.has(r) && !defined.has(r.head.name))
    .map(r => r.body.some(b => defined.has(b.name)) ? { ...r, body: expandDefined(r.body, defined) } : r)
  const breaks = new Map<Rule, SymmetryBreak>()
  for (const r of live) { const b = ruleSymmetries(r, structure); if (b) breaks.set(r, b) }
  const out: Prepared = {
    structure,
    redundant,
    axioms: live.filter(r => r.body.length === 0),
    rules: live.filter(r => r.body.length > 0),
    defined,
    breaks,
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

interface TupleClasses { parent: Map<string, string>; members: Map<string, Set<string>> }

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
  private derivations = 0
  /** Partial matches considered: the search's work, deterministic and in proportion to its time. */
  work = 0
  private lastRun = new Map<Rule, number>()
  exhausted = false

  constructor(private readonly prep: Prepared, private readonly opts: SaturateOptions = {}) {
    this.st = prep.structure
    this.eq = prep.structure.equality
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
    this.facts = new Map()
    this.byName = new Map()
    for (const f of old) this.store(f.name, this.canonArgs(f.name, f.args))

    for (const [p, classes] of this.tuples) {
      const e = this.st.equivalences.get(p)!
      const fresh: TupleClasses = { parent: new Map(), members: new Map() }
      this.tuples.set(p, fresh)
      const remap = (key: string) => this.tupleKey(p, e, key.split(SEP))
      for (const [key] of classes.parent) {
        this.unionTuples(p, remap(key), remap(this.rootIn(classes.parent, key)))
      }
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

  private unionTuples(p: string, k1: string, k2: string): boolean {
    const c = this.classesOf(p)
    const r1 = this.rootIn(c.parent, k1), r2 = this.rootIn(c.parent, k2)
    if (r1 === r2) return false
    const [win, lose] = r1 < r2 ? [r1, r2] : [r2, r1]
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
    let changed = this.introduce(f.args)
    const e = this.st.equivalences.get(f.name)
    if (f.name === this.eq && f.args.length === 2) {
      changed = this.mergeObjects(f.args[0], f.args[1]) || changed
    } else if (e && f.args.length === 2 * e.k) {
      const k1 = this.tupleKey(f.name, e, f.args.slice(0, e.k))
      const k2 = this.tupleKey(f.name, e, f.args.slice(e.k))
      changed = this.unionTuples(f.name, k1, k2) || changed
    } else {
      changed = this.store(f.name, this.canonArgs(f.name, f.args)) || changed
    }
    if (changed) this.version++
    return changed
  }

  holds(f: GroundPredicate): boolean {
    if (f.name === OBJECT) return f.args.every(a => this.names.has(a))
    if (this.prep.defined.has(f.name)) return this.holdsDefined(f)
    if (f.name === this.eq && f.args.length === 2) return this.find(f.args[0]) === this.find(f.args[1])
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

  private sumLattices = new Map<string, { version: number; lattice: Lattice; unknown: Map<string, number>; pairOf: Map<string, [string, string]> }>()

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
      for (const f of this.byName.get(p) ?? []) lattice.add(this.sumVector(sum, unknown, pairOf, f.args))
      this.sumLattices.set(p, cached = { version: this.version, lattice, unknown, pairOf })
    }
    return cached
  }

  /** Does a sum follow, by adding and subtracting the known ones (integer combinations: sound in any group)? */
  private sumHolds(p: string, sum: Sum, args: readonly string[]): boolean {
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
        if (!cached.lattice.contains(v)) continue
        changed = this.assert({ name: sum.values, args: [...cached.pairOf.get(keys[i])!, ...cached.pairOf.get(keys[j])!] }) || changed
      }
    }
    return changed
  }

  // ───────────────────────── differences: a solver ─────────────────────────

  /** Per difference relation: its equations as a lattice, built at a version of the store. */
  private lattices = new Map<string, { version: number; lattice: Lattice; unknown: Map<string, number> }>()

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
  private differenceHolds(p: string, e: Equivalence, d: Difference, args: readonly string[]): boolean {
    const cached = this.latticeFor(p, d)
    const v: Vector = new Map()
    if (!this.blockVector(d, cached.unknown, args.slice(0, e.k), 1, v) || !this.blockVector(d, cached.unknown, args.slice(e.k), -1, v)) return false
    return cached.lattice.contains(v)
  }

  /** A difference relation's equations as a lattice, at the store's current version. */
  private latticeFor(p: string, d: Difference): { version: number; lattice: Lattice; unknown: Map<string, number> } {
    let cached = this.lattices.get(p)
    if (!cached || cached.version !== this.version) {
      const lattice = new Lattice(), unknown = new Map<string, number>()
      for (const members of this.classesOf(p).members.values()) {
        const blocks = [...members].map(key => key.split(SEP))
        const first = blocks.find(b => this.blockVector(d, unknown, b, 1, new Map()))
        if (!first) continue
        for (const b of blocks) {
          if (b === first) continue
          const v: Vector = new Map()
          if (this.blockVector(d, unknown, b, 1, v) && this.blockVector(d, unknown, first, -1, v)) lattice.add(v)
        }
      }
      this.lattices.set(p, cached = { version: this.version, lattice, unknown })
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
    return !this.join(atoms, s).next().done
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

    const group = this.st.symmetries.get(name)
    for (const f of this.byName.get(name) ?? []) {
      if (f.args.length !== args.length) continue
      for (const img of group ? orbit(group, f.args) : [f.args]) {
        const t = this.unifyArgs(s, args, img, mask)
        if (t) yield t
      }
    }
  }

  private *matchEquivalence(p: string, e: Equivalence, args: readonly string[], s: Subst, mask: boolean[]): Generator<Subst> {
    const k = e.k
    const imagesOf = (key: string) => orbitByKey(e.blockGroup, key)
    const classMembers = (root: string) => this.classesOf(p).members.get(root) ?? [root]
    // A block can be looked up directly when all its variables are bound and their values are exact.
    const lookup = (vars: readonly string[]) => {
      const bs = vars.map(v => s.get(v))
      if (bs.some(b => !b) || (!mask[0] && bs.some(b => b!.flex))) return null
      return bs.map(b => b!.v)
    }
    const first = lookup(args.slice(0, k)), second = lookup(args.slice(k))

    if (first || second) {
      const known = (first ?? second)!
      const root = this.tupleRoot(p, this.tupleKey(p, e, known))
      for (const m of classMembers(root)) {
        for (const img of imagesOf(m)) {
          const t = this.unifyArgs(s, args, first ? [...known, ...img] : [...img, ...known], mask)
          if (t) yield t
        }
      }
      return
    }

    // Every class of tuples mentioned.
    const mentioned = this.classesOf(p).parent
    const seen = new Set<string>()
    for (const key of mentioned.keys()) {
      this.work++
      const root = this.tupleRoot(p, key)
      if (seen.has(root)) continue
      seen.add(root)
      const tuples = [...classMembers(root)].flatMap(imagesOf)
      for (const x of tuples) for (const y of tuples) {
        const t = this.unifyArgs(s, args, [...x, ...y], mask)
        if (t) yield t
      }
    }
    // A tuple never mentioned is a class of its own, so it matches only reflexively: both blocks are
    // images of the one tuple. Only tuples consistent with what is bound can match: generate them
    // from the block with fewer unbound variables (bound positions fixed, the rest over every point),
    // each paired with its images in the other block.
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
  private done(full = true): boolean {
    const goal = this.opts.goal
    if (goal && (full || !this.prep.defined.has(goal.name)) && this.holds(goal)) return true
    if (this.derivations >= (this.opts.maxDerivations ?? 200_000) || this.work >= (this.opts.maxWork ?? MAX_WORK)) { this.exhausted = true; return true }
    return false
  }

  run(): void {
    const rules = [...this.prep.axioms, ...this.prep.rules]
    for (;;) {
      if (this.done()) return
      const before = this.version
      for (const rule of rules) {
        if (this.lastRun.get(rule) === this.version) continue
        this.lastRun.set(rule, this.version)
        // Materialise first: asserting mutates the structures being matched against.
        const matches = [...this.join(rule.body, new Map(), this.prep.breaks.get(rule))]
        for (const s of matches) {
          for (const h of this.heads(rule, s)) this.assert(h)
          if (this.done(false)) return
        }
        if (this.done()) return
      }
      // The solvers' findings go back to the store after every round, not only at the end: a goal
      // that needs them (collinear, from equal directions) may not wait for a quiet round.
      const fedDifferences = this.feedBackDifferences(), fedSums = this.feedBackSums()
      const fed = fedDifferences || fedSums
      if (this.done()) return
      if (this.version === before && !fed) return
    }
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
        if (!cached.lattice.contains(v)) continue
        const [x1, x2] = keys[i].split(SEP), [y1, y2] = keys[j].split(SEP)
        const bind = new Map([[a, x1], [b, x2], [c, y1], [dd, y2]])
        if (!guards.every(g => this.holds({ name: g.name, args: g.args.map(v2 => bind.get(v2) ?? v2) }))) continue
        changed = this.assert({ name: d.pairs, args: [x1, x2, y1, y2] }) || changed
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

export function saturate(
  kb: KnowledgeBase,
  seeds: readonly GroundPredicate[],
  opts: SaturateOptions = {},
): Saturation {
  const prep = prepare(kb, opts.abbreviate ?? true)
  const names = opts.relevant ?? (opts.goal ? [opts.goal.name] : null)
  const sat = new Saturation(names ? relevant(prep, names) : prep, opts)
  for (const f of seeds) sat.assert(f)
  sat.run()
  return sat
}
