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
import { analyseStructure, type Equivalence, type Structure } from './structure'
import { fingerprint, Lru } from './rules'

const OBJECT = '__object__'
const SEP = '\u0001'

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
  const live = kb.allRules()
    .filter(r => !skip.has(r) && !defined.has(r.head.name))
    .map(r => r.body.some(b => defined.has(b.name)) ? { ...r, body: expandDefined(r.body, defined) } : r)
  const out: Prepared = {
    structure,
    redundant,
    axioms: live.filter(r => r.body.length === 0),
    rules: live.filter(r => r.body.length > 0),
    defined,
  }
  byKB.set(kb, out)
  byRules.set(key, out)
  return out
}

/** Does the structure alone derive the rule's head from its body (on fresh constants)? */
function impliedByStructure(rule: Rule, structure: Structure): boolean {
  const sat = new Saturation({ structure, redundant: [], axioms: [], rules: [], defined: new Map() })
  for (const b of rule.body) sat.assert({ name: b.name, args: b.args })
  sat.assert({ name: OBJECT, args: rule.head.args })
  return sat.holds({ name: rule.head.name, args: rule.head.args })
}

function orbit(group: number[][], args: readonly string[]): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const perm of group) {
    const img = perm.map(i => args[i])
    const key = img.join(SEP)
    if (!seen.has(key)) { seen.add(key); out.push(img) }
  }
  return out
}

function orbitMin(group: number[][], args: readonly string[]): string[] {
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
      return this.tupleRoot(f.name, this.tupleKey(f.name, e, f.args.slice(0, e.k)))
        === this.tupleRoot(f.name, this.tupleKey(f.name, e, f.args.slice(e.k)))
    }
    return this.facts.has(this.factKey(f.name, this.canonArgs(f.name, f.args)))
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
    if (e && args.length === 2 * e.k) { yield* this.matchEquivalence(name, e, args, s, mask); return }

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
    const imagesOf = (key: string) => orbit(e.blockGroup, key.split(SEP))
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

    // Walk every class, including the singleton classes of tuples never mentioned.
    const pool = [...(mask[0] ? this.reps : this.names)]
    const seen = new Set<string>()
    const keys = new Set<string>([...this.classesOf(p).parent.keys()])
    for (const t of cartesian<string>(Array.from({ length: k }, () => pool))) keys.add(this.tupleKey(p, e, t))
    for (const key of keys) {
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
  }

  private *join(body: readonly Predicate[], s: Subst): Generator<Subst> {
    this.work++
    if (body.length === 0) { yield s; return }
    // Greedy: match the atom with the largest share of already-bound arguments next.
    let best = 0, bestScore = -1
    for (let i = 0; i < body.length; i++) {
      const score = body[i].args.filter(a => s.has(a)).length / Math.max(1, body[i].args.length)
      if (score > bestScore) { best = i; bestScore = score }
    }
    const rest = body.filter((_, i) => i !== best)
    for (const s1 of this.match(body[best], s)) yield* this.join(rest, s1)
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
    if (this.derivations >= (this.opts.maxDerivations ?? 200_000) || this.work >= (this.opts.maxWork ?? Infinity)) { this.exhausted = true; return true }
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
        const matches = [...this.join(rule.body, new Map())]
        for (const s of matches) {
          for (const h of this.heads(rule, s)) this.assert(h)
          if (this.done(false)) return
        }
        if (this.done()) return
      }
      if (this.version === before) return
    }
  }
}

export function saturate(
  kb: KnowledgeBase,
  seeds: readonly GroundPredicate[],
  opts: SaturateOptions = {},
): Saturation {
  const sat = new Saturation(prepare(kb, opts.abbreviate ?? true), opts)
  for (const f of seeds) sat.assert(f)
  sat.run()
  return sat
}
