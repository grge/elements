import type { Lemma, Predicate } from '../language/parser'
import { Configuration } from './configuration'
import { groundKey, unfold, type GroundPredicate, type KnowledgeBase } from './inference'
import { saturate } from './saturate'
import { FreshNames, displayName } from './names'

/**
 * verified: the goal follows. vacuous: the hypotheses (or the configuration) are contradictory, i.e.
 * they derive the reserved 0-ary predicate `false`. not-provable: the closure is complete and the goal
 * is not in it. out-of-budget: the search stopped at its budget of derivations without the goal, so it
 * may still follow. A contradiction takes precedence over the goal:
 * anything follows from it, so a ✓ would hide what the author needs to know. unshown: the goal
 * follows, but the hypotheses were not shown consistent (no witness, and the search for a
 * contradiction ran out of budget).
 *
 * Once the goal is derived, the hypotheses must be shown consistent. A caller that has a witness (a
 * figure in which every hypothesis holds: geometry/evidence.ts) says so through `consistent`, and the
 * search for a contradiction is skipped. The logic knows nothing of figures; it only takes the answer.
 */
export type CheckResult = 'verified' | 'vacuous' | 'not-provable' | 'out-of-budget' | 'invalid-query' | 'unshown'

const FALSE: GroundPredicate = { name: 'false', args: [] }


export interface CheckResponse {
  result: CheckResult
  facts: GroundPredicate[]
  message?: string
  /** The hypotheses were shown consistent by a witness rather than by a search. */
  witnessed?: boolean
  /** Verified only under the non-degeneracy convention: for figures whose points are all apart. */
  apart?: boolean
}

export interface CheckOptions {
  /** Are the hypotheses consistent? Asked once the goal is derived; true skips the search for `false`. */
  consistent?: () => boolean
  /** When the search for `false` runs out of budget, say so (`unshown`) rather than ✓. */
  strict?: boolean
  /**
   * The non-degeneracy convention: different names are different points, as in the figure. Every two
   * points of the unfolded hypotheses and the claim, named or introduced by a definition, are
   * `distinct`, unless the lemma itself relates them by `eq-point` (in a hypothesis or its claim,
   * directly or through others). A ✓ under it holds of figures whose points are all apart, as
   * Euclid's figures are (`apart`). Should the hypotheses force two points together, the convention
   * contradicts them, and the verdict names the two.
   *
   * The convention only adds hypotheses, so what follows without it follows with it: a lemma is
   * checked without it first, and a ✓ there is the stronger result (it holds of degenerate figures
   * too). Only a lemma that does not follow is checked again under the convention.
   */
  distinctNames?: boolean
}

const EQUAL = 'eq-point'

/**
 * `distinct` for every two points of the facts and the goal, except those the facts or goal say are
 * one point (by `eq-point`, through any chain of them).
 */
function nonDegeneracy(facts: readonly GroundPredicate[], goal: GroundPredicate): GroundPredicate[] {
  const points = [...new Set([...facts, goal].flatMap(f => f.args))]
  const parent = new Map(points.map(p => [p, p]))
  const find = (p: string): string => { const q = parent.get(p)!; if (q === p) return p; const r = find(q); parent.set(p, r); return r }
  for (const f of [...facts, goal]) if (f.name === EQUAL && f.args.length === 2) parent.set(find(f.args[0]), find(f.args[1]))
  const out: GroundPredicate[] = []
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (find(points[i]) !== find(points[j])) out.push({ name: 'distinct', args: [points[i], points[j]] })
  }
  return out
}

/** Two different names the closure made one point: why the convention contradicts the hypotheses. */
function forcedTogether(facts: readonly GroundPredicate[], assumed: readonly GroundPredicate[]): string | undefined {
  const apart = new Set(assumed.map(f => f.args.join(' ')))
  const f = facts.find(f => f.name === EQUAL && f.args[0] !== f.args[1] &&
    (apart.has(f.args.join(' ')) || apart.has([...f.args].reverse().join(' '))))
  if (!f) return undefined
  const [a, b] = f.args.map(displayName)
  return `the hypotheses make ${a} and ${b} one point, so they cannot be taken as different points`
}

function toGroundPredicate(pred: Predicate): GroundPredicate {
  return { name: pred.name, args: pred.args }
}

function dedupeFacts(facts: readonly GroundPredicate[]): GroundPredicate[] {
  const out = new Map<string, GroundPredicate>()
  for (const fact of facts) out.set(groundKey(fact), fact)
  return [...out.values()]
}

/**
 * Could facts of these predicates lead to `target` at all? Fires rules at the level of predicate
 * names only (a rule applies once every predicate in its body is reachable): an over-approximation,
 * so a "no" is certain.
 */
function mayDerive(kb: KnowledgeBase, seeds: readonly GroundPredicate[], target: string): boolean {
  const reachable = new Set(seeds.map(s => s.name))
  for (let grew = true; grew && !reachable.has(target);) {
    grew = false
    for (const rule of kb.allRules()) {
      if (!reachable.has(rule.head.name) && rule.body.every(b => reachable.has(b.name))) {
        reachable.add(rule.head.name)
        grew = true
      }
    }
  }
  return reachable.has(target)
}

function runCheckPipeline(
  goal: GroundPredicate,
  seeds: readonly GroundPredicate[],
  kb: KnowledgeBase,
  maxDerivations: number,
  options: CheckOptions = {},
): CheckResponse {
  // One supply of fresh names for the whole check, so auxiliaries of different hypotheses stay distinct.
  const fresh = new FreshNames()
  const unfolded = dedupeFacts(seeds.flatMap(seed => unfold(seed, kb, new Set(), { fresh }).frontier))
  const assumed = options.distinctNames ? nonDegeneracy(unfolded, goal) : []
  const frontier = [...unfolded, ...assumed]
  const budget = { maxDerivations }
  const sat = saturate(kb, frontier, { goal, ...budget })
  const facts = sat.allFacts()
  const vacuous = (found: readonly GroundPredicate[]): CheckResponse => {
    const message = assumed.length ? forcedTogether(found, assumed) : undefined
    return { result: 'vacuous', facts, ...(message ? { message } : {}) }
  }
  if (!sat.holds(goal)) {
    return sat.holds(FALSE) ? vacuous(facts) : { result: sat.exhausted ? 'out-of-budget' : 'not-provable', facts }
  }
  // The goal follows; the hypotheses must also be consistent, or the ✓ would hide a contradiction.
  // Nothing to fear if `false` cannot be derived at all from these kinds of facts; a witness shows
  // it at once (a figure has its points apart, so it witnesses the convention too); otherwise the
  // search is carried on to the end, looking for `false`.
  if (sat.holds(FALSE)) return vacuous(facts)
  if (!mayDerive(kb, frontier, FALSE.name)) return { result: 'verified', facts }
  if (options.consistent?.()) return { result: 'verified', facts, witnessed: true }
  const search = saturate(kb, frontier, { goal: FALSE, ...budget })
  if (search.holds(FALSE)) return vacuous(search.allFacts())
  return { result: search.exhausted && options.strict ? 'unshown' : 'verified', facts }
}

function withMissingHeadObjects(seeds: readonly GroundPredicate[], lemma: Lemma): GroundPredicate[] {
  const seenObjects = new Set(seeds.flatMap(seed => seed.args))
  const missing = lemma.head.args.filter(arg => !seenObjects.has(arg))
  if (missing.length === 0) return [...seeds]
  return [
    ...seeds,
    ...missing.map(obj => ({ name: '__object__', args: [obj] } satisfies GroundPredicate)),
  ]
}

export function checkLemma(
  lemma: Lemma,
  kb: KnowledgeBase,
  maxDerivations = 2_000_000,   // a safety valve: the budget of work binds (saturate.ts MAX_WORK)
  options: CheckOptions = {},
): CheckResponse {
  const seeds = withMissingHeadObjects(
    lemma.hypotheses.map(toGroundPredicate),
    lemma,
  )
  const goal = toGroundPredicate(lemma.head)
  const plain = runCheckPipeline(goal, seeds, kb, maxDerivations, { ...options, distinctNames: false })
  if (!options.distinctNames || plain.result === 'verified' || plain.result === 'vacuous' || plain.result === 'unshown') return plain
  const apart = runCheckPipeline(goal, seeds, kb, maxDerivations, options)
  return apart.result === 'verified' ? { ...apart, apart: true } : apart
}

export function checkGroundQuery(
  pred: Predicate,
  kb: KnowledgeBase,
  configuration: Configuration,
  maxDerivations = 200_000,
): CheckResponse {
  const missing = pred.args.filter(arg => !configuration.universe.has(arg))
  if (missing.length > 0) {
    return {
      result: 'invalid-query',
      facts: configuration.allFacts(),
      message: `mentions ${missing.join(', ')}, which no fact on this page introduces`,
    }
  }
  return runCheckPipeline(toGroundPredicate(pred), configuration.allFacts(), kb, maxDerivations)
}
