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
import { checkGroundQuery, checkLemma } from '../kb/checker'
import { numericEvidence, type Evidence } from '../geometry/evidence'
import { verdict, type Verdict } from '../kb/verdict'
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
        if (item.kind === 'lemma') {
          const check = checkLemma(item.lemma, runtime.kb)
          let ev: Evidence | null = null
          try { ev = numericEvidence(item.lemma, runtime.kb) } catch { ev = null }
          v = verdict(check, ev)
        } else {
          v = verdict(checkGroundQuery(item.pred, runtime.kb, runtime.configuration), null)
        }
        post({ requestId, kind: 'mark', mark: { line, endLine, ...v } })
      } catch (error) {
        post({ requestId, kind: 'mark', mark: { line, endLine, type: 'unproven', message: `could not be checked: ${error}` } })
      }
    }
    post({ requestId, kind: 'done' })
  } catch (error) {
    post({ requestId, kind: 'error', message: `${error}` })
  }
}
