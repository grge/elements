import type { Predicate, Rule, TopLevel, Lemma } from '../language/parser'
import { Configuration } from './configuration'
import { KnowledgeBase, type GroundPredicate } from './inference'

export interface RuntimeAnalysis {
  parsed: TopLevel[]
  rules: Rule[]
  groundFacts: Predicate[]
  groundQueries: Predicate[]
  queriedClauses: Lemma[]
  geometryGoals: Predicate[]
}

export interface RuntimeState {
  analysis: RuntimeAnalysis
  kb: KnowledgeBase
  configuration: Configuration
}

export function analyzeRuntime(parsed: TopLevel[]): RuntimeAnalysis {
  const rules = parsed
    .filter((item): item is Extract<TopLevel, { kind: 'rule' }> => item.kind === 'rule')
    .map(item => item.rule)

  const groundFacts = parsed
    .filter((item): item is Extract<TopLevel, { kind: 'goal' }> => item.kind === 'goal')
    .map(item => item.pred)

  const groundQueries = parsed
    .filter((item): item is Extract<TopLevel, { kind: 'ground-query' }> => item.kind === 'ground-query')
    .map(item => item.pred)

  const queriedClauses = parsed
    .filter((item): item is Extract<TopLevel, { kind: 'lemma' }> => item.kind === 'lemma')
    .map(item => item.lemma)

  return {
    parsed,
    rules,
    groundFacts,
    groundQueries,
    queriedClauses,
    geometryGoals: groundFacts,
  }
}

export function buildRuntimeState(baseKB: KnowledgeBase, parsed: TopLevel[]): RuntimeState {
  const analysis = analyzeRuntime(parsed)
  const kb = baseKB.extend(analysis.rules)
  const configuration = new Configuration()
  const facts: GroundPredicate[] = analysis.groundFacts.map(pred => ({ name: pred.name, args: pred.args }))
  configuration.addFacts(facts)
  return { analysis, kb, configuration }
}
