/**
 * The verdict shown beside a `?` line: the proof search's result, weighed against numeric evidence
 * (evidence.ts). Not derived and failing in a sampled figure is false; not derived and holding in
 * every sample is probably true; derived yet failing in a sample is an alarm (a false axiom or a bug).
 * Derived, with hypotheses neither witnessed by a figure nor searched to the end, is not a ✓.
 *
 * It weighs a proof against figures, so it sits above both the logic (kb/) and the figures; the
 * editor shows it.
 */

import type { CheckResponse, StepResult, WrittenCheck } from '../kb/checker'
import { displayName } from '../kb/names'
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
      return { type: 'vacuous', message: check.message
        ? `holds only vacuously: ${check.message}`
        : 'holds only vacuously: the hypotheses contradict each other' }
    case 'invalid-query':
      return { type: 'false', message: check.message ?? 'not a question about this page' }
    case 'unshown':
      return { type: 'unproven', message: 'follows, but the hypotheses could not be shown consistent: no figure of them was found, and the search for a contradiction ran out of its budget' }
    case 'verified':
      return ev?.kind === 'fails'
        ? { type: 'alarm', message: `proven, yet ${ev.failing} fails in a sampled figure: an axiom may be false` }
        : { type: 'verified', message: check.apart ? 'follows, for figures whose points are all apart' : 'follows' }
    default:
      if (ev?.kind === 'fails') return { type: 'false', message: `false: ${ev.failing} fails in a figure that satisfies the hypotheses` }
      if (ev?.kind === 'holds') return { type: 'unproven', message: `${gaveUp}, but it holds in all ${ev.samples} sampled figures` }
      return { type: 'unproven', message: `${gaveUp}${ev?.kind === 'none' ? ` (no figures to test: ${ev.why})` : ''}` }
  }
}


/** A step of a written proof, as its line's mark shows it. `note`: the message shows under a ✓ too. */
export interface StepVerdict extends Verdict { line: number; note?: boolean }

function stepVerdict(s: StepResult): StepVerdict {
  const pts = (s.newPoints ?? []).map(displayName).join(', ')
  switch (s.result) {
    case 'follows':
      return { line: s.line, type: 'verified', message: s.apart ? 'follows from the lines above, for figures whose points are all apart' : 'follows from the lines above' }
    case 'not-shown':
      return { line: s.line, type: 'unproven', message: 'not shown from the lines above by a short search; taken as given below' }
    case 'refused':
      return { line: s.line, type: 'false', message: `cannot construct ${pts}: ${s.construction?.why ?? 'no figure'}` }
    case 'constructed': {
      const c = s.construction!
      const how = c.determined ? 'determined' : 'freely chosen'
      const exists = c.existence === 'unconditional' ? 'always exists' : 'exists in every sampled figure'
      const apart = c.apart ? '' : `; not apart from the other points (${c.why ?? 'in some figure'}), so not taken as different from them`
      return { line: s.line, type: 'verified', note: true, message: `constructs ${pts}: ${how}, ${exists}${apart}` }
    }
  }
}

/**
 * A lemma with a written proof: each step's verdict, and the lemma's, from its head and its steps. A
 * step not shown, or a construction refused, leaves the lemma unproven, even if its head follows
 * from the steps; a construction that exists only as the figures witness it hedges the ✓ (tools.md).
 */
export function writtenVerdicts(check: WrittenCheck, evidence: Evidence | null): { head: Verdict; steps: StepVerdict[] } {
  const steps = check.steps.map(stepVerdict)
  const head = verdict(check.head, evidence)
  const gap = check.steps.find(s => s.result === 'not-shown' || s.result === 'refused')
  if (gap && (head.type === 'verified' || head.type === 'unproven')) {
    const what = gap.result === 'refused' ? 'its construction' : 'its step'
    return { steps, head: { type: 'unproven', message: `${head.type === 'verified' ? 'follows from its steps, but' : 'not shown, and'} ${what} on line ${gap.line} is not shown` } }
  }
  const witnessed = check.steps.find(s => s.result === 'constructed' && s.construction?.existence === 'witnessed')
  if (head.type === 'verified' && witnessed) {
    return { steps, head: { ...head, message: `${head.message}, given its construction (line ${witnessed.line})` } }
  }
  return { steps, head }
}
