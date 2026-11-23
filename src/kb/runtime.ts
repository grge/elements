/**
 * A page's runtime: the knowledge base extended with the page's own rules, and the configuration
 * holding its ground facts. Queries are checked separately (checker.ts, in the worker).
 */

import type { TopLevel } from '../language/parser'
import { Configuration } from './configuration'
import { KnowledgeBase } from './inference'
import { showRule } from './rules'

export interface RuntimeState {
  kb: KnowledgeBase
  configuration: Configuration
}

/**
 * The page's rules join the knowledge base, except those it already has: on a book page, the text is the
 * book's own clauses, which are there already with their modules (modules.ts). Added again, without a
 * module, they would be in every search's first level, and every rule would be matched twice.
 */
export function buildRuntimeState(baseKB: KnowledgeBase, parsed: TopLevel[]): RuntimeState {
  const known = new Set(baseKB.allRules().map(showRule))
  const own = parsed.flatMap(item => item.kind === 'rule' && !known.has(showRule(item.rule)) ? [item.rule] : [])
  const kb = own.length ? baseKB.extend(own) : baseKB
  const configuration = new Configuration()
  configuration.addFacts(parsed.flatMap(item => item.kind === 'goal' ? [{ name: item.pred.name, args: item.pred.args }] : []))
  return { kb, configuration }
}
