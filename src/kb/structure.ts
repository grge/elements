/**
 * Recognising structure in ordinary rules.
 *
 * Some rule sets have a shape that a fast engine can implement with a data structure instead of by
 * firing the rules: an equivalence relation (union-find), substitution of equals (rewriting to class
 * representatives), symmetry under permuting arguments (a canonical argument order). Nothing is
 * declared: each property is PROVEN from the predicate's own rules with the plain reference engine
 * (`forwardClosure`), on fresh constants. Rules have no constants, so a derivation on fresh constants
 * is a derivation for every instance: what is recognised is proven, not guessed. A block's reorderings
 * are looked for among those its rules state directly (each proven, closed under composition).
 *
 * The rules stay the meaning. `saturate` uses this structure only to compute the same closure faster,
 * and skips exactly those rules the structure already implies (see `saturate.ts`).
 *
 * Nothing here knows any predicate name; geometry is just one knowledge base that has such structure.
 */

import type { Rule } from '../language/parser'
import { KnowledgeBase, forwardClosure, groundKey, type GroundPredicate } from './inference'
import { fingerprint, Lru } from './rules'

/** A relation between two blocks of k arguments, [0, k) and [k, 2k), that is an equivalence. */
export interface Equivalence {
  k: number
  /** Permutations of a block that preserve the relation (always includes the identity). */
  blockGroup: number[][]
}

export interface Structure {
  arity: Map<string, number>
  /** Block equivalences, including the equality itself (k = 1). */
  equivalences: Map<string, Equivalence>
  /** A binary equivalence whose classes may be substituted into other predicates, if there is one. */
  equality: string | null
  /** Per predicate: the argument positions into which equals may be substituted. */
  congruent: Map<string, boolean[]>
  /** Per predicate (not an equivalence): permutations of its arguments it is invariant under. */
  symmetries: Map<string, number[][]>
  /**
   * Equivalences that are differences (see below): `p(a b c d e f g h)` read as value(c d) - value(a b)
   * = value(g h) - value(e f), with `pairs` the equivalence of pairs that have one value, if any.
   */
  differences: Map<string, Difference>
  /** Relations that are sums of values (see below): `p(a b c d e f)` read as value(a b) + value(c d) = value(e f). */
  sums: Map<string, Sum>
  /** Relations that are an equivalence's flip (see below): `p(X Y)` read as X and Y in one class, of opposite signs. */
  flips: Map<string, Flip>
}

/**
 * A relation between two blocks that is the odd half of an equivalence's signed classes: a
 * supplement is an equal angle on the other side. Recognised when its rules, with the equivalence's,
 * prove that it is symmetric (p X Y gives p Y X), that it respects the equivalence (p X Y and q Y Z
 * give p X Z), and that two of it make the equivalence (p X Y and p X Z give q Y Z). Then its closure
 * with q's is exactly that of signed classes: q's classes, each member with a sign, p holding between
 * members of opposite signs, and q between members of the same sign; a class where some member is
 * both (an angle equal to its own supplement) holds both of every two members. Its block reorderings
 * and its substitution of equals follow from q's (q's reflexive images, and respect). The store keeps
 * a p fact as an edge of odd sign in q's classes (saturate.ts), never as a fact of its own.
 */
export interface Flip { of: string }

/**
 * A relation of three pairs, read as a sum of their values: value(a b) + value(c d) = value(e f), the
 * values constant on the classes of an equivalence of pairs (`values`). Recognised when its rules
 * prove: the two parts may be exchanged; a pair of `values`-equivalent segments may stand for any
 * pair; and the parts determine the whole (two sums of the same parts are equivalent). Quadrances
 * (squared lengths, with equal lengths as `values`) are the case. Its facts are linear equations in
 * the classes' values, which a solver combines (saturate.ts); equal values go back as `values` facts.
 */
export interface Sum { values: string }

/**
 * An equivalence on blocks of two unordered pairs, closed under exchanging the middle pairs: if a-b
 * is to c-d as e-f is to g-h, then a-b is to e-f as c-d is to g-h. That is what a difference of values
 * is (c-d minus a-b equals g-h minus e-f, so g-h minus c-d equals e-f minus a-b), and so its facts are
 * linear equations in the pairs' values, which a solver may combine (saturate.ts). Turns are the
 * differences of lines' directions; `pairs` (parallel) says which lines have one direction.
 */
export interface Difference {
  pairs: string | null
  /**
   * The rule, if the book states one, concluding the pairs' equivalence from a difference of nothing
   * (`parallel a b c d: eq-turn a b c d a b a b, …`: lines that turn by nothing run the same way).
   * The engine implements it through the solver (saturate.ts): pairs whose values the solver shows
   * equal are asserted equivalent, when the rule's other atoms hold of them.
   */
  faithful: Rule | null
}

const MAX_SYMMETRY_ARITY = 5
const MAX_BLOCK = 4

function permutations(n: number): number[][] {
  if (n === 0) return [[]]
  const out: number[][] = []
  for (const p of permutations(n - 1)) {
    for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)])
  }
  return out
}

const isIdentity = (p: number[]) => p.every((x, i) => x === i)
const consts = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`)
const apply = (perm: number[], args: readonly string[]) => perm.map(i => args[i])

// Proofs depend only on the fragment of rules used, so they are shared between knowledge bases that
// differ elsewhere (e.g. while definitions.ts tries alternative definitions).
const proofCache = new Lru<boolean>(20_000)
const structureCache = new Lru<Structure>(16)

function proves(rules: Rule[], seeds: GroundPredicate[], goal: GroundPredicate): boolean {
  if (rules.length === 0) return false
  const key = `${fingerprint(rules)}\n⊢ ${seeds.map(groundKey).join(' ')} → ${groundKey(goal)}`
  const hit = proofCache.get(key)
  return hit ?? proofCache.set(key, provesUncached(rules, seeds, goal))
}

function provesUncached(rules: Rule[], seeds: GroundPredicate[], goal: GroundPredicate): boolean {
  const objects = [...new Set([...seeds.flatMap(s => s.args), ...goal.args])]
    .map(o => ({ name: '__object__', args: [o] }))
  const kb = new KnowledgeBase(rules, { definitions: new Map() })
  const key = groundKey(goal)
  return forwardClosure(kb, [...seeds, ...objects], 20_000, key).some(f => groundKey(f) === key)
}

/**
 * Permutations of the first block that a clause for `p` states outright: a rule `p(σx, y): p(x, y)`
 * (or the same on the second block), or an axiom `p(x, σx)`.
 */
function statedBlockPermutations(p: string, k: number, rules: Rule[]): number[][] {
  const out = new Map<string, number[]>()
  const asPerm = (from: readonly string[], to: readonly string[]): number[] | null => {
    if (new Set(from).size !== k) return null
    const perm = to.map(v => from.indexOf(v))
    return perm.every(i => i >= 0) && new Set(perm).size === k ? perm : null
  }
  for (const r of rules) {
    if (r.head.name !== p) continue
    const h = r.head.args, h1 = h.slice(0, k), h2 = h.slice(k)
    let perm: number[] | null = null
    if (r.body.length === 0) perm = asPerm(h1, h2)
    else if (r.body.length === 1 && r.body[0].name === p) {
      const b = r.body[0].args, b1 = b.slice(0, k), b2 = b.slice(k)
      if (h2.every((v, i) => v === b2[i])) perm = asPerm(b1, h1)
      else if (h1.every((v, i) => v === b1[i])) perm = asPerm(b2, h2)
    }
    if (perm && !isIdentity(perm)) out.set(perm.join(','), perm)
  }
  return [...out.values()]
}

/** The group of permutations of k elements generated by `generators` (identity included). */
function generatedGroup(k: number, generators: number[][]): number[][] {
  const id = Array.from({ length: k }, (_, i) => i)
  const seen = new Map([[id.join(','), id]])
  const queue = [id]
  while (queue.length) {
    const g = queue.shift()!
    for (const h of generators) {
      const gh = g.map(i => h[i])
      const key = gh.join(',')
      if (!seen.has(key)) { seen.set(key, gh); queue.push(gh) }
    }
  }
  return [...seen.values()]
}

export function analyseStructure(rules: readonly Rule[]): Structure {
  const key = fingerprint(rules)
  return structureCache.get(key) ?? structureCache.set(key, analyse(rules))
}

function analyse(rules: readonly Rule[]): Structure {
  const arity = new Map<string, number>()
  for (const r of rules) for (const a of [r.head, ...r.body]) if (!arity.has(a.name)) arity.set(a.name, a.args.length)

  /** Rules for p that mention nothing but p. */
  const own = (p: string) => rules.filter(r => r.head.name === p && r.body.every(b => b.name === p))
  const atom = (name: string, args: string[]): GroundPredicate => ({ name, args })

  // ── equivalences on argument blocks ──
  const equivalences = new Map<string, Equivalence>()
  for (const [p, n] of arity) {
    if (n === 0 || n % 2 !== 0) continue
    const k = n / 2
    const fragment = own(p)
    if (fragment.length === 0 || k > MAX_BLOCK) continue
    const [a, b, c] = [consts('a', k), consts('b', k), consts('c', k)]
    const isEquivalence =
      proves(fragment, [], atom(p, [...a, ...a])) &&
      proves(fragment, [atom(p, [...a, ...b])], atom(p, [...b, ...a])) &&
      proves(fragment, [atom(p, [...a, ...b]), atom(p, [...b, ...c])], atom(p, [...a, ...c]))
    if (!isEquivalence) continue
    // Reorderings of a block that preserve the relation: those the rules state directly, each proven,
    // and the group they generate. (Trying all k! reorderings by proof is ruinous for k = 4: each one
    // that fails has to be refuted by an exhaustive closure.)
    const generators = statedBlockPermutations(p, k, fragment)
      .filter(perm => proves(fragment, [atom(p, [...a, ...b])], atom(p, [...apply(perm, a), ...b])))
    equivalences.set(p, { k, blockGroup: generatedGroup(k, generators) })
  }

  // ── the equality: a binary equivalence that other predicates admit substitution for ──
  const congruenceFor = (eq: string): Map<string, boolean[]> => {
    const eqRules = own(eq)
    const out = new Map<string, boolean[]>()
    for (const [q, n] of arity) {
      if (q === eq) { out.set(q, [true, true]); continue }
      const fragment = [
        ...eqRules,
        ...rules.filter(r => r.head.name === q && r.body.every(b => b.name === q || b.name === eq)),
      ]
      const args = consts('a', n)
      out.set(q, args.map((_, i) => {
        const moved = [...args]; moved[i] = 'x'
        return proves(fragment, [atom(q, args), atom(eq, ['x', args[i]])], atom(q, moved))
      }))
    }
    return out
  }
  let equality: string | null = null
  let congruent = new Map<string, boolean[]>()
  let best = -1
  for (const [p, e] of equivalences) {
    if (e.k !== 1) continue
    const c = congruenceFor(p)
    const count = [...c.values()].reduce((s, mask) => s + mask.filter(Boolean).length, 0)
    if (count > best) { best = count; equality = p; congruent = c }
  }
  for (const [p, n] of arity) if (!congruent.has(p)) congruent.set(p, Array(n).fill(false))

  // Substituting into some positions of an argument block but not others would make canonical
  // forms inconsistent; such relations are left to their rules.
  for (const p of [...equivalences.keys()]) {
    if (p === equality) continue
    const mask = congruent.get(p)!
    if (!mask.every(m => m === mask[0])) equivalences.delete(p)
  }

  // ── symmetries of the remaining predicates ──
  const symmetries = new Map<string, number[][]>()
  for (const [p, n] of arity) {
    if (equivalences.has(p) || n < 2 || n > MAX_SYMMETRY_ARITY) continue
    const fragment = own(p)
    if (fragment.length === 0) continue
    const args = consts('a', n)
    const mask = congruent.get(p)!
    const group = permutations(n).filter(perm =>
      // Only permutations that map substitutable positions to substitutable ones.
      perm.every((j, i) => mask[j] === mask[i]) &&
      (isIdentity(perm) || proves(fragment, [atom(p, args)], atom(p, apply(perm, args)))))
    if (group.length > 1) symmetries.set(p, group)
  }

  // ── differences: block equivalences of two unordered pairs, closed under exchanging middles ──
  const differences = new Map<string, Difference>()
  const pairSwaps = [[1, 0, 2, 3], [0, 1, 3, 2]]
  for (const [p, e] of equivalences) {
    if (e.k !== 4 || !pairSwaps.every(sw => e.blockGroup.some(g => g.join(',') === sw.join(',')))) continue
    const fragment = own(p)
    const x = consts('x', 8)
    if (!proves(fragment, [atom(p, x)], atom(p, [x[0], x[1], x[4], x[5], x[2], x[3], x[6], x[7]]))) continue
    // The pairs' equivalence: one whose members may replace the first pair (and so, by the
    // equivalence and the exchange, any pair).
    let pairs: string | null = null
    // Only an equivalence some rule for p substitutes by (its body one fact of p and one of q) can be
    // it: trying others means refuting them, an exhaustive closure each (eq-lines, which a bridge to
    // turns names, took a minute and a half).
    const named = new Set(rules.filter(r => r.head.name === p && r.body.length === 2 && r.body.some(b => b.name === p))
      .flatMap(r => r.body.filter(b => b.name !== p).map(b => b.name)))
    for (const [q, qe] of equivalences) {
      if (q === p || qe.k !== 2 || !named.has(q)) continue
      const both = [...fragment, ...own(q), ...rules.filter(r => r.head.name === p && r.body.every(b => b.name === p || b.name === q) && !fragment.includes(r))]
      if (proves(both, [atom(p, x), atom(q, [x[0], x[1], 'y0', 'y1'])], atom(p, ['y0', 'y1', ...x.slice(2)]))) { pairs = q; break }
    }
    // Faithful: a rule q(a b c d) whose body says p(a b c d a b a b), the rest of its body about a, b,
    // c and d only (their guards).
    let faithful: Rule | null = null
    if (pairs) {
      for (const r of rules) {
        if (r.head.name !== pairs || r.head.args.length !== 4) continue
        const [a, b, c, d] = r.head.args
        const zero = r.body.find(x => x.name === p && x.args.join(' ') === [a, b, c, d, a, b, a, b].join(' '))
        if (zero && r.body.every(x => x === zero || x.args.every(v => [a, b, c, d].includes(v)))) { faithful = r; break }
      }
    }
    differences.set(p, { pairs, faithful })
  }

  // ── sums: three pairs, the third the sum of the first two ──
  const sums = new Map<string, Sum>()
  for (const [p, n] of arity) {
    if (n !== 6 || equivalences.has(p)) continue
    const x = consts('x', 6)
    // Candidate value equivalences: one some rule for p substitutes by (its body one p, one q).
    const named = new Set(rules.filter(r => r.head.name === p && r.body.length === 2 && r.body.some(b => b.name === p))
      .flatMap(r => r.body.filter(b => b.name !== p).map(b => b.name)))
    for (const [q, qe] of equivalences) {
      if (qe.k !== 2 || !named.has(q)) continue
      const fragment = rules.filter(r => (r.head.name === p || r.head.name === q) && r.body.every(b => b.name === p || b.name === q))
      const ok =
        proves(fragment, [atom(p, x)], atom(p, [x[2], x[3], x[0], x[1], x[4], x[5]])) &&
        proves(fragment, [atom(p, x), atom(q, [x[0], x[1], 'y0', 'y1'])], atom(p, ['y0', 'y1', ...x.slice(2)])) &&
        proves(fragment, [atom(p, x), atom(q, [x[4], x[5], 'y0', 'y1'])], atom(p, [...x.slice(0, 4), 'y0', 'y1'])) &&
        proves(fragment, [atom(p, x), atom(p, [...x.slice(0, 4), 'y0', 'y1'])], atom(q, [x[4], x[5], 'y0', 'y1']))
      if (ok) { sums.set(p, { values: q }); break }
    }
  }

  // ── flips: a relation that is an equivalence with one side's sign reversed ──
  const flips = new Map<string, Flip>()
  for (const [p, n] of arity) {
    if (equivalences.has(p) || n === 0 || n % 2 !== 0 || sums.has(p)) continue
    const k = n / 2
    // Candidates: an equivalence on blocks of k that some rule for p substitutes by (its body one p, one q).
    const named = new Set(rules.filter(r => r.head.name === p && r.body.length === 2 && r.body.some(b => b.name === p))
      .flatMap(r => r.body.filter(b => b.name !== p).map(b => b.name)))
    for (const [q, qe] of equivalences) {
      if (qe.k !== k || q === equality || differences.has(q) || !named.has(q)) continue
      const fragment = rules.filter(r => (r.head.name === p || r.head.name === q) && r.body.every(b => b.name === p || b.name === q))
      const [a, b, c] = [consts('a', k), consts('b', k), consts('c', k)]
      const ok =
        proves(fragment, [atom(p, [...a, ...b])], atom(p, [...b, ...a])) &&
        proves(fragment, [atom(p, [...a, ...b]), atom(q, [...b, ...c])], atom(p, [...a, ...c])) &&
        proves(fragment, [atom(p, [...a, ...b]), atom(p, [...a, ...c])], atom(q, [...b, ...c]))
      if (ok) { flips.set(p, { of: q }); symmetries.delete(p); break }
    }
  }

  return { arity, equivalences, equality, congruent, symmetries, differences, sums, flips }
}
