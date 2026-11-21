/**
 * A rule's own symmetries, and breaking them while matching.
 *
 * A symmetry of a rule is a renaming of its variables that maps its body onto itself, each atom onto
 * an atom of the body that says the same (by what the structure analysis has proven: an equivalence
 * reads the same with its blocks swapped or each block reordered by its group; a symmetric relation
 * by its permutations), and maps its head onto a head that says the same. Side-angle-side is the
 * example: exchange the two triangles, or read both the other way round, and the body is the body
 * and the conclusion the conclusion.
 *
 * So every match of the body has a family of matches (its images under the symmetries), all with
 * one conclusion; one of each family is enough. Matching keeps a match only if it is the least of its
 * family in a fixed order of the variables (the lex-leader method), checked as soon as the variables
 * that decide it are bound, so the search is cut, not only its results. Any set of symmetries may be
 * used, not only a whole group: the least member of every family satisfies every such check, so every
 * conclusion is still reached. Nothing here knows a relation by name.
 */

import type { Predicate, Rule } from '../language/parser'
import type { Structure } from './structure'

export interface SymmetryBreak {
  /** The variables in the order matches are compared. */
  order: string[]
  /** The rule's symmetries other than the identity, each as a renaming of variables. */
  perms: Map<string, string>[]
}

/** At most this many symmetries are kept per rule: enough for the book's, cheap to check. */
const MAX_SYMMETRIES = 16

/** The reorderings of a predicate's arguments under which it reads the same. */
export function argumentGroup(name: string, n: number, st: Structure): number[][] {
  const id = Array.from({ length: n }, (_, i) => i)
  if (name === st.equality && n === 2) return [id, [1, 0]]
  const e = st.equivalences.get(name)
  if (e && n === 2 * e.k) {
    const out: number[][] = []
    for (const swap of [false, true]) for (const g1 of e.blockGroup) for (const g2 of e.blockGroup) {
      const first = g1, second = g2.map(i => i + e.k)
      out.push(swap ? [...second, ...first] : [...first, ...second])
    }
    return out
  }
  const sym = st.symmetries.get(name)
  if (sym && sym[0]?.length === n) return sym
  return [id]
}

/** Do two atoms read the same, under the predicate's argument group? */
function same(a: Predicate, b: Predicate, st: Structure): boolean {
  if (a.name !== b.name || a.args.length !== b.args.length) return false
  return argumentGroup(a.name, a.args.length, st).some(g => g.every((j, i) => a.args[j] === b.args[i]))
}

/** A rule's symmetries other than the identity (up to MAX_SYMMETRIES), and the order to compare by. */
export function ruleSymmetries(rule: Rule, st: Structure): SymmetryBreak | null {
  const body = rule.body
  if (body.length === 0) return null
  const order: string[] = []
  for (const a of body) for (const v of a.args) if (!order.includes(v)) order.push(v)
  const found: Map<string, string>[] = []
  const used = new Array(body.length).fill(false)

  // Map body atom i onto an unused atom of the same predicate, through one of its readings; the
  // renaming grows consistently (a bijection), and at the end the head must read the same.
  const search = (i: number, sigma: Map<string, string>, image: Set<string>): void => {
    if (found.length >= MAX_SYMMETRIES) return
    if (i === body.length) {
      if ([...sigma].every(([k, v]) => k === v)) return   // the identity
      const head = { name: rule.head.name, args: rule.head.args.map(v => sigma.get(v) ?? v) }
      if (rule.head.args.every(v => sigma.has(v)) && same(head, rule.head, st)) found.push(new Map(sigma))
      return
    }
    const a = body[i]
    for (let j = 0; j < body.length; j++) {
      if (used[j] || body[j].name !== a.name || body[j].args.length !== a.args.length) continue
      for (const g of argumentGroup(a.name, a.args.length, st)) {
        // sigma(a.args[t]) must be the t-th argument of body[j] read through g.
        const added: string[] = []
        let ok = true
        for (let t = 0; t < a.args.length && ok; t++) {
          const from = a.args[t], to = body[j].args[g[t]]
          const cur = sigma.get(from)
          if (cur === undefined) {
            if (image.has(to)) ok = false
            else { sigma.set(from, to); image.add(to); added.push(from) }
          } else if (cur !== to) ok = false
        }
        if (ok) { used[j] = true; search(i + 1, sigma, image); used[j] = false }
        for (const v of added) { image.delete(sigma.get(v)!); sigma.delete(v) }
        if (found.length >= MAX_SYMMETRIES) return
      }
    }
  }
  search(0, new Map(), new Set())
  // Keep each renaming once.
  const seen = new Set<string>()
  const perms = found.filter(p => { const k = order.map(v => p.get(v)).join(' '); if (seen.has(k)) return false; seen.add(k); return true })
  return perms.length ? { order, perms } : null
}
