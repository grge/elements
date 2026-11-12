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
 * swapped). The union-find keeps the edges it was given, so a mark can explain its chain. Nothing is
 * inferred beyond symmetry and transitivity.
 */

import type { Lemma } from '../language/parser'
import type { Equivalence } from '../kb/structure'
import type { DrawableFact } from './extraction'
import { UnionFind } from './classes'

export type MarkSource =
  | { kind: 'stated'; fact: DrawableFact }
  | { kind: 'proven'; lemma: Lemma; facts: DrawableFact[] }

export interface Equality { name: string; args: string[]; depth: number; source: MarkSource }

export interface MarkMember {
  /** The block's points, in a canonical order. */
  points: string[]
  /** The shallowest depth it is known at. */
  depth: number
}

export interface MarkClass {
  /** The equivalence (its relation's name, and its block size). */
  name: string
  k: number
  members: MarkMember[]
  /** Each known equality between two members, by index, with where it came from. */
  edges: { from: number; to: number; source: MarkSource }[]
}

/** Every lemma's matches against the facts: substitutions of its variables, and the facts used. */
function* matches(lemma: Lemma, byName: Map<string, DrawableFact[]>): Generator<{ subst: Map<string, string>; facts: DrawableFact[] }> {
  const hyps = lemma.hypotheses
  const go = function* (i: number, subst: Map<string, string>, used: DrawableFact[]): Generator<{ subst: Map<string, string>; facts: DrawableFact[] }> {
    if (i === hyps.length) { yield { subst, facts: used }; return }
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
  for (const f of depicted) {
    if (equivalences.has(f.name)) out.push({ name: f.name, args: [...f.args], depth: f.depth, source: { kind: 'stated', fact: f } })
  }
  const byName = new Map<string, DrawableFact[]>()
  for (const f of outline) {
    if (!byName.has(f.name)) byName.set(f.name, [])
    byName.get(f.name)!.push(f)
  }
  for (const lemma of lemmas) {
    if (!equivalences.has(lemma.head.name) || lemma.hypotheses.length === 0) continue
    for (const { subst, facts } of matches(lemma, byName)) {
      const args = lemma.head.args.map(v => subst.get(v))
      if (args.some(a => a === undefined)) continue   // the head has points of its own: nothing to mark
      out.push({ name: lemma.head.name, args: args as string[], depth: Math.max(...facts.map(f => f.depth)), source: { kind: 'proven', lemma, facts } })
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

/** Equalities into classes, one union-find per equivalence. Blocks with a repeated point are skipped. */
export function markClasses(known: readonly Equality[], equivalences: ReadonlyMap<string, Equivalence>): MarkClass[] {
  const out: MarkClass[] = []
  for (const [name, eq] of equivalences) {
    if (eq.k < 2) continue
    const uf = new UnionFind()
    const members = new Map<string, MarkMember>()
    const edges: { a: string; b: string; source: MarkSource }[] = []
    for (const e of known) {
      if (e.name !== name || e.args.length !== 2 * eq.k) continue
      const blocks = [e.args.slice(0, eq.k), e.args.slice(eq.k)]
      if (blocks.some(b => new Set(b).size < b.length)) continue
      const [ka, kb] = blocks.map(b => canonical(b, eq.blockGroup))
      const [a, b] = [ka.join('\u0001'), kb.join('\u0001')]
      if (a === b) continue
      for (const [key, pts] of [[a, ka], [b, kb]] as const) {
        const m = members.get(key)
        if (m) m.depth = Math.min(m.depth, e.depth)
        else members.set(key, { points: pts, depth: e.depth })
      }
      uf.union(a, b)
      edges.push({ a, b, source: e.source })
    }
    for (const keys of uf.classes()) {
      const index = new Map(keys.map((k, i) => [k, i]))
      out.push({
        name, k: eq.k,
        members: keys.map(k => members.get(k)!),
        edges: edges.filter(e => index.has(e.a)).map(e => ({ from: index.get(e.a)!, to: index.get(e.b)!, source: e.source })),
      })
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
