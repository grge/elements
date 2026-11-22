/**
 * Checks a page's `?` lines off the main thread, posting a mark for each as it is decided.
 *
 * A lemma's verdict combines the proof search with numeric evidence (geometry/evidence.ts): a lemma
 * that is not derived but fails in a sampled figure is false; one that holds in every sample is
 * probably true; one that is derived yet fails in a sample raises an alarm (a false axiom or a bug).
 */

import { parseSource, type Rule } from '../language/parser'
import { buildRuntimeState } from '../kb/runtime'
import { KnowledgeBase } from '../kb/inference'
import { checkByReplay, checkGroundQuery, checkLemma } from '../kb/checker'
import { showRule } from '../kb/rules'
import type { Proof } from '../kb/proof'
import { proofView, type ProofView } from '../kb/proofView'
import { numericEvidence, type Evidence } from '../geometry/evidence'
import { verdict, type Verdict } from '../geometry/verdict'
import type { EditorMark } from '../components/CodeEditor.vue'

interface VerifyRequest {
  requestId: number
  text: string
  rules: Rule[]
}

type VerifyResponse =
  | { requestId: number; kind: 'mark'; mark: EditorMark }
  | { requestId: number; kind: 'done' }
  | { requestId: number; kind: 'error'; message: string }

/**
 * Proofs kept from earlier checks, by the lemma's text: a later check replays one before it searches
 * (checker.ts, `checkByReplay`), so an edit elsewhere on the page, which changes the knowledge base,
 * does not send every lemma back to its search. Kept for the worker's life, the most recent last.
 */
const kept = new Map<string, { proof: Proof; apart: boolean }>()
const KEPT = 200
const lemmaKey = (l: { head: { name: string; args: string[] }; hypotheses: { name: string; args: string[] }[] }) =>
  `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`

self.onmessage = (event: MessageEvent<VerifyRequest>) => {
  const { requestId, text, rules } = event.data
  const post = (r: VerifyResponse) => self.postMessage(r)

  try {
    const parsed = parseSource(text)
    const runtime = buildRuntimeState(new KnowledgeBase(rules), parsed)

    for (const item of parsed) {
      if (item.kind !== 'lemma' && item.kind !== 'ground-query') continue
      const line = (item.sourceRef?.startLine ?? 1) - 1
      const endLine = (item.sourceRef?.endLine ?? line + 1) - 1
      try {
        let v: Verdict
        let proof: ProofView | undefined
        if (item.kind === 'lemma') {
          // Evidence first: its figures also witness that the hypotheses are consistent, which spares the
          // checker its search for a contradiction.
          let ev: Evidence | null = null
          try { ev = numericEvidence(item.lemma, runtime.kb) } catch { ev = null }
          const options = { consistent: () => !!ev?.witness, strict: true, distinctNames: true, explain: true }
          const key = lemmaKey(item.lemma)
          const keptProof = kept.get(key)
          const check = (keptProof && checkByReplay(item.lemma, runtime.kb, keptProof, showRule, options))
            ?? checkLemma(item.lemma, runtime.kb, undefined, options)
          if (check.result === 'verified' && check.proof) {
            kept.delete(key)
            kept.set(key, { proof: check.proof, apart: !!check.apart })
            if (kept.size > KEPT) kept.delete(kept.keys().next().value!)
          }
          v = verdict(check, ev)
          if (v.type === 'verified' && check.proof) proof = proofView(check.proof)
        } else {
          v = verdict(checkGroundQuery(item.pred, runtime.kb, runtime.configuration), null)
        }
        post({ requestId, kind: 'mark', mark: { line, endLine, ...v, ...(proof ? { proof } : {}) } })
      } catch (error) {
        post({ requestId, kind: 'mark', mark: { line, endLine, type: 'unproven', message: `could not be checked: ${error}` } })
      }
    }
    post({ requestId, kind: 'done' })
  } catch (error) {
    post({ requestId, kind: 'error', message: `${error}` })
  }
}
