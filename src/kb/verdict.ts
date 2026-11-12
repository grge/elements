/**
 * The verdict shown beside a `?` line: the proof search's result, weighed against numeric evidence
 * (geometry/evidence.ts). Not derived and failing in a sampled figure is false; not derived and holding
 * in every sample is probably true; derived yet failing in a sample is an alarm (a false axiom or a bug).
 */

import type { CheckResponse } from './checker'
import type { Evidence } from '../geometry/evidence'
import type { EditorMark } from '../components/CodeEditor.vue'

export type Verdict = Pick<EditorMark, 'type' | 'message'>

/** The verdict on a lemma, from its proof search and (if there is any) its numeric evidence. */
export function verdict(check: CheckResponse, evidence: Evidence | null): Verdict {
  const ev = evidence
  const gaveUp = check.result === 'out-of-budget' ? 'the search ran out of its budget' : 'not derived'
  switch (check.result) {
    case 'vacuous':
      return { type: 'vacuous', message: 'holds only vacuously: the hypotheses contradict each other' }
    case 'invalid-query':
      return { type: 'false', message: check.message ?? 'not a question about this page' }
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

