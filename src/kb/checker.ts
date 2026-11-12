import type { Lemma, Predicate } from '../language/parser'
import { Configuration } from './configuration'
import { groundKey, unfold, type GroundPredicate, type KnowledgeBase } from './inference'
import { saturate } from './saturate'
import { FreshNames } from './names'

/**
 * verified: the goal follows. vacuous: the hypotheses (or the configuration) are contradictory, i.e.
 * they derive the reserved 0-ary predicate `false`. A contradiction takes precedence over the goal:
 * anything follows from it, so a ✓ would hide what the author needs to know.
 */
export type CheckResult = 'verified' | 'vacuous' | 'not-provable' | 'invalid-query'

const FALSE: GroundPredicate = { name: 'false', args: [] }

export interface CheckResponse {
  result: CheckResult
  facts: GroundPredicate[]
  message?: string
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
): CheckResponse {
  // One supply of fresh names for the whole check, so auxiliaries of different hypotheses stay distinct.
  const fresh = new FreshNames()
  const frontier = dedupeFacts(seeds.flatMap(seed => unfold(seed, kb, new Set(), { fresh }).frontier))
  const budget = { maxDerivations }
  const sat = saturate(kb, frontier, { goal, ...budget })
  // The search stops at the goal; to rule out a contradiction it must be carried on to the end,
  // which is only worth doing if `false` is derivable at all from these kinds of facts.
  const contradictory = sat.holds(goal)
    ? mayDerive(kb, frontier, FALSE.name) && saturate(kb, frontier, { goal: FALSE, ...budget }).holds(FALSE)
    : sat.holds(FALSE)
  return {
    result: contradictory ? 'vacuous' : sat.holds(goal) ? 'verified' : 'not-provable',
    facts: sat.allFacts(),
  }
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
  maxDerivations = 200_000,
): CheckResponse {
  const seeds = withMissingHeadObjects(
    lemma.hypotheses.map(toGroundPredicate),
    lemma,
  )
  return runCheckPipeline(toGroundPredicate(lemma.head), seeds, kb, maxDerivations)
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
