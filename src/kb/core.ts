/**
 * The matching core (engine.md, *A new matching core*; the review's step 5): the same forward closure
 * as `Saturation` (saturate.ts), on integers. It takes the same `Prepared` rules (structure,
 * definitions as abbreviations, rule symmetries, the relevant cut) and computes the same closure, rule
 * by rule and round by round, with the same join order, so that it makes the same join steps
 * (`work`, the budget's unit) and reaches the same verdicts. `Saturation` stays as its oracle
 * (tests/core.test.ts compares them on every lemma of the book and *Beyond*).
 *
 * What is different is only how it is done:
 *   - points are small integers, and a tuple a packed number (or, past six places, a string of them);
 *   - a rule is compiled once: its variables are numbered slots, bound and unbound by a trail, never a
 *     copied map; matches are found by recursion with a callback, not generators;
 *   - canonical forms are the least packed image under the relation's group.
 * Where `Saturation` compares points by name (the rule symmetries' least member, which of two equal
 * points stands for both), the core compares them by name too, so it makes the same choices.
 *
 * With `provenance`, it records why each fact, union and merge is in the store, as `Saturation` does,
 * and explains a goal by it (explain.ts); without, it records nothing.
 */
import type { Predicate, Rule } from '../language/parser'
import type { GroundPredicate } from './inference'
import { Lattice, type Vector } from './lattice'
import { expandDefined, MAX_WORK, type Prepared, type SaturateOptions } from './saturate'
import { explain, GIVEN, type Cause, type ExplainStore, type Recorded, type SolverCause } from './explain'
import type { Proof } from './proof'
import type { Difference, Sum } from './structure'

const OBJECT = '__object__'
/** Points are numbered below this; a tuple of up to six of them packs exactly into a number. */
const NB = 256
const PACKED = 6

type Key = number | string

function packOf(vals: ArrayLike<number>, perm?: readonly number[]): Key {
  const n = perm ? perm.length : vals.length
  if (n <= PACKED) {
    let k = 0
    if (perm) for (let i = 0; i < n; i++) k = k * NB + vals[perm[i]]
    else for (let i = 0; i < n; i++) k = k * NB + vals[i]
    return k
  }
  let s = ''
  for (let i = 0; i < n; i++) s += (i ? ',' : '') + (perm ? vals[perm[i]] : vals[i])
  return s
}
function unpackOf(k: Key, n: number): Int32Array {
  const out = new Int32Array(n)
  if (typeof k === 'string') { k.split(',').forEach((x, i) => { out[i] = +x }); return out }
  for (let i = n - 1; i >= 0; i--) { out[i] = k % NB; k = Math.floor(k / NB) }
  return out
}
const keyLess = (a: Key, b: Key) => typeof a === 'number' && typeof b === 'number' ? a < b : String(a) < String(b)

/** Too many points for the core: `saturate()` falls back to `Saturation`. */
export class CoreRefused extends Error {}

interface Classes {
  parent: Map<number, number>
  members: Map<number, number[]>
  par?: Map<number, number>
  odd?: Set<number>
  index: Map<number, number[]>
  images: Map<number, Int32Array[]>
}

/** A relation as the store keeps it. */
class Rel {
  kind: 'eq' | 'equiv' | 'flip' | 'stored' = 'stored'
  mask: boolean[]
  /** stored: its symmetry group (or the identity); equiv: its block group. */
  group: number[][]
  k = 0
  /** flip: the equivalence it flips. */
  of: Rel | null = null
  signed = false
  difference: Difference | null = null
  sum: Sum | null = null
  // stored
  keys = new Set<Key>()
  facts: Int32Array[] = []
  /** Every fact's images under the group, fact by fact (the scan when no argument is bound). */
  images: Int32Array[] = []
  index = new Map<number, Int32Array[]>()
  /** difference: its pairs' equivalence; sum: its values' equivalence. */
  pairsRel: Rel | null = null
  /** Bumped whenever its classes or facts change: what a solver built from it is valid while this holds. */
  stamp = 0
  /** Provenance: stored facts' records by canonical key; an equivalence's recorded unions. */
  reasons = new Map<Key, Recorded>()
  unions: (Recorded & { sign: number })[] = []
  // equivalence
  classes: Classes | null = null
  constructor(readonly name: string, readonly arity: number) {
    this.mask = Array(arity).fill(false)
    this.group = [Array.from({ length: arity }, (_, i) => i)]
  }
}

interface Atom { rel: Rel; slots: Int32Array; name: string; diff: boolean }
interface Compiled {
  rule: Rule | null
  atoms: Atom[]
  nvars: number
  head: Atom | null
  headVars: number[]
  headLiteral: boolean[]
  headPos: Int32Array
  /** The early head check applies (saturate.ts, `headCheckable`). */
  checkable: boolean
  brkOrder: Int32Array | null
  brkPerms: Int32Array[]
  names: string[]
}

export class Core {
  // objects
  private names: string[] = []
  private ids = new Map<string, number>()
  private up: number[] = []
  private classOf = new Map<number, number[]>()
  private introduced: number[] = []
  /** Introduced points in order of introduction (saturate.ts's `names`), and the representatives among them. */
  private namesOrder: number[] = []
  private repsCache: number[] | null = null
  /** Each point's place in name order, for comparing points as `Saturation` does. */
  private rankCache: Int32Array | null = null

  private rels = new Map<string, Rel>()
  /** Equivalences in the order their classes were first made (saturate.ts's `tuples`). */
  private equivOrder: Rel[] = []
  private compiled: Compiled[]
  private lastRun = new Map<Compiled, number>()
  private version = 0
  /** Points merged so far: a solver's values change with them. */
  private merges = 0
  private derivations = 0
  work = 0
  matches = 0
  exhausted = false
  private readonly eqName: string | null

  // provenance (with `opts.provenance`)
  private readonly recording: boolean
  private cause: Cause = GIVEN
  private clock = 0
  private mergeRecords: Recorded[] = []

  // bindings
  private val = new Int32Array(64)
  private flex = new Uint8Array(64)
  private bound = new Uint8Array(64)
  private trail: number[] = []

  constructor(private readonly prep: Prepared, private opts: SaturateOptions = {}) {
    this.eqName = prep.structure.equality
    this.recording = !!opts.provenance
    this.compiled = [...prep.axioms, ...prep.rules].map(r => this.compile(r.body, r.head, r, prep.breaks.get(r)))
  }

  // ───────────────────────── objects ─────────────────────────

  private id(name: string): number {
    let i = this.ids.get(name)
    if (i === undefined) {
      i = this.names.length
      if (i >= NB) throw new CoreRefused(`more than ${NB} points`)
      this.ids.set(name, i); this.names.push(name); this.up.push(i); this.introduced.push(0)
      this.rankCache = null
    }
    return i
  }

  private find(x: number): number {
    while (this.up[x] !== x) x = this.up[x]
    return x
  }

  private rank(): Int32Array {
    if (!this.rankCache) {
      const order = this.names.map((_, i) => i).sort((a, b) => this.names[a] < this.names[b] ? -1 : this.names[a] > this.names[b] ? 1 : 0)
      const r = new Int32Array(this.names.length)
      order.forEach((x, i) => { r[x] = i })
      this.rankCache = r
    }
    return this.rankCache
  }

  private introduce(args: readonly string[]): boolean {
    let fresh = false
    for (const n of args) {
      const i = this.id(n)
      if (this.introduced[i]) continue
      this.introduced[i] = 1
      this.namesOrder.push(i)
      this.repsCache = null
      fresh = true
    }
    if (fresh) this.version++
    return fresh
  }

  private reps(): number[] {
    if (!this.repsCache) this.repsCache = this.namesOrder.filter(i => this.find(i) === i)
    return this.repsCache
  }
  private membersOf(rep: number): number[] { return this.classOf.get(rep) ?? [rep] }

  private merge(a: number, b: number): boolean {
    const ra = this.find(a), rb = this.find(b)
    if (ra === rb) return false
    const [win, lose] = this.names[ra] < this.names[rb] ? [ra, rb] : [rb, ra]
    this.up[lose] = win
    this.merges++
    const merged = [...this.membersOf(win)]
    for (const m of this.membersOf(lose)) if (!merged.includes(m)) merged.push(m)
    this.classOf.set(win, merged)
    this.classOf.delete(lose)
    this.repsCache = null
    this.renormalise()
    return true
  }

  /** After a merge, every stored fact and every class of blocks over the new representatives. */
  private renormalise(): void {
    for (const r of this.rels.values()) {
      if (r.kind !== 'stored') continue
      const old = r.facts, oldReasons = r.reasons
      r.keys = new Set(); r.facts = []; r.images = []; r.index = new Map(); r.reasons = new Map()
      for (const f of old) {
        const t = this.canon(r, f)
        this.store(r, t)
        const rec = oldReasons.get(packOf(f))
        if (!rec) continue
        const k = packOf(t), prev = r.reasons.get(k)
        if (!prev || rec.t < prev.t) r.reasons.set(k, rec)
      }
    }
    for (const r of this.equivOrder) {
      const old = r.classes!
      const rootOld = (k: number) => { let x = k; for (let p = old.parent.get(x); p !== undefined && p !== x; p = old.parent.get(x)) x = p; return x }
      const parityOld = (k: number) => {
        if (!old.par) return 0
        let x = 0
        for (let q = k, p = old.parent.get(q); p !== undefined && p !== q; q = p, p = old.parent.get(q)) x ^= old.par.get(q) ?? 0
        return x
      }
      r.classes = this.freshClasses(r)
      const remap = (key: number) => this.tupleKey(r, unpackOf(key, r.k), 0)
      for (const key of old.parent.keys()) this.union(r, remap(key), remap(rootOld(key)), parityOld(key))
      for (const o of old.odd ?? []) this.union(r, remap(o), remap(o), 1)
    }
    this.version++
  }

  // ───────────────────────── relations ─────────────────────────

  private rel(name: string, arity: number): Rel {
    const key = name + '/' + arity
    let r = this.rels.get(key)
    if (r) return r
    r = new Rel(name, arity)
    this.rels.set(key, r)
    const st = this.prep.structure
    const m = st.congruent.get(name)
    if (m && m.length === arity) r.mask = [...m]
    const flip = st.flips?.get(name)
    const e = st.equivalences.get(name)
    if (name === this.eqName && arity === 2) r.kind = 'eq'
    else if (e && arity === 2 * e.k) {
      r.kind = 'equiv'; r.k = e.k; r.group = e.blockGroup
      r.signed = [...(st.flips?.values() ?? [])].some(f => f.of === name)
      r.difference = st.differences.get(name) ?? null
      const pairs = r.difference?.pairs ? st.equivalences.get(r.difference.pairs) : undefined
      if (pairs && pairs.k === 2) r.pairsRel = this.rel(r.difference!.pairs!, 4)
    } else if (flip) {
      const qe = st.equivalences.get(flip.of)!
      if (arity === 2 * qe.k) { r.kind = 'flip'; r.of = this.rel(flip.of, arity); r.k = qe.k; r.mask = r.of.mask }
    } else {
      const g = st.symmetries.get(name)
      if (g && g[0].length === arity) r.group = g
      const sum = st.sums.get(name)
      if (sum && arity === 6) { r.sum = sum; r.pairsRel = this.rel(sum.values, 4) }
    }
    return r
  }

  private freshClasses(r: Rel): Classes {
    return { parent: new Map(), members: new Map(), index: new Map(), images: r.classes?.images ?? new Map(), ...(r.signed ? { par: new Map(), odd: new Set() } : {}) }
  }
  private classesOf(r: Rel): Classes {
    if (!r.classes) { r.classes = this.freshClasses(r); this.equivOrder.push(r) }
    return r.classes
  }

  private canon(r: Rel, vals: ArrayLike<number>): Int32Array {
    const t = new Int32Array(vals.length)
    for (let i = 0; i < t.length; i++) t[i] = r.mask[i] ? this.find(vals[i]) : vals[i]
    if (r.group.length === 1) return t
    let best: Key = -1, bestPerm = r.group[0]
    for (const perm of r.group) { const k = packOf(t, perm); if (best === -1 || keyLess(k, best)) { best = k; bestPerm = perm } }
    return Int32Array.from(bestPerm, i => t[i])
  }

  /** The key of a tuple's canonical form, without making it. */
  private ck = new Int32Array(16)
  private canonKey(r: Rel, vals: ArrayLike<number>): Key {
    const n = vals.length, t = this.ck
    for (let i = 0; i < n; i++) t[i] = r.mask[i] ? this.find(vals[i]) : vals[i]
    if (r.group.length === 1) return packOf(t.subarray(0, n))
    let best: Key = -1
    for (const perm of r.group) { const k = packOf(t, perm); if (best === -1 || keyLess(k, best)) best = k }
    return best
  }

  private store(r: Rel, t: Int32Array): boolean {
    const key = packOf(t)
    if (r.keys.has(key)) return false
    r.keys.add(key)
    r.facts.push(t)
    r.stamp++
    const seen = new Set<Key>()
    for (const perm of r.group) {
      const k = packOf(t, perm)
      if (seen.has(k)) continue
      seen.add(k)
      const img = r.group.length === 1 ? t : Int32Array.from(perm, i => t[i])
      r.images.push(img)
      for (let i = 0; i < img.length; i++) {
        const ix = i * NB + img[i]
        let l = r.index.get(ix)
        if (!l) r.index.set(ix, l = [])
        l.push(img)
      }
    }
    return true
  }

  // ───────────────────────── block equivalences ─────────────────────────

  private scratch = new Int32Array(8)
  private tupleKey(r: Rel, vals: ArrayLike<number>, from: number): number {
    const t = this.scratch, sub = r.mask[0], g = r.group
    for (let i = 0; i < r.k; i++) t[i] = sub ? this.find(vals[from + i]) : vals[from + i]
    let best = -1
    for (let q = 0; q < g.length; q++) {
      let k = 0
      const perm = g[q]
      for (let i = 0; i < perm.length; i++) k = k * NB + t[perm[i]]
      if (best < 0 || k < best) best = k
    }
    return best
  }

  /**
   * A key's root, compressing the path on the way (each key on it then points at the root, its parity
   * relative to the root kept): the classes' meaning is unchanged. `lastParity` is the key's parity.
   */
  private lastParity = 0
  private root(c: Classes, k: number): number {
    const parent = c.parent
    let p = parent.get(k)
    if (p === undefined || p === k) { this.lastParity = 0; return k }
    // Find the root and the parity, then point every key on the path at the root.
    let r = k, x = 0
    for (let q = parent.get(r); q !== undefined && q !== r; q = parent.get(r)) { if (c.par) x ^= c.par.get(r) ?? 0; r = q }
    this.lastParity = x
    if (parent.get(k) !== r) {
      let y = x
      for (let q = k; q !== r;) {
        const next = parent.get(q)!
        const own = c.par ? c.par.get(q) ?? 0 : 0
        parent.set(q, r)
        if (c.par) { if (y) c.par.set(q, y); else c.par.delete(q) }
        y ^= own
        q = next
      }
    }
    return r
  }

  private parity(c: Classes, k: number): number {
    if (!c.par) return 0
    this.root(c, k)
    return this.lastParity
  }

  private imagesOf(r: Rel, key: number): Int32Array[] {
    const c = r.classes!
    let out = c.images.get(key)
    if (!out) {
      const t = unpackOf(key, r.k), seen = new Set<number>()
      out = []
      for (const perm of r.group) { const k = packOf(t, perm) as number; if (!seen.has(k)) { seen.add(k); out.push(Int32Array.from(perm, i => t[i])) } }
      c.images.set(key, out)
    }
    return out
  }

  private indexKey(r: Rel, key: number): void {
    const c = r.classes!
    for (const img of this.imagesOf(r, key)) for (let j = 0; j < r.k; j++) {
      const ix = j * NB + img[j]
      let l = c.index.get(ix)
      if (!l) c.index.set(ix, l = [])
      if (l[l.length - 1] !== key) l.push(key)
    }
  }

  /** Join two keys' classes; `sign` 1: they are each other's flip. As saturate.ts's `unionTuples`. */
  private union(r: Rel, k1: number, k2: number, sign = 0): boolean {
    const c = this.classesOf(r)
    const r1 = this.root(c, k1), r2 = this.root(c, k2)
    if (r.signed) {
      if (r1 === r2) {
        if ((this.parity(c, k1) ^ this.parity(c, k2)) === sign || c.odd!.has(r1)) return false
        if (!c.parent.has(k1)) { this.indexKey(r, k1); c.parent.set(k1, k1) }
        c.odd!.add(r1)
        r.stamp++
        return true
      }
    } else if (r1 === r2) return false
    if (!c.parent.has(k1)) this.indexKey(r, k1)
    if (!c.parent.has(k2) && k2 !== k1) this.indexKey(r, k2)
    const [win, lose] = this.keyNameLess(r, r1, r2) ? [r1, r2] : [r2, r1]
    if (c.par) {
      c.par.set(lose, this.parity(c, k1) ^ this.parity(c, k2) ^ sign)
      if (c.odd!.has(lose)) { c.odd!.delete(lose); c.odd!.add(win) }
    }
    const wm = c.members.get(win) ?? [win]
    for (const m of c.members.get(lose) ?? [lose]) if (!wm.includes(m)) wm.push(m)
    c.members.set(win, wm)
    c.members.delete(lose)
    c.parent.set(lose, win)
    if (!c.parent.has(win)) c.parent.set(win, win)
    r.stamp++
    return true
  }

  /** Two keys compared as their joined names are (saturate.ts keys are names joined). */
  private keyNameLess(r: Rel, a: number, b: number): boolean {
    const x = unpackOf(a, r.k), y = unpackOf(b, r.k)
    for (let i = 0; i < r.k; i++) {
      if (x[i] === y[i]) continue
      return this.names[x[i]] < this.names[y[i]]
    }
    return false
  }

  // ───────────────────────── asserting and asking ─────────────────────────

  assert(f: GroundPredicate): boolean {
    this.derivations++
    if (f.name === OBJECT) return this.introduce(f.args)
    let changed = this.introduce(f.args)
    const ids = f.args.map(a => this.ids.get(a)!)
    changed = this.assertIds(this.rel(f.name, f.args.length), ids) || changed
    return changed
  }

  private assertIds(r: Rel, vals: ArrayLike<number>): boolean {
    // A rule's certificates for the premises a solver answered, taken before this fact changes anything.
    if (this.recording) this.certified(this.cause)
    let changed = false
    const atom = () => ({ name: r.name, args: Array.from(vals, v => this.names[v]) })
    if (r.kind === 'flip') {
      const q = r.of!
      changed = this.union(q, this.tupleKey(q, vals, 0), this.tupleKey(q, vals, q.k), 1)
      if (changed && this.recording) q.unions.push({ atom: atom(), cause: this.cause, t: ++this.clock, sign: 1 })
    } else if (r.kind === 'eq') {
      const a = atom()   // before the merge renames anything
      changed = this.merge(vals[0], vals[1])
      if (changed && this.recording) this.mergeRecords.push({ atom: a, cause: this.cause, t: ++this.clock })
    } else if (r.kind === 'equiv') {
      if (r.difference) for (let i = 0; i < vals.length; i += 2) if (this.find(vals[i]) === this.find(vals[i + 1])) return false
      changed = this.union(r, this.tupleKey(r, vals, 0), this.tupleKey(r, vals, r.k))
      if (changed && this.recording) r.unions.push({ atom: atom(), cause: this.cause, t: ++this.clock, sign: 0 })
    } else {
      const t = this.canon(r, vals)
      changed = this.store(r, t)
      if (changed && this.recording) r.reasons.set(packOf(t), { atom: atom(), cause: this.cause, t: ++this.clock })
    }
    if (changed) this.version++
    return changed
  }

  /**
   * A rule's cause, with a certificate for each premise a solver answered (a difference's atom whose
   * blocks no class joins), taken now: later, the solver's equations may include facts that came after.
   */
  private certified(cause: Cause): void {
    if (cause.kind !== 'rule' || cause.solved) return
    const solved = new Map<number, SolverCause>()
    const premises = cause.premises()
    cause.rule.body.forEach((b, i) => {
      const r = this.rel(b.name, b.args.length)
      if (r.kind !== 'equiv' || !r.difference) return
      const ids = premises[i].args.map(a => this.id(a))
      const c = this.classesOf(r)
      if (this.root(c, this.tupleKey(r, ids, 0)) === this.root(c, this.tupleKey(r, ids, r.k))) return
      const cached = this.latticeFor(r)
      const v: Vector = new Map()
      if (!this.blockVector(r.pairsRel, cached.unknown, ids, 0, 1, v) || !this.blockVector(r.pairsRel, cached.unknown, ids, r.k, -1, v)) return
      const cert = cached.lattice.certificate(v)
      if (cert) solved.set(i, this.solverCause(r, cert, cached.atoms, [], premises[i]))
    })
    cause.solved = solved
  }

  holds(f: GroundPredicate): boolean {
    if (f.name === OBJECT) return f.args.every(a => { const i = this.ids.get(a); return i !== undefined && !!this.introduced[i] })
    if (this.prep.defined.has(f.name)) return this.holdsDefined(f)
    const ids = f.args.map(a => this.id(a))
    return this.holdsIds(this.rel(f.name, f.args.length), ids)
  }

  private holdsIds(r: Rel, ids: ArrayLike<number>): boolean {
    if (r.kind === 'eq') return this.find(ids[0]) === this.find(ids[1])
    if (r.kind === 'flip' || (r.kind === 'equiv' && r.signed)) {
      const q = r.kind === 'flip' ? r.of! : r
      const c = this.classesOf(q)
      const k1 = this.tupleKey(q, ids, 0), k2 = this.tupleKey(q, ids, q.k)
      const rt = this.root(c, k1)
      if (rt !== this.root(c, k2)) return false
      return c.odd!.has(rt) || (this.parity(c, k1) ^ this.parity(c, k2)) === (r.kind === 'flip' ? 1 : 0)
    }
    if (r.kind === 'equiv') {
      const c = this.classesOf(r)
      if (this.root(c, this.tupleKey(r, ids, 0)) === this.root(c, this.tupleKey(r, ids, r.k))) return true
      return r.difference ? this.differenceHolds(r, ids) : false
    }
    if (r.keys.has(this.canonKey(r, ids))) return true
    return r.sum ? this.sumHolds(r, ids) : false
  }

  private definedCache = new Map<string, Compiled>()
  private holdsDefined(f: GroundPredicate): boolean {
    for (const a of f.args) this.id(a)
    const key = f.name + ' ' + f.args.join(' ')
    let c = this.definedCache.get(key)
    if (!c) {
      c = this.compile(expandDefined([{ name: f.name, args: [...f.args] }], this.prep.defined), null, null, undefined)
      this.definedCache.set(key, c)
    }
    this.ensure(c.nvars)
    const mark = this.trail.length
    for (let s = 0; s < c.nvars; s++) {
      const n = c.names[s]
      if (f.args.includes(n)) this.bind(s, this.ids.get(n)!, 1)
    }
    let found = false
    this.join(c, (1 << c.atoms.length) - 1, () => { found = true; return true })
    this.undo(mark)
    return found
  }

  /** Stored facts, and each point's equality with its representative (as saturate.ts gives them). */
  allFacts(): GroundPredicate[] {
    const out: GroundPredicate[] = []
    const nm = (i: number) => this.names[i]
    for (const r of this.rels.values()) if (r.kind === 'stored') for (const f of r.facts) out.push({ name: r.name, args: [...f].map(nm) })
    if (this.eqName) for (const i of this.namesOrder) out.push({ name: this.eqName, args: [nm(i), nm(this.find(i))] })
    return out
  }

  // ───────────────────────── solvers ─────────────────────────

  /** A pair's value as an unknown: its class under the pairs' equivalence, or the pair itself; -1 for one point. */
  private pr = new Int32Array(2)
  /** Pair values at a version of the store, by the pair (a·NB + b): asked four times in every solver query. */
  private pvTables = new Map<Rel | null, { gen: number; relStamp: number; merges: number; stamp: Int32Array; value: Float64Array }>()
  private pairValue(q: Rel | null, a: number, b: number): number {
    let t = this.pvTables.get(q)
    if (!t) this.pvTables.set(q, t = { gen: 0, relStamp: -1, merges: -1, stamp: new Int32Array(NB * NB).fill(-1), value: new Float64Array(NB * NB) })
    const relStamp = q ? q.stamp : 0
    if (t.relStamp !== relStamp || t.merges !== this.merges) { t.gen++; t.relStamp = relStamp; t.merges = this.merges }
    const slot = a * NB + b
    if (t.stamp[slot] === t.gen) return t.value[slot]
    const v = this.pairValueNow(q, a, b)
    t.stamp[slot] = t.gen
    t.value[slot] = v
    return v
  }
  private pairValueNow(q: Rel | null, a: number, b: number): number {
    if (this.find(a) === this.find(b)) return -1
    if (q && q.kind === 'equiv') { this.pr[0] = a; this.pr[1] = b; return this.root(this.classesOf(q), this.tupleKey(q, this.pr, 0)) }
    const x = this.find(a), y = this.find(b)
    return this.names[x] < this.names[y] ? x * NB + y : y * NB + x
  }

  private blockVector(q: Rel | null, unknown: Map<number, number>, block: ArrayLike<number>, off: number, sign: number, into: Vector): boolean {
    const from = this.pairValue(q, block[off], block[off + 1]), to = this.pairValue(q, block[off + 2], block[off + 3])
    if (from < 0 || to < 0) return false
    for (const [key, c] of [[to, sign], [from, -sign]] as const) {
      let i = unknown.get(key)
      if (i === undefined) unknown.set(key, i = unknown.size)
      const x = (into.get(i) ?? 0) + c
      if (x === 0) into.delete(i)
      else into.set(i, x)
    }
    return true
  }

  private lattices = new Map<Rel, { stamp: string; lattice: Lattice; unknown: Map<number, number>; byEquation: Map<number | string, boolean>; atoms: GroundPredicate[] }>()
  /** What a solver over `r` was built from: its classes or facts, its values' classes, the merges. */
  private solverStamp(r: Rel): string { return `${r.stamp} ${r.pairsRel?.stamp ?? 0} ${this.merges}` }
  private latticeFor(r: Rel): { stamp: string; lattice: Lattice; unknown: Map<number, number>; byEquation: Map<number | string, boolean>; atoms: GroundPredicate[] } {
    let cached = this.lattices.get(r)
    const stamp = this.solverStamp(r)
    if (!cached || cached.stamp !== stamp) {
      const d = r.pairsRel, lattice = new Lattice(), unknown = new Map<number, number>()
      const atoms: GroundPredicate[] = []
      for (const members of this.classesOf(r).members.values()) {
        const blocks = members.map(key => unpackOf(key, r.k))
        const first = blocks.find(b => this.blockVector(d, unknown, b, 0, 1, new Map()))
        if (!first) continue
        for (const b of blocks) {
          if (b === first) continue
          const v: Vector = new Map()
          if (this.blockVector(d, unknown, b, 0, 1, v) && this.blockVector(d, unknown, first, 0, -1, v)) {
            lattice.add(v)
            atoms.push({ name: r.name, args: [...b, ...first].map(x => this.names[x]) })
          }
        }
      }
      this.lattices.set(r, cached = { stamp, lattice, unknown, byEquation: new Map(), atoms })
    }
    return cached
  }

  /**
   * Does a difference follow (saturate.ts's `differenceHolds`)? value(to₁) − value(from₁) − value(to₂)
   * + value(from₂) must be an integer combination of the known equations. Values no equation mentions
   * cannot cancel, so such a question is answered no at once; the rest are cached by their equation.
   */
  private terms = new Float64Array(4)
  private coefs = new Int32Array(4)
  private idx = new Int32Array(4)
  private cs = new Int32Array(4)
  private differenceHolds(r: Rel, ids: ArrayLike<number>): boolean {
    const q = r.pairsRel, k = r.k
    const f1 = this.pairValue(q, ids[0], ids[1]), t1 = this.pairValue(q, ids[2], ids[3])
    const f2 = this.pairValue(q, ids[k], ids[k + 1]), t2 = this.pairValue(q, ids[k + 2], ids[k + 3])
    if (f1 < 0 || t1 < 0 || f2 < 0 || t2 < 0) return false
    // Gather the four terms, adding equal values.
    const terms = this.terms, coefs = this.coefs
    let n = 0
    const vs = [t1, f1, t2, f2], signs = [1, -1, -1, 1]
    for (let j = 0; j < 4; j++) {
      let i = 0
      while (i < n && terms[i] !== vs[j]) i++
      if (i === n) { terms[n] = vs[j]; coefs[n] = 0; n++ }
      coefs[i] += signs[j]
    }
    const cached = this.latticeFor(r)
    // Each nonzero term as (unknown, coefficient), sorted by unknown (insertion sort: four at most).
    const idx = this.idx, cs = this.cs
    let m = 0
    for (let i = 0; i < n; i++) {
      if (coefs[i] === 0) continue
      const u = cached.unknown.get(terms[i])
      if (u === undefined) return false
      let j = m++
      while (j > 0 && idx[j - 1] > u) { idx[j] = idx[j - 1]; cs[j] = cs[j - 1]; j-- }
      idx[j] = u; cs[j] = coefs[i]
    }
    if (!m) return true
    // The equation as a key: 13 bits a term (unknown, coefficient) when they fit, else a string.
    let key: number | string = 0
    let fits = true
    for (let i = 0; i < m; i++) if (idx[i] >= 1024 || cs[i] < -4 || cs[i] >= 4) fits = false
    if (fits) for (let i = 0; i < m; i++) key = key * 8192 + idx[i] * 8 + (cs[i] + 4)
    else { key = ''; for (let i = 0; i < m; i++) key += idx[i] + ':' + cs[i] + ' ' }
    let v = cached.byEquation.get(key)
    if (v === undefined) {
      const vec: Vector = new Map()
      for (let i = 0; i < m; i++) vec.set(idx[i], cs[i])
      cached.byEquation.set(key, v = cached.lattice.contains(vec))
    }
    return v
  }

  private feedBackDifferences(): boolean {
    let changed = false
    for (const [p, d] of this.prep.structure.differences) {
      if (!d.faithful || !d.pairs) continue
      const e = this.prep.structure.equivalences.get(p)
      if (!e) continue
      const r = this.rel(p, 2 * e.k)
      if (!r.classes || !r.classes.members.size) continue
      const cached = this.latticeFor(r)
      const keys = [...cached.unknown.keys()]
      const [a, b, c, dd] = d.faithful.head.args
      const guards = d.faithful.body.filter(x => x.name !== p)
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const v: Vector = new Map([[cached.unknown.get(keys[i])!, 1], [cached.unknown.get(keys[j])!, -1]])
        const cert = this.recording ? cached.lattice.certificate(v) : null
        if (this.recording ? !cert : !cached.lattice.contains(v)) continue
        const [x1, x2] = this.pairOfKey(r.pairsRel, keys[i]), [y1, y2] = this.pairOfKey(r.pairsRel, keys[j])
        const bind = new Map([[a, x1], [b, x2], [c, y1], [dd, y2]])
        const ground = guards.map(g => ({ name: g.name, args: g.args.map(v2 => bind.get(v2) ?? v2) }))
        if (!ground.every(g => this.holds(g))) continue
        if (cert) this.cause = this.solverCause(r, cert, cached.atoms, ground)
        changed = this.assert({ name: d.pairs, args: [x1, x2, y1, y2] }) || changed
        this.cause = GIVEN
      }
    }
    return changed
  }

  /** The two points (names) of an unknown's key. */
  private pairOfKey(q: Rel | null, key: number): [string, string] {
    const t = q && q.kind === 'equiv' ? unpackOf(key, 2) : [Math.floor(key / NB), key % NB]
    return [this.names[t[0]], this.names[t[1]]]
  }

  private sumValue(q: Rel, a: number, b: number): number {
    if (this.find(a) === this.find(b)) return -1
    this.pr[0] = a; this.pr[1] = b
    return this.root(this.classesOf(q), this.tupleKey(q, this.pr, 0))
  }

  private sumVector(q: Rel, unknown: Map<number, number>, pairOf: Map<number, [number, number]> | null, args: ArrayLike<number>): Vector {
    const v: Vector = new Map()
    const cs = [1, 1, -1]
    for (let i = 0; i < 3; i++) {
      const a = args[2 * i], b = args[2 * i + 1]
      const key = this.sumValue(q, a, b)
      if (key < 0) continue
      let k = unknown.get(key)
      if (k === undefined) { unknown.set(key, k = unknown.size); pairOf?.set(key, [a, b]) }
      const x = (v.get(k) ?? 0) + cs[i]
      if (x === 0) v.delete(k)
      else v.set(k, x)
    }
    return v
  }

  private sumLattices = new Map<Rel, { stamp: string; lattice: Lattice; unknown: Map<number, number>; pairOf: Map<number, [number, number]>; byEquation: Map<string, boolean>; atoms: GroundPredicate[] }>()
  private sumLattice(r: Rel) {
    let cached = this.sumLattices.get(r)
    const stamp = this.solverStamp(r)
    if (!cached || cached.stamp !== stamp) {
      const lattice = new Lattice(), unknown = new Map<number, number>(), pairOf = new Map<number, [number, number]>()
      const atoms: GroundPredicate[] = []
      for (const f of r.facts) { lattice.add(this.sumVector(r.pairsRel!, unknown, pairOf, f)); atoms.push({ name: r.name, args: Array.from(f, x => this.names[x]) }) }
      this.sumLattices.set(r, cached = { stamp, lattice, unknown, pairOf, byEquation: new Map(), atoms })
    }
    return cached
  }

  private sumHolds(r: Rel, ids: ArrayLike<number>): boolean {
    const cached = this.sumLattice(r)
    const unknown = new Map(cached.unknown)
    const vec = this.sumVector(r.pairsRel!, unknown, null, ids)
    // A value no equation mentions cannot cancel.
    for (const u of vec.keys()) if (u >= cached.unknown.size) return false
    const key = [...vec].sort((a, b) => a[0] - b[0]).map(([u, c]) => u + ':' + c).join(' ')
    let v = cached.byEquation.get(key)
    if (v === undefined) cached.byEquation.set(key, v = cached.lattice.contains(vec))
    return v
  }

  private feedBackSums(): boolean {
    let changed = false
    for (const [p, sum] of this.prep.structure.sums) {
      const r = this.rels.get(p + '/6')
      if (!r || !r.facts.length) continue
      const cached = this.sumLattice(r)
      const keys = [...cached.unknown.keys()]
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const pi = cached.pairOf.get(keys[i])!, pj = cached.pairOf.get(keys[j])!
        if (this.sumValue(r.pairsRel!, pi[0], pi[1]) === this.sumValue(r.pairsRel!, pj[0], pj[1])) continue
        const v: Vector = new Map([[cached.unknown.get(keys[i])!, 1], [cached.unknown.get(keys[j])!, -1]])
        const cert = this.recording ? cached.lattice.certificate(v) : null
        if (this.recording ? !cert : !cached.lattice.contains(v)) continue
        if (cert) this.cause = this.solverCause(r, cert, cached.atoms, [])
        changed = this.assert({ name: sum.values, args: [pi[0], pi[1], pj[0], pj[1]].map(x => this.names[x]) }) || changed
        this.cause = GIVEN
      }
    }
    return changed
  }

  /** Let the solvers hand back what they show, firing no rule (proof.ts's replay). */
  settle(): boolean {
    let changed = false
    while (this.feedBackDifferences() || this.feedBackSums()) changed = true
    return changed
  }

  // ───────────────────────── compiling ─────────────────────────

  private compile(body: readonly Predicate[], head: Predicate | null, rule: Rule | null, brk: { order: string[]; perms: Map<string, string>[] } | undefined): Compiled {
    const slot = new Map<string, number>()
    const s = (v: string) => { let i = slot.get(v); if (i === undefined) slot.set(v, i = slot.size); return i }
    const atoms: Atom[] = body.map(a => {
      const rel = this.rel(a.name, a.args.length)
      return { rel, slots: Int32Array.from(a.args, s), name: a.name, diff: rel.kind === 'equiv' && !!rel.difference }
    })
    const h = head ? { rel: this.rel(head.name, head.args.length), slots: Int32Array.from(head.args, s), name: head.name, diff: false } : null
    const headVars = h ? [...new Set(h.slots)] : []
    const headLiteral = headVars.map(v => h!.slots.some((x, i) => x === v && !h!.rel.mask[i]))
    if (atoms.length > 30) throw new CoreRefused('a body of more than 30 atoms')
    const inBody = new Set(body.flatMap(b => b.args))
    const st = this.prep.structure
    const checkable = !!head && head.args.every(a => inBody.has(a)) && head.name !== OBJECT && !this.prep.defined.has(head.name)
      && !st.differences.has(head.name) && !st.sums.has(head.name)
    return {
      rule, atoms, nvars: slot.size, head: h, headVars, headLiteral,
      headPos: h ? Int32Array.from(h.slots, x => headVars.indexOf(x)) : new Int32Array(0),
      checkable,
      brkOrder: brk ? Int32Array.from(brk.order.filter(v => slot.has(v)), v => slot.get(v)!) : null,
      brkPerms: brk ? brk.perms.map(p => { const a = new Int32Array(slot.size); for (const [v, i] of slot) a[i] = slot.get(p.get(v) ?? v) ?? i; return a }) : [],
      names: [...slot.keys()],
    }
  }

  // ───────────────────────── bindings ─────────────────────────

  private ensure(n: number) {
    if (this.val.length >= n) return
    const m = Math.max(n, this.val.length * 2)
    const v = new Int32Array(m); v.set(this.val); this.val = v
    const f = new Uint8Array(m); f.set(this.flex); this.flex = f
    const b = new Uint8Array(m); b.set(this.bound); this.bound = b
  }
  private bind(x: number, v: number, flex: number) {
    this.trail.push(x, this.val[x], this.flex[x], this.bound[x])
    this.val[x] = v; this.flex[x] = flex; this.bound[x] = 1
  }
  private undo(mark: number) {
    const t = this.trail
    while (t.length > mark) {
      const b = t.pop()!, f = t.pop()!, v = t.pop()!, x = t.pop()!
      this.val[x] = v; this.flex[x] = f; this.bound[x] = b
    }
  }

  /** Unify `n` arguments of an atom, from `at`, with `tuple` from `off` (saturate.ts's `unifyArgs`). */
  private unify(slots: Int32Array, mask: boolean[], at: number, tuple: ArrayLike<number>, off: number, n: number): boolean {
    for (let i = 0; i < n; i++) {
      const pos = at + i, x = slots[pos], v = tuple[off + i]
      if (!this.bound[x]) this.bind(x, mask[pos] ? this.find(v) : v, mask[pos] ? 1 : 0)
      else if (mask[pos]) { if (this.find(this.val[x]) !== this.find(v)) return false }
      else if (!this.flex[x]) { if (this.val[x] !== v) return false }
      else { if (this.find(v) !== this.find(this.val[x])) return false; this.bind(x, v, 0) }
    }
    return true
  }

  // ───────────────────────── matching ─────────────────────────

  private leastSoFar(c: Compiled): boolean {
    const order = c.brkOrder!, rank = this.rank()
    for (const perm of c.brkPerms) {
      for (let i = 0; i < order.length; i++) {
        const x = order[i], y = perm[x]
        if (!this.bound[x] || !this.bound[y]) break
        const u = this.val[x], v = this.val[y]
        if (u === v) continue
        if (rank[u] > rank[v]) return false
        break
      }
    }
    return true
  }

  private headVals = new Int32Array(16)
  /** Join the atoms in the bit mask `todo`; `emit` returns true to stop. Returns true if stopped. */
  private join(c: Compiled, todo: number, emit: () => boolean): boolean {
    this.work++
    if (c.brkOrder && !this.leastSoFar(c)) return false
    if (todo === 0) return emit()
    if (c.checkable && this.headHolds(c)) return false
    let best = -1, bestScore = -Infinity
    for (let j = 0, m = todo; m; j++, m >>>= 1) {
      if (!(m & 1)) continue
      const a = c.atoms[j], sl = a.slots
      let b = 0
      for (let i = 0; i < sl.length; i++) if (this.bound[sl[i]]) b++
      let score = b / Math.max(1, sl.length)
      if (a.diff && b < sl.length) score -= 1
      if (score > bestScore) { best = j; bestScore = score }
    }
    const a = c.atoms[best], rest = todo & ~(1 << best)
    const kind = a.rel.kind
    if (kind === 'eq') return this.matchEq(c, a, rest, emit)
    if (kind === 'equiv') {
      if (a.diff) {
        let all = true
        for (let i = 0; i < a.slots.length; i++) if (!this.bound[a.slots[i]]) { all = false; break }
        if (all) {
          const vals = this.headVals.subarray(0, a.slots.length)
          for (let i = 0; i < vals.length; i++) vals[i] = this.val[a.slots[i]]
          return this.holdsIds(a.rel, vals) ? this.join(c, rest, emit) : false
        }
      }
      return this.matchEquiv(c, a, a.rel, rest, emit, 0)
    }
    if (kind === 'flip') return this.matchEquiv(c, a, a.rel.of!, rest, emit, 1)
    return this.matchStored(c, a, rest, emit)
  }

  /** The early head check: every head variable bound, none a class at a literal position, and the head holds. */
  private headHolds(c: Compiled): boolean {
    const hv = c.headVars
    for (let i = 0; i < hv.length; i++) {
      const x = hv[i]
      if (!this.bound[x] || (this.flex[x] && c.headLiteral[i])) return false
    }
    const h = c.head!, vals = this.headVals
    for (let p = 0; p < h.slots.length; p++) vals[p] = this.val[h.slots[p]]
    return this.holdsIds(h.rel, vals.subarray(0, h.slots.length))
  }

  private pair = new Int32Array(2)
  private matchEq(c: Compiled, a: Atom, rest: number, emit: () => boolean): boolean {
    const s0 = a.slots[0], s1 = a.slots[1]
    const cands = this.bound[s0] ? [this.find(this.val[s0])] : this.bound[s1] ? [this.find(this.val[s1])] : this.reps()
    const pair = this.pair
    for (let j = 0; j < cands.length; j++) {
      pair[0] = cands[j]; pair[1] = cands[j]
      const mark = this.trail.length
      if (this.unify(a.slots, a.rel.mask, 0, pair, 0, 2) && this.join(c, rest, emit)) { this.undo(mark); return true }
      this.undo(mark)
    }
    return false
  }

  private static EMPTY: Int32Array[] = []
  private matchStored(c: Compiled, a: Atom, rest: number, emit: () => boolean): boolean {
    const r = a.rel, sl = a.slots, n = sl.length
    let list: Int32Array[] | null = null
    for (let i = 0; i < n; i++) {
      const x = sl[i]
      if (!this.bound[x] || (!r.mask[i] && this.flex[x])) continue
      const l = r.index.get(i * NB + (r.mask[i] ? this.find(this.val[x]) : this.val[x])) ?? Core.EMPTY
      if (!list || l.length < list.length) list = l
      if (l.length === 0) return false
    }
    const tryOne = (t: Int32Array): boolean => {
      const mark = this.trail.length
      const stop = this.unify(sl, r.mask, 0, t, 0, n) && this.join(c, rest, emit)
      this.undo(mark)
      return stop
    }
    if (list) { for (let j = 0; j < list.length; j++) if (tryOne(list[j])) return true; return false }
    const images = r.images
    for (let j = 0; j < images.length; j++) if (tryOne(images[j])) return true
    return false
  }

  /**
   * An equivalence's atom (or its flip's, `want` 1), as saturate.ts's `matchEquivalence`: `q` is the
   * equivalence, `a` the atom (whose relation may be the flip).
   */
  private matchEquiv(c: Compiled, a: Atom, q: Rel, rest: number, emit: () => boolean, want: number): boolean {
    const k = q.k, mask = a.rel.mask, mask0 = mask[0], sl = a.slots
    const cls = this.classesOf(q)
    const signed = q.signed
    const fits = (x: number, y: number) => !signed || this.fits(cls, want, x, y)
    const tryPair = (x: ArrayLike<number>, y: ArrayLike<number>) => this.tryPair(c, sl, mask, k, rest, emit, x, y)
    const first = this.exact(sl, mask0, 0, k), second = first ? null : this.exact(sl, mask0, k, k)
    const known = first ?? second
    if (known) {
      const knownKey = this.tupleKey(q, known, 0)
      const rt = this.root(cls, knownKey)
      for (const m of cls.members.get(rt) ?? [rt]) {
        if (!fits(knownKey, m)) continue
        for (const img of this.imagesOf(q, m)) if (first ? tryPair(known, img) : tryPair(img, known)) return true
      }
      return false
    }
    let pick: { side: number; j: number; v: number; keys: number[] } | null = null
    for (let side = 0; side < 2; side++) for (let j = 0; j < k; j++) {
      const x = sl[side * k + j]
      if (!this.bound[x] || (!mask0 && this.flex[x])) continue
      const v = mask0 ? this.find(this.val[x]) : this.val[x]
      const keys = cls.index.get(j * NB + v) ?? []
      if (!pick || keys.length < pick.keys.length) pick = { side, j, v, keys }
    }
    if (pick) {
      for (const m of pick.keys) {
        const xs = this.imagesOf(q, m).filter(x => x[pick!.j] === pick!.v)
        if (!xs.length) continue
        const rt = this.root(cls, m)
        for (const mm of cls.members.get(rt) ?? [rt]) {
          if (!fits(m, mm)) continue
          for (const y of this.imagesOf(q, mm)) for (const x of xs) {
            if (pick.side === 0 ? tryPair(x, y) : tryPair(y, x)) return true
          }
        }
      }
    } else {
      // Each class once: its root is the key that is its own parent.
      for (const [key, up] of cls.parent) {
        if (up !== key) continue
        const rt = key
        const ms = cls.members.get(rt) ?? [rt]
        for (const m1 of ms) for (const m2 of ms) {
          if (!fits(m1, m2)) continue
          for (const x of this.imagesOf(q, m1)) for (const y of this.imagesOf(q, m2)) if (tryPair(x, y)) return true
        }
      }
    }
    // A tuple never mentioned is a class of its own: it matches only reflexively, never as its own flip.
    if (want === 1) return false
    const pool = mask0 ? this.reps() : this.namesOrder
    const unboundIn = (from: number) => { let n = 0; for (let i = 0; i < k; i++) if (!this.bound[sl[from + i]]) n++; return n }
    const from = unboundIn(0) <= unboundIn(k) ? 0 : k
    const choices: number[][] = []
    for (let i = 0; i < k; i++) {
      const x = sl[from + i]
      if (!this.bound[x]) choices.push(pool)
      else choices.push(mask0 ? [this.find(this.val[x])] : this.flex[x] ? this.membersOf(this.find(this.val[x])) : [this.val[x]])
    }
    const t = new Int32Array(k)
    const rec = (i: number): boolean => {
      if (i === k) {
        if (cls.parent.has(this.tupleKey(q, t, 0))) return false
        for (const y of this.orbitsOfBlock(q, t)) if (from === 0 ? tryPair(t, y) : tryPair(y, t)) return true
        return false
      }
      for (const v of choices[i]) { t[i] = v; if (rec(i + 1)) return true }
      return false
    }
    return rec(0)
  }

  private fits(cls: Classes, want: number, x: number, y: number): boolean {
    const rx = this.root(cls, x), px = this.lastParity
    if (cls.odd!.has(rx)) return true
    this.root(cls, y)
    return (px ^ this.lastParity) === want
  }
  private tryPair(c: Compiled, sl: Int32Array, mask: boolean[], k: number, rest: number, emit: () => boolean, x: ArrayLike<number>, y: ArrayLike<number>): boolean {
    const mark = this.trail.length
    const stop = this.unify(sl, mask, 0, x, 0, k) && this.unify(sl, mask, k, y, 0, k) && this.join(c, rest, emit)
    this.undo(mark)
    return stop
  }
  /** A block's values when every one is bound exactly (or as a class, where equals substitute), else null. */
  private exact(sl: Int32Array, mask0: boolean, from: number, k: number): Int32Array | null {
    for (let i = 0; i < k; i++) {
      const x = sl[from + i]
      if (!this.bound[x] || (!mask0 && this.flex[x])) return null
    }
    const out = new Int32Array(k)
    for (let i = 0; i < k; i++) out[i] = this.val[sl[from + i]]
    return out
  }

  private orbitsOfBlock(q: Rel, t: Int32Array): Int32Array[] {
    const seen = new Set<number>(), out: Int32Array[] = []
    for (const perm of q.group) { const k = packOf(t, perm) as number; if (!seen.has(k)) { seen.add(k); out.push(Int32Array.from(perm, i => t[i])) } }
    return out
  }

  // ───────────────────────── saturation ─────────────────────────

  private lastCheckFull = true
  private done(full = true): boolean {
    this.lastCheckFull = full
    const goal = this.opts.goal
    if (goal && (full || !this.prep.defined.has(goal.name)) && this.holds(goal)) return true
    if (this.derivations >= (this.opts.maxDerivations ?? 200_000) || this.work >= (this.opts.maxWork ?? MAX_WORK)) { this.exhausted = true; return true }
    return false
  }

  /** Where a run stopped inside a round, as saturate.ts keeps it, so `resume` carries on from there. */
  private round: { i: number; before: number; c: Compiled | null; snaps: number[]; full: Int32Array[]; count: number; m: number } | null = null

  run(): void {
    const rules = this.compiled
    for (;;) {
      if (!this.round) {
        if (this.done()) return
        this.round = { i: 0, before: this.version, c: null, snaps: [], full: [], count: 0, m: 0 }
      }
      const r = this.round
      while (r.i < rules.length) {
        const c = rules[r.i]
        if (r.c !== c) {
          if (this.lastRun.get(c) === this.version) { r.i++; continue }
          this.lastRun.set(c, this.version)
          // Materialise the matches first: asserting changes what is matched against.
          this.ensure(c.nvars)
          const hv = c.headVars, snaps: number[] = [], full: Int32Array[] = []
          let count = 0
          this.join(c, (1 << c.atoms.length) - 1, () => {
            count++
            for (const x of hv) snaps.push(this.bound[x] ? this.val[x] : -1, this.flex[x])
            if (this.recording) full.push(this.val.slice(0, c.nvars))
            return false
          })
          this.matches += count
          r.c = c; r.snaps = snaps; r.full = full; r.count = count; r.m = 0
        }
        while (r.m < r.count) {
          if (this.recording) this.cause = this.ruleCause(c, r.full[r.m])
          this.assertMatch(c, r.snaps, r.m++)
          this.cause = GIVEN
          if (this.done(false)) return
        }
        r.c = null; r.snaps = []; r.full = []; r.count = 0
        r.i++
        if (this.done()) return
      }
      this.round = null
      const fedDifferences = this.feedBackDifferences(), fedSums = this.feedBackSums()
      const fed = fedDifferences || fedSums
      if (this.done()) return
      if (this.version === r.before && !fed) return
    }
  }

  /** The heads of one match (saturate.ts's `heads`): a class where equals do not substitute is each of its members. */
  private assertMatch(c: Compiled, snaps: number[], m: number): void {
    const hv = c.headVars, per = 2 * hv.length, head = c.head!, headPos = c.headPos
    const vals = new Int32Array(head.slots.length)
    let simple = true
    for (let i = 0; i < hv.length; i++) {
      const v = snaps[m * per + 2 * i], f = snaps[m * per + 2 * i + 1]
      if (v < 0 || (f && c.headLiteral[i])) { simple = false; break }
    }
    if (simple) {
      for (let p = 0; p < headPos.length; p++) {
        const i = headPos[p], v = snaps[m * per + 2 * i]
        vals[p] = snaps[m * per + 2 * i + 1] ? this.find(v) : v
      }
      this.derivations++
      this.assertIds(head.rel, vals)
      return
    }
    const choices = hv.map((_, i) => {
      const v = snaps[m * per + 2 * i], f = snaps[m * per + 2 * i + 1]
      if (v >= 0 && !f) return [v]
      if (v >= 0) return c.headLiteral[i] ? [...this.membersOf(this.find(v))] : [this.find(v)]
      return c.headLiteral[i] ? [...this.namesOrder] : [...this.reps()]
    })
    const pick = new Array<number>(hv.length)
    const all: Int32Array[] = []
    const rec = (i: number) => {
      if (i === hv.length) { all.push(Int32Array.from(headPos, x => pick[x])); return }
      for (const v of choices[i]) { pick[i] = v; rec(i + 1) }
    }
    rec(0)
    for (const t of all) { this.derivations++; this.assertIds(head.rel, t) }
  }

  // ───────────────────────── provenance and explanation ─────────────────────────

  /** A match's cause: its rule, and its premises (worked out only if a fact is recorded). */
  private ruleCause(c: Compiled, vals: Int32Array): Cause {
    let premises: GroundPredicate[] | null = null
    return {
      kind: 'rule', rule: c.rule!,
      premises: () => premises ??= c.atoms.map(a => ({ name: a.name, args: Array.from(a.slots, x => this.names[vals[x]]) })),
    }
  }

  /**
   * A solver's step, taken when it acts: its equations and coefficients, and the equalities of values
   * they rely on as the store has them now (saturate.ts's `solverCause`).
   */
  private solverCause(r: Rel, cert: Map<number, number>, atoms: GroundPredicate[], guards: GroundPredicate[], fact?: GroundPredicate): SolverCause {
    const used = [...cert].filter(([, c]) => c !== 0)
    const equations = used.map(([i]) => atoms[i])
    const links = this.valueLinks(r, fact && fact.name === r.name ? [fact, ...equations] : equations)
    return { kind: 'solver', relation: r.name, equations, coefficients: used.map(([, c]) => c), guards, links }
  }

  /** The equalities of values a solver's equations rely on, each pair linked to the first of its value. */
  private valueLinks(r: Rel, atoms: readonly GroundPredicate[]): GroundPredicate[] {
    const value = r.difference ? (a: number, b: number) => this.pairValue(r.pairsRel, a, b) : r.sum ? (a: number, b: number) => this.sumValue(r.pairsRel!, a, b) : null
    const eqName = r.difference ? r.difference.pairs : r.sum ? r.sum.values : null
    if (!value) return []
    const first = new Map<number, [string, string]>()
    const out: GroundPredicate[] = []
    for (const f of atoms) for (let i = 0; i + 1 < f.args.length; i += 2) {
      const a = f.args[i], b = f.args[i + 1], v = value(this.id(a), this.id(b))
      if (v < 0) continue
      const f0 = first.get(v)
      if (!f0) { first.set(v, [a, b]); continue }
      if (f0[0] === a && f0[1] === b) continue
      if (eqName) out.push({ name: eqName, args: [...f0, a, b] })
      else if (this.eqName) for (const [x, y] of [[f0[0], a], [f0[1], b]]) if (x !== y) out.push({ name: this.eqName, args: [x, y] })
    }
    return out
  }

  /** Why `goal` holds, from what this search recorded (explain.ts). Needs `provenance`. */
  explain(goal: GroundPredicate, hypotheses: readonly GroundPredicate[]): Proof | null {
    if (!this.recording) throw new Error('the core explains only a search made with provenance')
    return explain(this.explainStore(), goal, hypotheses)
  }

  private explainStore(): ExplainStore {
    const st = this.prep.structure
    const ids = (args: readonly string[]) => args.map(a => this.id(a))
    return {
      equality: this.eqName,
      holds: f => this.holds(f),
      samePoint: (a, b) => this.find(this.id(a)) === this.find(this.id(b)),
      isDefined: name => this.prep.defined.has(name),
      definedInstance: f => {
        const atoms = expandDefined([{ name: f.name, args: [...f.args] }], this.prep.defined)
        const c = this.compile(atoms, null, null, undefined)
        this.ensure(c.nvars)
        const mark = this.trail.length
        for (let s = 0; s < c.nvars; s++) if (f.args.includes(c.names[s])) this.bind(s, this.id(c.names[s]), 1)
        let out: GroundPredicate[] | null = null
        this.join(c, (1 << c.atoms.length) - 1, () => {
          out = c.atoms.map(a => ({ name: a.name, args: Array.from(a.slots, x => this.names[this.val[x]]) }))
          return true
        })
        this.undo(mark)
        return out
      },
      merges: () => this.mergeRecords,
      equivalenceOf: f => {
        const flip = st.flips?.get(f.name)
        const q = flip ? flip.of : f.name
        const e = st.equivalences.get(q)
        return e && f.args.length === 2 * e.k ? { q, k: e.k, flip: !!flip } : null
      },
      blockKey: (q, block) => {
        const r = this.rel(q, 2 * block.length)
        return String(this.tupleKey(r, ids(block), 0))
      },
      unions: q => {
        const e = st.equivalences.get(q)
        return e ? this.rel(q, 2 * e.k).unions : []
      },
      differenceCause: f => {
        const r = this.rel(f.name, f.args.length)
        if (r.kind !== 'equiv' || !r.difference) return null
        const v: Vector = new Map(), x = ids(f.args)
        const cached = this.latticeFor(r)
        if (!this.blockVector(r.pairsRel, cached.unknown, x, 0, 1, v) || !this.blockVector(r.pairsRel, cached.unknown, x, r.k, -1, v)) return null
        const cert = cached.lattice.certificate(v)
        return cert ? this.solverCause(r, cert, cached.atoms, [], f) : null
      },
      sumCause: f => {
        const r = this.rel(f.name, f.args.length)
        if (!r.sum) return null
        const cached = this.sumLattice(r)
        const cert = cached.lattice.certificate(this.sumVector(r.pairsRel!, new Map(cached.unknown), null, ids(f.args)))
        return cert ? this.solverCause(r, cert, cached.atoms, [], f) : null
      },
      reasonOf: f => {
        const r = this.rel(f.name, f.args.length)
        return r.kind === 'stored' ? r.reasons.get(this.canonKey(r, ids(f.args))) : undefined
      },
      original: rule => this.prep.origins?.get(rule) ?? rule,
    }
  }

  /** Carry the search on towards another goal (saturate.ts's `resume`). */
  resume(goal: GroundPredicate): void {
    this.opts = { ...this.opts, goal }
    this.exhausted = false
    if (this.done(this.lastCheckFull)) return
    this.run()
  }
}
