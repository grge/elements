/**
 * Checks a page's `?` lines off the main thread, posting a mark for each as it is decided.
 */

import { parseSource, type Rule } from '../language/parser'
import { buildRuntimeState } from '../kb/runtime'
import { KnowledgeBase } from '../kb/inference'
import { checkGroundQuery, checkLemma, type CheckResult } from '../kb/checker'
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

const TYPE: Record<CheckResult, EditorMark['type']> = {
  'verified': 'verified',
  'vacuous': 'vacuous',
  'not-provable': 'failed',
  'invalid-query': 'failed',
}

const REASON: Record<CheckResult, string> = {
  'verified': 'follows',
  'vacuous': 'holds only vacuously: the hypotheses contradict each other',
  'not-provable': 'not derived (which does not make it false)',
  'invalid-query': 'not a question about this page',
}

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
        const r = item.kind === 'lemma'
          ? checkLemma(item.lemma, runtime.kb)
          : checkGroundQuery(item.pred, runtime.kb, runtime.configuration)
        post({ requestId, kind: 'mark', mark: { line, endLine, type: TYPE[r.result], message: r.message ?? REASON[r.result] } })
      } catch (error) {
        post({ requestId, kind: 'mark', mark: { line, endLine, type: 'failed', message: `could not be checked: ${error}` } })
      }
    }
    post({ requestId, kind: 'done' })
  } catch (error) {
    post({ requestId, kind: 'error', message: `${error}` })
  }
}

export {}
