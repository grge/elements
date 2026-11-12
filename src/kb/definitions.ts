/**
 * Which clauses are definitions.
 *
 * The language reads a predicate's defining clause as if-and-only-if (its Clark completion): from
 * `eq-triangle a b c` we may conclude `circle a b c`. Every other clause is a one-way implication.
 * There is no syntax for this; the defining clause is recognised:
 *
 *   A predicate is DEFINED by clause D when
 *     1. D has a non-empty body and is not recursive (recursive = the head predicate is reachable
 *        from the clause's own body through the rules), and
 *     2. every other clause for the predicate is provable from D.
 *   When several clauses qualify (equivalent characterisations) the first in source order is used.
 *   Otherwise the predicate is OPEN: it is only ever derived, never unfolded.
 *
 * This is exactly "the completion of all of the predicate's clauses is a single conjunction": if
 * every other clause follows from D, each of their bodies implies D's body, so the disjunction of
 * all the bodies is just D's body. Consequences:
 *   - adding a true rule such as `eq-triangle a b c: eq-triangle b c a` leaves the meaning unchanged;
 *   - adding a weaker clause (`eq-triangle a b c: circle a b c`) makes that clause the definition,
 *     because that is what the clauses now say;
 *   - genuinely alternative clauses leave the predicate open, and the status says why.
 *
 * A lone one-way rule (`tall x: giraffe x`) is read as a definition. That is the language's stated
 * semantics: the knowledge base's author must write definitions as definitions.
 */

import type { Rule } from '../language/parser'
import { KnowledgeBase, unfold, type GroundPredicate } from './inference'
import { FreshNames } from './names'
import { saturate } from './saturate'
import { fingerprint, Lru, showRule } from './rules'

export type DefinitionStatus =
  | {
      kind: 'definition'
      clause: Rule
      /** Further clauses for the predicate, each proven to follow from the definition. */
      theorems: Rule[]
    }
  | { kind: 'open'; reason: string }

const cache = new Lru<Map<string, DefinitionStatus>>(16)

export function analyseDefinitions(rules: readonly Rule[]): Map<string, DefinitionStatus> {
  const key = fingerprint(rules)
  return cache.get(key) ?? cache.set(key, analyse(rules))
}

function analyse(rules: readonly Rule[]): Map<string, DefinitionStatus> {
  const byHead = new Map<string, Rule[]>()
  const dependsOn = new Map<string, Set<string>>()
  for (const r of rules) {
    if (!byHead.has(r.head.name)) byHead.set(r.head.name, [])
    byHead.get(r.head.name)!.push(r)
    if (!dependsOn.has(r.head.name)) dependsOn.set(r.head.name, new Set())
    for (const b of r.body) dependsOn.get(r.head.name)!.add(b.name)
  }

  const reachCache = new Map<string, Set<string>>()
  const reachable = (p: string): Set<string> => {
    let out = reachCache.get(p)
    if (out) return out
    out = new Set()
    const stack = [...(dependsOn.get(p) ?? [])]
    while (stack.length) {
      const q = stack.pop()!
      if (out.has(q)) continue
      out.add(q)
      stack.push(...(dependsOn.get(q) ?? []))
    }
    reachCache.set(p, out)
    return out
  }
  const isRecursive = (r: Rule) =>
    r.body.some(b => b.name === r.head.name || reachable(b.name).has(r.head.name))

  const status = new Map<string, DefinitionStatus>()
  // Predicates whose choice of definition still has to be justified by proofs, with their candidates.
  const pending = new Map<string, { clauses: Rule[]; candidates: Rule[]; tried: number }>()

  for (const [p, clauses] of byHead) {
    const candidates = clauses.filter(c => c.body.length > 0 && !isRecursive(c))
    if (candidates.length === 0) {
      status.set(p, {
        kind: 'open',
        reason: clauses.every(c => c.body.length === 0) ? 'only axioms' : 'every clause is recursive',
      })
      continue
    }
    const clause = candidates[0]
    status.set(p, { kind: 'definition', clause, theorems: clauses.filter(c => c !== clause) })
    if (clauses.length > 1) pending.set(p, { clauses, candidates, tried: 0 })
  }

  // Check that the other clauses of each defined predicate follow from its chosen definition; if not,
  // try the next candidate. A change to one predicate can break another's proof, so repeat until
  // stable. Candidates only ever advance, so this terminates.
  for (let changed = true; changed;) {
    changed = false
    for (const [p, entry] of pending) {
      const st = status.get(p)
      if (st?.kind !== 'definition') continue
      const kb = new KnowledgeBase(
        rules.filter(r => r.head.name !== p || r === st.clause),
        { definitions: status },
      )
      const failing = st.theorems.find(t => !follows(t, kb))
      if (!failing) continue
      changed = true
      entry.tried++
      const next = entry.candidates[entry.tried]
      status.set(p, next
        ? { kind: 'definition', clause: next, theorems: entry.clauses.filter(c => c !== next) }
        : {
            kind: 'open',
            reason: entry.candidates.length === 1
              ? `"${showRule(failing)}" does not follow from "${showRule(entry.candidates[0])}"`
              : `none of its clauses implies all the others (${entry.candidates.length} alternatives)`,
          })
    }
  }

  return status
}

/** Does `rule` (as a universally quantified clause) follow in `kb`? Same procedure as the checker. */
function follows(rule: Rule, kb: KnowledgeBase): boolean {
  const fresh = new FreshNames()
  const goal: GroundPredicate = { name: rule.head.name, args: rule.head.args }
  const hypotheses = rule.body.flatMap(b => unfold({ name: b.name, args: b.args }, kb, new Set(), { fresh }).frontier)
  const objects = rule.head.args.map(a => ({ name: '__object__', args: [a] }))
  return saturate(kb, [...hypotheses, ...objects], { goal }).holds(goal)
}
