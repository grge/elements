/**
 * Marks: tick marks and angle arcs, from equalities that are stated or proven (design.md, "Marks:
 * from statements and proofs" and "Equality chains").
 *
 * An equality is known if it is
 *   stated   a fact the figure draws (`depicted`) whose relation is an equivalence: `eq-lines a b c d`
 *            written on the page or in a definition it uses, down to what is drawn; or
 *   proven   the head of a ✓ lemma whose hypotheses match facts of the figure's outline (what is
 *            written, and the definitions it uses down to what is drawn), by renaming the lemma's
 *            variables. Lemmas travel with their constructions: wherever `eq-triangle a b c` occurs,
 *            at any depth, `? eq-lines a b b c: eq-triangle a b c` gives a-b = b-c for its points.
 *
 * Known equalities are put into classes, one union-find per relation the engine has recognised as an
 * equivalence (kb/structure.ts), so nothing here knows a relation by name: a member is a block of k
 * points, taken up to the block's own symmetries (a segment either way round, an angle with its arms
 * swapped). The union-find keeps the edges it was given, so a mark can explain its chain.
 *
 * Union-find alone joins only what an equality links directly: the five equilateral triangles of a
 * hexagon would be five classes of angles, though all are 60°. So classes are then merged by the
 * forward closure of the figure's facts (`closureQueries`, answered off the main thread, then
 * `mergeByClosure`): two classes are one when the engine derives one member of each equal. The
 * members stay those stated or proven; the closure only joins them.
 *
 * A relation can be an equivalence's flip (relations.ts `flipOf`): `supp a b c d e f` says a-b-c
 * equals the angle beside d-e-f. Its facts join the same classes, the second block flipped, so a class
 * is a union-find with parity: each member is in it as itself or flipped, and a flipped member is
 * marked on its other side (scene.ts). Whichever way most members are is drawn as themselves. A class
 * with a member both ways (`clash`) holds an angle equal to its own supplement: right angles.
 */

import type { Lemma } from '../language/parser'
import type { Equivalence } from '../kb/structure'
import type { DrawableFact } from './extraction'
import { ParityUnionFind, UnionFind } from './classes'
import { RELATIONS } from './relations'

export type MarkSource =
  | { kind: 'stated'; fact: DrawableFact }
  | { kind: 'proven'; lemma: Lemma; facts: DrawableFact[] }
  /** Derived by the forward closure of the figure's facts (no trace yet: see `mergeByClosure`). */
  | { kind: 'derived' }

export interface Equality {
  name: string
  args: string[]
  depth: number
  source: MarkSource
  /** The second block is flipped (a fact of the equivalence's flip, such as `supp`). */
  flip?: boolean
}

export interface MarkMember {
  /** The block's points, in a canonical order. */
  points: string[]
  /** The shallowest depth it is known at. */
  depth: number
  /** In its class flipped: marked on its other side (the angle beside it). */
  flipped?: boolean
}

export interface MarkClass {
  /** The equivalence (its relation's name, and its block size). */
  name: string
  k: number
  members: MarkMember[]
  /** Each known equality between two members, by index, with where it came from; `flip`: a flip's. */
  edges: { from: number; to: number; source: MarkSource; flip?: boolean }[]
  /** A member is known both as itself and flipped: an angle equal to its own supplement. */
  clash?: boolean
  /**
   * A mark relation the closure derived of the class (`right`): its members are drawn as that
   * relation draws (a square), not as arcs of equality.
   */
  as?: string
}

/** Every lemma's matches against the facts: substitutions of its variables, and the facts used. */
function* matches(lemma: Lemma, byName: Map<string, DrawableFact[]>): Generator<{ subst: Map<string, string>; facts: DrawableFact[] }> {
  // A hypothesis the figure's convention meets (`distinct`: two different names) is checked last,
  // once its variables are bound; it need not be written.
  const conventional = (name: string) => !!RELATIONS.get(name)?.byNames
  const hyps = [...lemma.hypotheses].sort((a, b) => Number(conventional(a.name)) - Number(conventional(b.name)))
  const go = function* (i: number, subst: Map<string, string>, used: DrawableFact[]): Generator<{ subst: Map<string, string>; facts: DrawableFact[] }> {
    if (i === hyps.length) { yield { subst, facts: used }; return }
    const c = RELATIONS.get(hyps[i].name)
    if (c?.byNames && !(byName.get(hyps[i].name)?.length)) {
      const args = hyps[i].args.map(v => subst.get(v))
      if (args.every(a => a !== undefined) && c.byNames(args as string[])) yield* go(i + 1, subst, used)
      return
    }
    const h = hyps[i]
    for (const f of byName.get(h.name) ?? []) {
      if (f.args.length !== h.args.length) continue
      const next = new Map(subst)
      if (h.args.every((v, j) => { const b = next.get(v); if (b === undefined) { next.set(v, f.args[j]); return true } return b === f.args[j] })) {
        yield* go(i + 1, next, [...used, f])
      }
    }
  }
  yield* go(0, new Map(), [])
}

/**
 * The known equalities of a figure: stated (depicted facts of an equivalence) and proven (lemmas
 * matched against its outline). A proven equality is as deep as the deepest fact its match used.
 */
export function equalities(
  outline: readonly DrawableFact[],
  depicted: readonly DrawableFact[],
  lemmas: readonly Lemma[],
  equivalences: ReadonlyMap<string, Equivalence>,
): Equality[] {
  const out: Equality[] = []
  // An equivalence's own facts, or its flip's, read as the equivalence with the second block flipped.
  const asEquality = (name: string): { name: string; flip: boolean } | null => {
    if (equivalences.has(name)) return { name, flip: false }
    const of = RELATIONS.get(name)?.flipOf
    return of && equivalences.has(of) ? { name: of, flip: true } : null
  }
  for (const f of depicted) {
    const e = asEquality(f.name)
    if (e) out.push({ name: e.name, args: [...f.args], depth: f.depth, source: { kind: 'stated', fact: f }, ...(e.flip ? { flip: true } : {}) })
  }
  const byName = new Map<string, DrawableFact[]>()
  for (const f of outline) {
    if (!byName.has(f.name)) byName.set(f.name, [])
    byName.get(f.name)!.push(f)
  }
  for (const lemma of lemmas) {
    const e = asEquality(lemma.head.name)
    if (!e || lemma.hypotheses.length === 0) continue
    for (const { subst, facts } of matches(lemma, byName)) {
      const args = lemma.head.args.map(v => subst.get(v))
      if (args.some(a => a === undefined)) continue   // the head has points of its own: nothing to mark
      out.push({ name: e.name, args: args as string[], depth: Math.max(...facts.map(f => f.depth)), source: { kind: 'proven', lemma, facts }, ...(e.flip ? { flip: true } : {}) })
    }
  }
  return out
}

/** A block of points up to its symmetries: the least of its reorderings. */
function canonical(block: readonly string[], group: readonly number[][]): string[] {
  let best: string[] | null = null
  for (const perm of group) {
    const c = perm.map(i => block[i])
    if (!best || c.join('\u0001') < best.join('\u0001')) best = c
  }
  return best ?? [...block]
}

/**
 * Whichever way most members are is drawn as themselves (on a tie, the first member's way): a class
 * flipped as a whole is the same class.
 */
function normalised(cls: MarkClass): MarkClass {
  if (cls.clash) return { ...cls, members: cls.members.map(({ flipped: _, ...m }) => m) }
  const flipped = cls.members.filter(m => m.flipped).length
  const invert = flipped * 2 > cls.members.length || (flipped * 2 === cls.members.length && !!cls.members[0]?.flipped)
  return { ...cls, members: cls.members.map(({ flipped: f, ...m }) => (invert ? !f : !!f) ? { ...m, flipped: true } : m) }
}

/** Equalities into classes, one union-find (with parity, for flips) per equivalence. Blocks with a repeated point are skipped. */
export function markClasses(known: readonly Equality[], equivalences: ReadonlyMap<string, Equivalence>): MarkClass[] {
  const out: MarkClass[] = []
  for (const [name, eq] of equivalences) {
    if (eq.k < 2) continue
    const uf = new ParityUnionFind()
    const members = new Map<string, MarkMember>()
    const edges: { a: string; b: string; source: MarkSource; flip: boolean }[] = []
    for (const e of known) {
      if (e.name !== name || e.args.length !== 2 * eq.k) continue
      const blocks = [e.args.slice(0, eq.k), e.args.slice(eq.k)]
      if (blocks.some(b => new Set(b).size < b.length)) continue
      const [ka, kb] = blocks.map(b => canonical(b, eq.blockGroup))
      const [a, b] = [ka.join('\u0001'), kb.join('\u0001')]
      const flip = !!e.flip
      if (a === b && !flip) continue
      for (const [key, pts] of [[a, ka], [b, kb]] as const) {
        const m = members.get(key)
        if (m) m.depth = Math.min(m.depth, e.depth)
        else members.set(key, { points: pts, depth: e.depth })
      }
      if (a === b) { uf.clash(a); continue }   // an angle beside itself: a right angle
      uf.union(a, b, flip)
      edges.push({ a, b, source: e.source, flip })
    }
    for (const { keys, flips, clash } of uf.classes()) {
      const index = new Map(keys.map((k, i) => [k, i]))
      out.push(normalised({
        name, k: eq.k,
        members: keys.map((k, i) => flips[i] ? { ...members.get(k)!, flipped: true } : members.get(k)!),
        edges: edges.filter(e => index.has(e.a)).map(e => ({ from: index.get(e.a)!, to: index.get(e.b)!, source: e.source, ...(e.flip ? { flip: true } : {}) })),
        ...(clash ? { clash: true } : {}),
      }))
    }
  }
  return out
}

/** The chain of known equalities from one member of a class to another (breadth first). */
export function chain(cls: MarkClass, from: number, to: number): MarkClass['edges'] {
  const prev = new Map<number, MarkClass['edges'][number] | null>([[from, null]])
  const queue = [from]
  while (queue.length) {
    const m = queue.shift()!
    if (m === to) break
    for (const e of cls.edges) {
      const next = e.from === m ? e.to : e.to === m ? e.from : -1
      if (next < 0 || prev.has(next)) continue
      prev.set(next, e)
      queue.push(next)
    }
  }
  if (!prev.has(to)) return []
  const path: MarkClass['edges'] = []
  for (let m = to; m !== from;) {
    const e = prev.get(m)!
    path.unshift(e)
    m = e.from === m ? e.to : e.from
  }
  return path
}

/** A question for the closure: are two classes one (or each the other's flip), or does a class's member have a property? */
export type ClosureQuery =
  | { fact: { name: string; args: string[] }; pair: [number, number]; flip?: boolean }
  | { fact: { name: string; args: string[] }; property: { cls: number; relation: string } }

/** The member a class is asked about: its first drawn as itself. */
const representative = (c: MarkClass) => Math.max(0, c.members.findIndex(m => !m.flipped))

/**
 * What to ask the closure: for each two classes of the same relation, is a member of one equal to a
 * member of the other, or (for a relation with a flip, `flips`: `supp` of `eq-angle`) the other's flip?
 * And for each class, does its member have one of `properties` (a mark relation on one block, such as
 * `right` on an angle)? A property of one member is a property of its whole class only because
 * properties asked are invariant under the class's equality: an angle equal to a right angle is right
 * (Euclid's fourth postulate, which the book states). So a property is asked only of classes of the
 * equivalence it belongs to (`of`): a triangle equal in area to one whose corners make a right angle
 * need not make one.
 */
export function closureQueries(
  classes: readonly MarkClass[],
  properties: readonly { name: string; of: string }[] = [],
  flips: readonly { name: string; of: string }[] = [],
): ClosureQuery[] {
  const out: ClosureQuery[] = []
  const rep = (c: MarkClass) => c.members[representative(c)].points
  for (let i = 0; i < classes.length; i++) for (let j = i + 1; j < classes.length; j++) {
    const [a, b] = [classes[i], classes[j]]
    if (a.name !== b.name) continue
    out.push({ fact: { name: a.name, args: [...rep(a), ...rep(b)] }, pair: [i, j] })
    for (const f of flips) if (f.of === a.name) out.push({ fact: { name: f.name, args: [...rep(a), ...rep(b)] }, pair: [i, j], flip: true })
  }
  classes.forEach((c, i) => {
    for (const p of properties) if (p.of === c.name) out.push({ fact: { name: p.name, args: [...rep(c)] }, property: { cls: i, relation: p.name } })
  })
  return out
}

/**
 * Classes merged where the closure derived the equality (or the flip) between them, and marked with a
 * property where it derived that (`holds[i]` answers query i). A merged class has the properties of
 * its parts; a part joined as a flip has its members flipped.
 */
export function mergeByClosure(classes: readonly MarkClass[], queries: readonly ClosureQuery[], holds: readonly boolean[]): MarkClass[] {
  const uf = new ParityUnionFind()
  classes.forEach((_, i) => uf.add(String(i)))
  const joins: { pair: [number, number]; flip: boolean }[] = []
  const as = new Map<number, string>()
  queries.forEach((q, n) => {
    if (!holds[n]) return
    if ('property' in q) { as.set(q.property.cls, q.property.relation); return }
    const flip = !!q.flip
    const [a, b] = [uf.find(String(q.pair[0])), uf.find(String(q.pair[1]))]
    if (a.root === b.root && (a.flip !== b.flip) === flip) return
    uf.union(String(q.pair[0]), String(q.pair[1]), flip)
    joins.push({ pair: q.pair, flip })
  })
  return uf.classes().map(({ keys, flips, clash }) => {
    const parts = keys.map(Number)
    const property = parts.map(p => as.get(p)).find(x => x !== undefined)
    const anyClash = clash || parts.some(p => classes[p].clash)
    if (parts.length === 1) {
      const c = classes[parts[0]]
      return property || anyClash ? { ...c, ...(property ? { as: property } : {}), ...(anyClash ? { clash: true } : {}) } : c
    }
    // Members renumbered in order; each join is an edge between the classes' representatives.
    const offset = new Map<number, number>()
    let n = 0
    for (const p of parts) { offset.set(p, n); n += classes[p].members.length }
    const flipOf = new Map(parts.map((p, i) => [p, flips[i]]))
    return normalised({
      name: classes[parts[0]].name, k: classes[parts[0]].k,
      members: parts.flatMap(p => classes[p].members.map(m => (!!m.flipped !== flipOf.get(p)) ? { ...m, flipped: true } : (({ flipped: _, ...rest }) => rest)(m))),
      edges: [
        ...parts.flatMap(p => classes[p].edges.map(e => ({ ...e, from: e.from + offset.get(p)!, to: e.to + offset.get(p)! }))),
        ...joins.filter(({ pair: [a] }) => offset.has(a)).map(({ pair: [a, b], flip }) => ({
          from: offset.get(a)! + representative(classes[a]), to: offset.get(b)! + representative(classes[b]),
          source: { kind: 'derived' as const }, ...(flip ? { flip: true } : {}),
        })),
      ],
      ...(property ? { as: property } : {}),
      ...(anyClash ? { clash: true } : {}),
    })
  })
}

/**
 * The classes that cannot change when the closure answers: those no question is about. While the
 * closure is pending the figure draws only these, so it never shows a mark it will take back.
 */
export function settledClasses(classes: readonly MarkClass[], queries: readonly ClosureQuery[]): MarkClass[] {
  const asked = new Set(queries.flatMap(q => 'pair' in q ? q.pair : [q.property.cls]))
  return classes.filter((_, i) => !asked.has(i))
}

/**
 * Facts a ✓ lemma proves whose drawing is a mark (relations.ts `mark`: a right angle's square, a
 * supplement's arcs), matched against the outline as equalities are. Each is as deep as the deepest
 * fact its match used, and comes from where that fact came from.
 */
export function provenMarks(
  outline: readonly DrawableFact[],
  lemmas: readonly Lemma[],
  isMark: (name: string) => boolean,
): { fact: DrawableFact; lemma: Lemma; facts: DrawableFact[] }[] {
  const byName = new Map<string, DrawableFact[]>()
  for (const f of outline) {
    if (!byName.has(f.name)) byName.set(f.name, [])
    byName.get(f.name)!.push(f)
  }
  const out: { fact: DrawableFact; lemma: Lemma; facts: DrawableFact[] }[] = []
  for (const lemma of lemmas) {
    if (!isMark(lemma.head.name) || lemma.hypotheses.length === 0) continue
    for (const { subst, facts } of matches(lemma, byName)) {
      const args = lemma.head.args.map(v => subst.get(v))
      if (args.some(a => a === undefined)) continue
      const deepest = facts.reduce((d, f) => f.depth > d.depth ? f : d)
      out.push({ fact: { name: lemma.head.name, args: args as string[], depth: deepest.depth, origin: deepest.origin }, lemma, facts })
    }
  }
  return out
}
