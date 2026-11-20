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

import type { GroundPredicate, KnowledgeBase } from '../kb/inference'
import { FreshNames, displayName } from '../kb/names'
import type { Lemma } from '../language/parser'
import { buildModel, configurations, plan, type Point } from './construction'
import { extract } from './extraction'
import { holds, relationOf } from './relations'

export { holds }

/**
 * Evidence carries, where it found one, a witness: a figure in which every hypothesis holds, with a
 * margin against degenerate figures (`isWitness`). Hypotheses that have a figure are consistent, so
 * the checker need not search for a contradiction (checker.ts). A witness needs only the hypotheses,
 * so it is found even when the claim cannot be measured.
 */
export type Evidence =
  | { kind: 'none'; why: string; witness?: Map<string, Point> }
  | { kind: 'holds'; samples: number; witness?: Map<string, Point> }
  | { kind: 'fails'; samples: number; coords: Map<string, Point>; failing: string; witness?: Map<string, Point> }

const SAMPLES = 24

/** Distinct points this far apart, as a share of the figure's size, and triangles this much area. */
const MARGIN = 1e-3

/**
 * Is this figure a witness of these facts? Each must hold (the figure was constructed to make them
 * hold, and checked), and those that rule out degenerate figures must hold with a margin: distinct
 * points well apart, a triangle well clear of a line. A figure that only just scrapes through
 * witnesses nothing.
 */
export function isWitness(facts: readonly GroundPredicate[], coords: ReadonlyMap<string, Point>): boolean {
  const ps = [...coords.values()]
  if (!ps.length) return false
  const xs = ps.map(p => p[0]), ys = ps.map(p => p[1])
  const size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  if (!(size > 0)) return false
  const at = (q: string) => coords.get(q)
  return facts.every(f => {
    const pts = f.args.map(at)
    if (pts.some(p => !p)) return false
    if (!holds(f, coords as Map<string, Point>)) return false
    if (f.name === 'distinct') {
      const [a, b] = pts as Point[]
      return Math.hypot(a[0] - b[0], a[1] - b[1]) >= MARGIN * size
    }
    if (f.name === 'triangle') {
      const [a, b, c] = pts as Point[]
      return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2 >= MARGIN * size * size
    }
    return true
  })
}

export function numericEvidence(lemma: Lemma, kb: KnowledgeBase, samples = SAMPLES): Evidence {
  // Hypotheses and head are read like a page's facts (extraction.ts), sharing auxiliary names.
  const fresh = new FreshNames()
  const given = extract(kb, lemma.hypotheses.map(h => ({ name: h.name, args: h.args })), { fresh })
  if (given.unread.length) return { kind: 'none', why: `${given.unread[0].name} cannot be drawn` }
  const hypotheses = given.constraints

  // Points only the head mentions are arbitrary: free points of the figure.
  const model = buildModel(hypotheses)
  for (const p of lemma.head.args) if (!model.points.includes(p)) model.points.push(p)
  const figures = configurations(plan(model), samples)
  const witness = figures.find(coords => isWitness(hypotheses, coords))
  if (figures.length === 0) return { kind: 'none', why: 'no figure satisfies the hypotheses' }

  const known = new Set(hypotheses.flatMap(f => f.args))
  const claim = extract(kb, [{ name: lemma.head.name, args: lemma.head.args }], { fresh })
  // The head is evaluated, not drawn: a relation the figure cannot impose can still be measured.
  const unmeasurable = claim.unread.find(f => !relationOf(f))
  if (unmeasurable) return { kind: 'none', why: `${unmeasurable.name} cannot be measured`, witness }
  const goal = [...claim.constraints, ...claim.unread]
  // Points the head's own definition introduces would need witnesses: some point exists such that…
  if (goal.some(f => f.args.some(a => a.includes('#') && !known.has(a)))) {
    return { kind: 'none', why: 'the claim introduces points of its own', witness }
  }

  for (const coords of figures) {
    const failing = goal.find(f => !holds(f, coords))
    if (failing) {
      return { kind: 'fails', samples: figures.length, coords, failing: `${failing.name} ${failing.args.map(displayName).join(' ')}`, witness }
    }
  }
  return { kind: 'holds', samples: figures.length, witness }
}
