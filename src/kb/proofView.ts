/**
 * A proof as the page shows it, folded under its ✓ (proof.ts has the proof itself).
 *
 * The steps that carry the argument are shown in order. Side conditions are kept apart, to be
 * unfolded on demand: the incidence and non-degeneracy facts (`distinct`, `triangle`, `collinear`,
 * `between`), any rule step that rests on nothing else, and ratios that are one on both sides
 * (`eq-ratio c a c a c b c b`, a rule applied to a degenerate figure: the solver uses it as an
 * equation, but it says nothing). They are needed for the replay, not for a reader. A rule is named
 * by its text; the page turns that into a link to where it is written.
 *
 * Plain data, so the checking worker can post it.
 */

import type { Rule } from '../language/parser'
import type { GroundPredicate } from './inference'
import { displayName } from './names'
import type { Proof, ProofStep } from './proof'
import { showRule } from './rules'
import { citedLemma } from './checker'

export interface ProofViewStep {
  /** The fact, as the source would write it, auxiliary names subscripted (`d₁`). */
  fact: string
  /** Why, in a few words: `rule` for a rule, `lemma` for a lemma cited, or the structure's reason. */
  why: string
  /** For a rule step: the rule's text (`showRule`), by which the page finds where it is written. */
  rule?: string
  /** For a rule step: the predicate the rule concludes, whose page has it. */
  head?: string
}

export interface ProofView {
  steps: ProofViewStep[]
  /** Side conditions, folded: shown only on demand. */
  side: ProofViewStep[]
}

/** Predicates of incidence and non-degeneracy: side conditions in a proof. */
const SIDE = new Set(['distinct', 'triangle', 'collinear', 'between', '__object__'])

const SOLVED: Record<string, string> = { 'eq-turn': 'adding the turns', 'eq-ratio': 'multiplying the ratios', 'quad-sum': 'adding the quadrances' }

const segment = (a: readonly string[], i: number) => [a[i], a[i + 1]].sort().join(' ')
/** `eq-ratio a b a b c d c d`, or `eq-ratio a b c d a b c d`: true of any figure. */
const trivialRatio = (f: GroundPredicate) => f.name === 'eq-ratio' && f.args.length === 8 &&
  ((segment(f.args, 0) === segment(f.args, 2) && segment(f.args, 4) === segment(f.args, 6)) ||
   (segment(f.args, 0) === segment(f.args, 4) && segment(f.args, 2) === segment(f.args, 6)))

const atom = (f: GroundPredicate) => [f.name, ...f.args.map(displayName)].join(' ')

function why(st: ProofStep): Pick<ProofViewStep, 'why' | 'rule' | 'head'> {
  switch (st.by.kind) {
    case 'rule': {
      const lemma = citedLemma(st.by.rule as Rule)
      if (lemma) return { why: 'lemma', rule: `? ${lemma.head.name} ${lemma.head.args.join(' ')}: ${lemma.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`, head: lemma.head.name }
      return { why: 'rule', rule: showRule(st.by.rule as Rule), head: st.by.rule.head.name }
    }
    case 'solver': return { why: SOLVED[st.by.relation] ?? `adding the ${st.by.relation} facts` }
    case 'chain': return { why: 'a chain of equals' }
    case 'same': return { why: 'the same, read another way' }
    case 'definition': return { why: 'by definition' }
  }
}

export function proofView(proof: Proof): ProofView {
  const steps: ProofViewStep[] = [], side: ProofViewStep[] = []
  const goal = atom(proof.goal)
  for (const st of proof.steps) {
    const v = { fact: atom(st.fact), ...why(st) }
    const isSide = v.fact !== goal && (SIDE.has(st.fact.name) || trivialRatio(st.fact) ||
      (st.by.kind === 'rule' && st.premises.every(p => SIDE.has(p.name))))
    ;(isSide ? side : steps).push(v)
  }
  return { steps, side }
}
