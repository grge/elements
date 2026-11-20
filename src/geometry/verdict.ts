/**
 * The verdict shown beside a `?` line: the proof search's result, weighed against numeric evidence
 * (evidence.ts). Not derived and failing in a sampled figure is false; not derived and holding in
 * every sample is probably true; derived yet failing in a sample is an alarm (a false axiom or a bug).
 * Derived, with hypotheses neither witnessed by a figure nor searched to the end, is not a ✓.
 *
 * It weighs a proof against figures, so it sits above both the logic (kb/) and the figures; the
 * editor shows it.
 */

import type { CheckResponse } from '../kb/checker'
import type { Evidence } from './evidence'

/**
 * verified ✓ proven; vacuous ⊥ the hypotheses contradict each other; false ✗ a sampled figure refutes
 * it; unproven ? not proven (the reason says why, and whether it held in every sampled figure); alarm !
 * proven, yet a sampled figure refutes it; unknown … being checked.
 */
export type VerdictType = 'verified' | 'vacuous' | 'false' | 'unproven' | 'alarm' | 'unknown'

export interface Verdict { type: VerdictType; message: string }

/** The verdict on a lemma, from its proof search and (if there is any) its numeric evidence. */
export function verdict(check: CheckResponse, evidence: Evidence | null): Verdict {
  const ev = evidence
  const gaveUp = check.result === 'out-of-budget' ? 'the search ran out of its budget' : 'not derived'
  switch (check.result) {
    case 'vacuous':
      return { type: 'vacuous', message: 'holds only vacuously: the hypotheses contradict each other' }
    case 'invalid-query':
      return { type: 'false', message: check.message ?? 'not a question about this page' }
    case 'unshown':
      return { type: 'unproven', message: 'follows, but the hypotheses could not be shown consistent: no figure of them was found, and the search for a contradiction ran out of its budget' }
    case 'verified':
      return ev?.kind === 'fails'
        ? { type: 'alarm', message: `proven, yet ${ev.failing} fails in a sampled figure: an axiom may be false` }
        : { type: 'verified', message: 'follows' }
    default:
      if (ev?.kind === 'fails') return { type: 'false', message: `false: ${ev.failing} fails in a figure that satisfies the hypotheses` }
      if (ev?.kind === 'holds') return { type: 'unproven', message: `${gaveUp}, but it holds in all ${ev.samples} sampled figures` }
      return { type: 'unproven', message: `${gaveUp}${ev?.kind === 'none' ? ` (no figures to test: ${ev.why})` : ''}` }
  }
}

