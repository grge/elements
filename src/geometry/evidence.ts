/**
 * Numeric evidence for a lemma: does its head hold in figures that satisfy its hypotheses?
 *
 * The hypotheses are unfolded and planned as a construction, like any figure (extraction.ts); a
 * couple of dozen well-spread configurations are sampled, and the head, unfolded too, is evaluated
 * on each. One configuration where it fails refutes the lemma (a counterexample); holding in all of
 * them makes it probably true, not proven. Evidence is only offered when every hypothesis can be
 * drawn: a hypothesis the figure ignores would make a "counterexample" meaningless.
 *
 * The drawing takes distinct names for distinct points, so a lemma that is false only in a
 * degenerate configuration (two of its points coinciding) holds in every sample.
 */

import type { KnowledgeBase } from '../kb/inference'
import { FreshNames, displayName } from '../kb/names'
import type { Lemma } from '../language/parser'
import { buildModel, configurations, plan, type Point } from './construction'
import { extract } from './extraction'
import { holds, relationOf } from './relations'

export { holds }

export type Evidence =
  | { kind: 'none'; why: string }
  | { kind: 'holds'; samples: number }
  | { kind: 'fails'; samples: number; coords: Map<string, Point>; failing: string }

const SAMPLES = 24

export function numericEvidence(lemma: Lemma, kb: KnowledgeBase, samples = SAMPLES): Evidence {
  // Hypotheses and head are read like a page's facts (extraction.ts), sharing auxiliary names.
  const fresh = new FreshNames()
  const given = extract(kb, lemma.hypotheses.map(h => ({ name: h.name, args: h.args })), { fresh })
  if (given.unread.length) return { kind: 'none', why: `${given.unread[0].name} cannot be drawn` }
  const hypotheses = given.constraints

  const known = new Set(hypotheses.flatMap(f => f.args))
  const claim = extract(kb, [{ name: lemma.head.name, args: lemma.head.args }], { fresh })
  // The head is evaluated, not drawn: a relation the figure cannot impose can still be measured.
  const unmeasurable = claim.unread.find(f => !relationOf(f))
  if (unmeasurable) return { kind: 'none', why: `${unmeasurable.name} cannot be measured` }
  const goal = [...claim.constraints, ...claim.unread]
  // Points the head's own definition introduces would need witnesses: some point exists such that…
  if (goal.some(f => f.args.some(a => a.includes('#') && !known.has(a)))) {
    return { kind: 'none', why: 'the claim introduces points of its own' }
  }

  // Points only the head mentions are arbitrary: free points of the figure.
  const model = buildModel(hypotheses)
  for (const p of lemma.head.args) if (!model.points.includes(p)) model.points.push(p)
  const cp = plan(model)
  const figures = configurations(cp, samples)
  if (figures.length === 0) return { kind: 'none', why: 'no figure satisfies the hypotheses' }

  for (const coords of figures) {
    const failing = goal.find(f => !holds(f, coords))
    if (failing) {
      return { kind: 'fails', samples: figures.length, coords, failing: `${failing.name} ${failing.args.map(displayName).join(' ')}` }
    }
  }
  return { kind: 'holds', samples: figures.length }
}
