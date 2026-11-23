/**
 * Checks a page's `?` lines off the main thread, posting a mark for each as it is decided. The checking
 * itself is geometry/pageCheck.ts; this is its shell, and keeps the proofs found for the worker's life.
 */

import type { Rule } from '../language/parser'
import type { RuleChapters } from '../kb/bookScope'
import { checkPage, KeptProofs } from '../geometry/pageCheck'
import type { EditorMark } from '../components/CodeEditor.vue'

interface VerifyRequest {
  requestId: number
  text: string
  rules: Rule[]
  ruleChapters?: RuleChapters
  lineChapters?: readonly (number | null)[]
}

type VerifyResponse =
  | { requestId: number; kind: 'mark'; mark: EditorMark }
  | { requestId: number; kind: 'done' }
  | { requestId: number; kind: 'error'; message: string }

const kept = new KeptProofs()

self.onmessage = (event: MessageEvent<VerifyRequest>) => {
  const { requestId, ...request } = event.data
  const post = (r: VerifyResponse) => self.postMessage(r)
  try {
    checkPage(request, kept, ({ line, endLine, type, message, note }) =>
      post({ requestId, kind: 'mark', mark: { line, ...(endLine !== undefined ? { endLine } : {}), type, message, ...(note ? { note } : {}) } }))
    post({ requestId, kind: 'done' })
  } catch (error) {
    post({ requestId, kind: 'error', message: `${error}` })
  }
}
