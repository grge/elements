/**
 * The matching-core spike (review-notes.md, *Cold-start search*; roadmap): the same forward closure
 * as `saturate.ts`, on integers. It takes the same `Prepared` rules (structure, definitions as
 * abbreviations, rule symmetries) and computes the same closure, rule by rule and round by round, so
 * that `scripts/prototypes/fastcore-compare.ts` can check it fact for fact against `Saturation`.
 *
 * What is different is only how it is done:
 *   - points are small integers, and a tuple is a packed number (base 128, position 0 first, so
 *     numeric order is lexicographic order), never a joined string;
 *   - a rule is compiled once: its variables are numbered slots in typed arrays, bound and unbound
 *     by a trail, never by copying a map; no generators;
 *   - every stored relation is indexed by (position, value), and every equivalence by (position in
 *     a block, value), so a bound argument is a lookup;
 *   - canonical forms are the least packed image under the relation's group.
 *
 * Out of the spike: the solvers (differences, sums), so knowledge bases that have them are refused.
 */
import type { Rule } from '../../src/language/parser'
import type { GroundPredicate } from '../../src/kb/inference'
import { expandDefined, type Prepared } from '../../src/kb/saturate'

const B = 128
const OBJECT = '__object__'

function pack(vals: ArrayLike<number>, perm?: readonly number[]): number {
  let k = 0
  if (perm) for (let i = 0; i < perm.length; i++) k = k * B + vals[perm[i]]
  else for (let i = 0; i < vals.length; i++) k = k * B + vals[i]
  return k
}
function unpack(k: number, n: number): Int32Array {
  const out = new Int32Array(n)
  for (let i = n - 1; i >= 0; i--) { out[i] = k % B; k = Math.floor(k / B) }
  return out
}

/** A relation as the store keeps it. */
class Rel {
  kind: 'eq' | 'equiv' | 'stored' = 'stored'
  arity: number
  mask: boolean[]
  /** stored: its symmetry group (or the identity); equiv: its block group. */
  group: number[][]
  k = 0
  // stored
  keys = new Set<number>()
  facts: Int32Array[] = []
  images: Int32Array[] = []
  index = new Map<number, Int32Array[]>()
  // equivalence: union-find over packed block keys
  parent = new Map<number, number>()
  members = new Map<number, number[]>()
  imageCache = new Map<number, Int32Array[]>()
  tindex = new Map<number, number[]>()
  constructor(readonly name: string, arity: number) { this.arity = arity; this.mask = Array(arity).fill(false); this.group = [Array.from({ length: arity }, (_, i) => i)] }
}

interface Atom { rel: Rel; slots: Int32Array }
interface Compiled {
  rule: Rule | null
  atoms: Atom[]
  nvars: number
  head: Atom | null
  /** Per head variable (slot), whether it stands at a position that does not admit substitution. */
  headVars: number[]
  headLiteral: boolean[]
  /** Per head argument, the index of its variable in headVars. */
  headPos: Int32Array
  brkOrder: Int32Array | null
  brkPerms: Int32Array[]
  names: string[]
}

export interface CoreOptions { goal?: GroundPredicate; maxDerivations?: number; maxWork?: number }

export class Core {
  // objects
  names: string[] = []
  private ids = new Map<string, number>()
  private up: number[] = []
  private classOf = new Map<number, number[]>()
  private repsCache: number[] | null = null
  private introduced: number[] = []

  private rels = new Map<string, Rel>()
  private compiled: Compiled[]
  private lastRun = new Map<Compiled, number>()
  private version = 0
  derivations = 0
  work = 0
  matches = 0
  exhausted = false
  private eqName: string | null

  // bindings
  private val = new Int32Array(64)
  private flex = new Uint8Array(64)
  private bound = new Uint8Array(64)
  private trail: number[] = []

  constructor(private readonly prep: Prepared, private readonly opts: CoreOptions = {}) {
    const st = prep.structure
    if (st.differences.size || st.sums.size) throw new Error('the spike has no solvers')
    this.eqName = st.equality
    this.compiled = [...prep.axioms, ...prep.rules].map(r => this.compile(r.body, r.head, r, prep.breaks.get(r)))
  }

  // ───────────────────────── objects ─────────────────────────

  private id(name: string): number {
    let i = this.ids.get(name)
    if (i === undefined) {
      i = this.names.length
      if (i >= B) throw new Error('more than 128 points')
      this.ids.set(name, i); this.names.push(name); this.up.push(i)
    }
    return i
  }

  find(x: number): number {
    while (this.up[x] !== x) { this.up[x] = this.up[this.up[x]]; x = this.up[x] }
    return x
  }

  private introduceName(n: string): boolean {
    const known = this.ids.has(n)
    const i = this.id(n)
    if (known && this.introduced[i]) return false
    this.introduced[i] = 1 as any
    this.repsCache = null
    this.version++
    return true
  }

  private namesList(): number[] { const out: number[] = []; for (let i = 0; i < this.names.length; i++) if (this.introduced[i]) out.push(i); return out }
  private reps(): number[] {
    if (!this.repsCache) this.repsCache = this.namesList().filter(i => this.find(i) === i)
    return this.repsCache
  }
  private membersOf(rep: number): number[] { return this.classOf.get(rep) ?? [rep] }

  private merge(a: number, b: number): boolean {
    const ra = this.find(a), rb = this.find(b)
    if (ra === rb) return false
    const [win, lose] = ra < rb ? [ra, rb] : [rb, ra]
    this.up[lose] = win
    this.classOf.set(win, [...this.membersOf(win), ...this.membersOf(lose)])
    this.classOf.delete(lose)
    this.repsCache = null
    this.renormalise()
    return true
  }

  private renormalise(): void {
    for (const r of this.rels.values()) {
      if (r.kind === 'stored') {
        const old = r.facts
        r.keys = new Set(); r.facts = []; r.images = []; r.index = new Map()
        for (const f of old) this.store(r, this.canon(r, f))
      } else if (r.kind === 'equiv') {
        const old = r.parent
        const rootOld = (k: number) => { let x = k; for (let p = old.get(x); p !== undefined && p !== x; p = old.get(x)) x = p; return x }
        r.parent = new Map(); r.members = new Map(); r.tindex = new Map()
        const remap = (key: number) => this.tupleKey(r, unpack(key, r.k))
        for (const key of old.keys()) this.union(r, remap(key), remap(rootOld(key)))
      }
    }
    this.version++
  }

  // ───────────────────────── relations ─────────────────────────

  private rel(name: string, arity: number): Rel {
    const key = name + '/' + arity
    let r = this.rels.get(key)
    if (r) return r
    r = new Rel(name, arity)
    const st = this.prep.structure
    const m = st.congruent.get(name)
    if (m && m.length === arity) r.mask = [...m]
    const e = st.equivalences.get(name)
    if (name === this.eqName && arity === 2) r.kind = 'eq'
    else if (e && arity === 2 * e.k) { r.kind = 'equiv'; r.k = e.k; r.group = e.blockGroup }
    else {
      const g = st.symmetries.get(name)
      if (g && g[0].length === arity) r.group = g
    }
    this.rels.set(key, r)
    return r
  }

  /** The canonical form of a stored relation's tuple: equals substituted, then the least image. */
  private canon(r: Rel, vals: ArrayLike<number>): Int32Array {
    const t = new Int32Array(vals.length)
    for (let i = 0; i < t.length; i++) t[i] = r.mask[i] ? this.find(vals[i]) : vals[i]
    if (r.group.length === 1) return t
    let best = -1, bestPerm = r.group[0]
    for (const perm of r.group) { const k = pack(t, perm); if (best < 0 || k < best) { best = k; bestPerm = perm } }
    return Int32Array.from(bestPerm, i => t[i])
  }

  private store(r: Rel, t: Int32Array): boolean {
    const key = pack(t)
    if (r.keys.has(key)) return false
    r.keys.add(key)
    r.facts.push(t)
    const seen = new Set<number>()
    for (const perm of r.group) {
      const k = pack(t, perm)
      if (seen.has(k)) continue
      seen.add(k)
      const img = Int32Array.from(perm, i => t[i])
      r.images.push(img)
      for (let i = 0; i < img.length; i++) {
        const ix = i * B + img[i]
        let l = r.index.get(ix)
        if (!l) r.index.set(ix, l = [])
        l.push(img)
      }
    }
    return true
  }

  /** A block's key: equals substituted (if the relation admits it), the least image under the block group. */
  private scratch = new Int32Array(8)
  private tupleKey(r: Rel, vals: ArrayLike<number>, from = 0): number {
    const t = this.scratch, sub = r.mask[0], g = r.group
    for (let i = 0; i < r.k; i++) t[i] = sub ? this.find(vals[from + i]) : vals[from + i]
    let best = -1
    for (let q = 0; q < g.length; q++) { const k = pack(t, g[q]); if (best < 0 || k < best) best = k }
    return best
  }

  private root(r: Rel, k: number): number {
    let x = k
    for (let p = r.parent.get(x); p !== undefined && p !== x; p = r.parent.get(x)) x = p
    return x
  }

  private imagesOf(r: Rel, key: number): Int32Array[] {
    let out = r.imageCache.get(key)
    if (!out) {
      const t = unpack(key, r.k), seen = new Set<number>()
      out = []
      for (const perm of r.group) { const k = pack(t, perm); if (!seen.has(k)) { seen.add(k); out.push(Int32Array.from(perm, i => t[i])) } }
      r.imageCache.set(key, out)
    }
    return out
  }

  private indexKey(r: Rel, key: number): void {
    for (const img of this.imagesOf(r, key)) for (let j = 0; j < r.k; j++) {
      const ix = j * B + img[j]
      let l = r.tindex.get(ix)
      if (!l) r.tindex.set(ix, l = [])
      if (l[l.length - 1] !== key) l.push(key)
    }
  }

  private union(r: Rel, k1: number, k2: number): boolean {
    const r1 = this.root(r, k1), r2 = this.root(r, k2)
    // A key reflexively asserted is still not mentioned (as in saturate.ts).
    if (r1 === r2) return false
    if (!r.parent.has(k1)) this.indexKey(r, k1)
    if (!r.parent.has(k2) && k2 !== k1) this.indexKey(r, k2)
    const [win, lose] = r1 < r2 ? [r1, r2] : [r2, r1]
    const wm = r.members.get(win) ?? [win]
    for (const m of r.members.get(lose) ?? [lose]) wm.push(m)
    r.members.set(win, wm)
    r.members.delete(lose)
    r.parent.set(lose, win)
    if (!r.parent.has(win)) r.parent.set(win, win)
    return true
  }

  // ───────────────────────── asserting and asking ─────────────────────────

  /** Assert a fact given by names. */
  assert(f: GroundPredicate): boolean {
    this.derivations++
    let changed = false
    for (const a of f.args) changed = this.introduceName(a) || changed
    if (f.name === OBJECT) return changed
    const ids = f.args.map(a => this.ids.get(a)!)
    const c = this.assertIds(this.rel(f.name, f.args.length), ids)
    return c || changed
  }

  private assertIds(r: Rel, vals: ArrayLike<number>): boolean {
    let changed: boolean
    if (r.kind === 'eq') changed = this.merge(vals[0], vals[1])
    else if (r.kind === 'equiv') changed = this.union(r, this.tupleKey(r, vals, 0), this.tupleKey(r, vals, r.k))
    else changed = this.store(r, this.canon(r, vals))
    if (changed) this.version++
    return changed
  }

  holds(f: GroundPredicate): boolean {
    if (f.name === OBJECT) return f.args.every(a => this.ids.has(a) && this.introduced[this.ids.get(a)!])
    if (this.prep.defined.has(f.name)) return this.holdsDefined(f)
    if (f.args.some(a => !this.ids.has(a))) {
      if (f.name === this.eqName) return f.args[0] === f.args[1]
      return false
    }
    const ids = f.args.map(a => this.ids.get(a)!)
    const r = this.rel(f.name, f.args.length)
    if (r.kind === 'eq') return this.find(ids[0]) === this.find(ids[1])
    if (r.kind === 'equiv') return this.root(r, this.tupleKey(r, ids, 0)) === this.root(r, this.tupleKey(r, ids, r.k))
    return r.keys.has(pack(this.canon(r, ids)))
  }

  private definedCache = new Map<string, Compiled>()
  private holdsDefined(f: GroundPredicate): boolean {
    if (f.args.some(a => !this.ids.has(a))) return false
    const key = f.name + ' ' + f.args.join(' ')
    let c = this.definedCache.get(key)
    if (!c) {
      c = this.compile(expandDefined([{ name: f.name, args: [...f.args] }], this.prep.defined), null, null, undefined)
      this.definedCache.set(key, c)
    }
    // the atom's own names are bound, as saturate.ts binds them: each to itself, standing for its class
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

  /** Every stored fact, each object's equality with its representative, and each block's equivalence with its class's root. */
  allFacts(): GroundPredicate[] {
    const out: GroundPredicate[] = []
    const nm = (i: number) => this.names[i]
    for (const r of this.rels.values()) {
      if (r.kind === 'stored') for (const f of r.facts) out.push({ name: r.name, args: [...f].map(nm) })
      if (r.kind === 'equiv') for (const k of r.parent.keys()) {
        const root = this.root(r, k)
        if (root !== k) out.push({ name: r.name, args: [...unpack(k, r.k), ...unpack(root, r.k)].map(nm) })
      }
    }
    if (this.eqName) for (const i of this.namesList()) out.push({ name: this.eqName, args: [nm(i), nm(this.find(i))] })
    return out
  }

  // ───────────────────────── compiling ─────────────────────────

  private compile(body: { name: string; args: string[] }[], head: { name: string; args: string[] } | null, rule: Rule | null, brk: { order: string[]; perms: Map<string, string>[] } | undefined): Compiled {
    const slot = new Map<string, number>()
    const s = (v: string) => { let i = slot.get(v); if (i === undefined) slot.set(v, i = slot.size); return i }
    const atoms = body.map(a => ({ rel: this.rel(a.name, a.args.length), slots: Int32Array.from(a.args, s) }))
    const h = head ? { rel: this.rel(head.name, head.args.length), slots: Int32Array.from(head.args, s) } : null
    const headVars = h ? [...new Set(h.slots)] : []
    const headLiteral = headVars.map(v => h!.slots.some((x, i) => x === v && !h!.rel.mask[i]))
    if (atoms.length > 30) throw new Error('a body of more than 30 atoms')
    return {
      rule, atoms, nvars: slot.size, head: h, headVars, headLiteral,
      headPos: h ? Int32Array.from(h.slots, x => headVars.indexOf(x)) : new Int32Array(0),
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

  /** Unify `n` of an atom's arguments, from position `at`, with `tuple` from `off`. The caller undoes. */
  private unify(a: Atom, at: number, tuple: ArrayLike<number>, off: number, n: number): boolean {
    const mask = a.rel.mask
    for (let i = 0; i < n; i++) {
      const pos = at + i, x = a.slots[pos], v = tuple[off + i]
      if (!this.bound[x]) this.bind(x, mask[pos] ? this.find(v) : v, mask[pos] ? 1 : 0)
      else if (mask[pos]) { if (this.find(this.val[x]) !== this.find(v)) return false }
      else if (!this.flex[x]) { if (this.val[x] !== v) return false }
      else { if (this.find(v) !== this.find(this.val[x])) return false; this.bind(x, v, 0) }
    }
    return true
  }

  // ───────────────────────── matching ─────────────────────────

  private leastSoFar(c: Compiled): boolean {
    const order = c.brkOrder!
    for (const perm of c.brkPerms) {
      for (let i = 0; i < order.length; i++) {
        const x = order[i], y = perm[x]
        if (!this.bound[x] || !this.bound[y]) break
        const u = this.val[x], v = this.val[y]
        if (u === v) continue
        if (u > v) return false
        break
      }
    }
    return true
  }

  /** Join the atoms in the bit mask `todo`; `emit` returns true to stop. Returns true if stopped. */
  private join(c: Compiled, todo: number, emit: () => boolean): boolean {
    this.work++
    if (c.brkOrder && !this.leastSoFar(c)) return false
    if (todo === 0) return emit()
    let best = -1, bestScore = -1
    for (let j = 0, m = todo; m; j++, m >>>= 1) {
      if (!(m & 1)) continue
      const a = c.atoms[j], sl = a.slots
      let b = 0
      for (let i = 0; i < sl.length; i++) if (this.bound[sl[i]]) b++
      const score = b / (sl.length || 1)
      if (score > bestScore) { best = j; bestScore = score }
    }
    const a = c.atoms[best], rest = todo & ~(1 << best)
    const kind = a.rel.kind
    if (kind === 'eq') return this.matchEq(c, a, rest, emit)
    if (kind === 'equiv') return this.matchEquiv(c, a, rest, emit)
    return this.matchStored(c, a, rest, emit)
  }

  private pair = new Int32Array(2)
  private matchEq(c: Compiled, a: Atom, rest: number, emit: () => boolean): boolean {
    const s0 = a.slots[0], s1 = a.slots[1]
    const cands = this.bound[s0] ? [this.find(this.val[s0])] : this.bound[s1] ? [this.find(this.val[s1])] : this.reps()
    const pair = this.pair
    for (let j = 0; j < cands.length; j++) {
      pair[0] = cands[j]; pair[1] = cands[j]
      const mark = this.trail.length
      if (this.unify(a, 0, pair, 0, 2) && this.join(c, rest, emit)) { this.undo(mark); return true }
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
      const l = r.index.get(i * B + (r.mask[i] ? this.find(this.val[x]) : this.val[x])) ?? Core.EMPTY
      if (!list || l.length < list.length) list = l
      if (l.length === 0) return false
    }
    const cands = list ?? r.images
    for (let j = 0; j < cands.length; j++) {
      const mark = this.trail.length
      if (this.unify(a, 0, cands[j], 0, n) && this.join(c, rest, emit)) { this.undo(mark); return true }
      this.undo(mark)
    }
    return false
  }

  private tryPair(c: Compiled, a: Atom, rest: number, emit: () => boolean, x: ArrayLike<number>, y: ArrayLike<number>): boolean {
    const mark = this.trail.length, k = a.rel.k
    const ok = this.unify(a, 0, x, 0, k) && this.unify(a, k, y, 0, k) && this.join(c, rest, emit)
    this.undo(mark)
    return ok
  }

  private matchEquiv(c: Compiled, a: Atom, rest: number, emit: () => boolean): boolean {
    const r = a.rel, k = r.k, mask0 = r.mask[0]
    const exact = (from: number): Int32Array | null => {
      const out = new Int32Array(k)
      for (let i = 0; i < k; i++) {
        const x = a.slots[from + i]
        if (!this.bound[x] || (!mask0 && this.flex[x])) return null
        out[i] = this.val[x]
      }
      return out
    }
    const first = exact(0), second = first ? null : exact(k)
    const known = first ?? second
    const tryPair = (x: ArrayLike<number>, y: ArrayLike<number>) => this.tryPair(c, a, rest, emit, x, y)
    if (known) {
      const root = this.root(r, this.tupleKey(r, known))
      for (const m of r.members.get(root) ?? [root]) for (const img of this.imagesOf(r, m)) {
        if (first ? tryPair(known, img) : tryPair(img, known)) return true
      }
      return false
    }
    // Some argument bound exactly: only blocks whose images have that value there (an index).
    let pick: { side: number; j: number; v: number; keys: number[] } | null = null
    for (let side = 0; side < 2; side++) for (let j = 0; j < k; j++) {
      const x = a.slots[side * k + j]
      if (!this.bound[x] || (!mask0 && this.flex[x])) continue
      const v = mask0 ? this.find(this.val[x]) : this.val[x]
      const keys = r.tindex.get(j * B + v) ?? []
      if (!pick || keys.length < pick.keys.length) pick = { side, j, v, keys }
    }
    if (pick) {
      for (const m of pick.keys) {
        this.work++
        const root = this.root(r, m)
        const xs = this.imagesOf(r, m).filter(x => x[pick!.j] === pick!.v)
        if (!xs.length) continue
        for (const mm of r.members.get(root) ?? [root]) for (const y of this.imagesOf(r, mm)) for (const x of xs) {
          if (pick.side === 0 ? tryPair(x, y) : tryPair(y, x)) return true
        }
      }
    } else {
      const seen = new Set<number>()
      for (const key of r.parent.keys()) {
        this.work++
        const root = this.root(r, key)
        if (seen.has(root)) continue
        seen.add(root)
        const tuples = (r.members.get(root) ?? [root]).flatMap(m => this.imagesOf(r, m))
        for (const x of tuples) for (const y of tuples) if (tryPair(x, y)) return true
      }
    }
    // A tuple never mentioned is a class of its own: it matches only reflexively (as saturate.ts).
    const pool = mask0 ? this.reps() : this.namesList()
    const unboundIn = (from: number) => { let n = 0; for (let i = 0; i < k; i++) if (!this.bound[a.slots[from + i]]) n++; return n }
    const from = unboundIn(0) <= unboundIn(k) ? 0 : k
    const choices: number[][] = []
    for (let i = 0; i < k; i++) {
      const x = a.slots[from + i]
      if (!this.bound[x]) choices.push(pool)
      else choices.push(mask0 ? [this.find(this.val[x])] : this.flex[x] ? this.membersOf(this.find(this.val[x])) : [this.val[x]])
    }
    const t = new Int32Array(k)
    const rec = (i: number): boolean => {
      if (i === k) {
        this.work++
        if (r.parent.has(this.tupleKey(r, t))) return false
        const seen = new Set<number>()
        for (const perm of r.group) {
          const pk = pack(t, perm)
          if (seen.has(pk)) continue
          seen.add(pk)
          const y = Int32Array.from(perm, q => t[q])
          if (from === 0 ? tryPair(t, y) : tryPair(y, t)) return true
        }
        return false
      }
      for (const v of choices[i]) { t[i] = v; if (rec(i + 1)) return true }
      return false
    }
    return rec(0)
  }

  // ───────────────────────── saturation ─────────────────────────

  private goalCheckedAt = -1
  private goalHeld = false
  private done(full = true): boolean {
    const goal = this.opts.goal
    if (goal && (full || !this.prep.defined.has(goal.name))) {
      // The closure only grows: the goal needs asking again only when something has changed.
      if (!this.goalHeld && this.goalCheckedAt !== this.version) { this.goalCheckedAt = this.version; this.goalHeld = this.holds(goal) }
      if (this.goalHeld) return true
    }
    if (this.derivations >= (this.opts.maxDerivations ?? 200_000) || this.work >= (this.opts.maxWork ?? 3_000_000)) { this.exhausted = true; return true }
    return false
  }

  run(): void {
    for (;;) {
      if (this.done()) return
      const before = this.version
      for (const c of this.compiled) {
        if (this.lastRun.get(c) === this.version) continue
        this.lastRun.set(c, this.version)
        // Materialise the matches first: asserting changes what is matched against.
        this.ensure(c.nvars)
        const hv = c.headVars, snaps: number[] = []
        let count = 0
        this.join(c, (1 << c.atoms.length) - 1, () => {
          count++
          for (const x of hv) snaps.push(this.bound[x] ? this.val[x] : -1, this.flex[x])
          return false
        })
        const per = 2 * hv.length
        this.matches += count
        const head = c.head!, vals = new Int32Array(head.slots.length)
        const headPos = c.headPos
        for (let m = 0; m < count; m++) {
          // Fast path: every head variable bound to one value (exact, or a class where equals substitute).
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
            if (this.done(false)) return
            continue
          }
          // each head variable's values: itself, its class (written where equals do not substitute), or every point
          const choices = hv.map((x, i) => {
            const v = snaps[m * per + 2 * i], f = snaps[m * per + 2 * i + 1]
            if (v >= 0 && !f) return [v]
            if (v >= 0) return c.headLiteral[i] ? this.membersOf(this.find(v)) : [this.find(v)]
            return c.headLiteral[i] ? this.namesList() : this.reps()
          })
          const pick = new Array<number>(hv.length)
          const rec = (i: number): boolean => {
            if (i === hv.length) {
              for (let p = 0; p < head.slots.length; p++) vals[p] = pick[headPos[p]]
              this.derivations++
              this.assertIds(head.rel, vals)
              return false
            }
            for (const v of choices[i]) { pick[i] = v; if (rec(i + 1)) return true }
            return false
          }
          rec(0)
          if (this.done(false)) return
        }
        if (this.done()) return
      }
      if (this.done()) return
      if (this.version === before) return
    }
  }
}
