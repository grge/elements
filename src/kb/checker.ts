import type { Lemma, Predicate } from '../language/parser'
import { Configuration } from './configuration'
import { forwardClosure, groundKey, unfold, type GroundPredicate, type KnowledgeBase } from './inference'

export type CheckResult = 'verified' | 'not-provable' | 'invalid-query'

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

function runCheckPipeline(
  goal: GroundPredicate,
  seeds: readonly GroundPredicate[],
  kb: KnowledgeBase,
  maxSteps: number,
): CheckResponse {
  const frontier = dedupeFacts(seeds.flatMap(seed => unfold(seed, kb).frontier))
  const facts = forwardClosure(kb, frontier, maxSteps, groundKey(goal))
  return {
    result: facts.some(f => groundKey(f) === groundKey(goal)) ? 'verified' : 'not-provable',
    facts,
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
  maxSteps = 2000,
): CheckResponse {
  const seeds = withMissingHeadObjects(
    lemma.hypotheses.map(toGroundPredicate),
    lemma,
  )
  return runCheckPipeline(toGroundPredicate(lemma.head), seeds, kb, maxSteps)
}

export function checkGroundQuery(
  pred: Predicate,
  kb: KnowledgeBase,
  configuration: Configuration,
  maxSteps = 2000,
): CheckResponse {
  const missing = pred.args.filter(arg => !configuration.universe.has(arg))
  if (missing.length > 0) {
    return {
      result: 'invalid-query',
      facts: configuration.allFacts(),
      message: `Ground query mentions objects not in the configuration universe: ${missing.join(', ')}`,
    }
  }
  return runCheckPipeline(toGroundPredicate(pred), configuration.allFacts(), kb, maxSteps)
}
