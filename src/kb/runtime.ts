/**
 * A page's runtime: the knowledge base extended with the page's own rules, and the configuration
 * holding its ground facts. Queries are checked separately (checker.ts, in the worker).
 */

import type { TopLevel } from '../language/parser'
import { Configuration } from './configuration'
import { KnowledgeBase } from './inference'

export interface RuntimeState {
  kb: KnowledgeBase
  configuration: Configuration
}

export function buildRuntimeState(baseKB: KnowledgeBase, parsed: TopLevel[]): RuntimeState {
  const kb = baseKB.extend(parsed.flatMap(item => item.kind === 'rule' ? [item.rule] : []))
  const configuration = new Configuration()
  configuration.addFacts(parsed.flatMap(item => item.kind === 'goal' ? [{ name: item.pred.name, args: item.pred.args }] : []))
  return { kb, configuration }
}
