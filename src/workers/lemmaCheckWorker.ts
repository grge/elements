import { parseSource, type Rule } from '../language/parser'
import { buildRuntimeState } from '../kb/runtime'
import { KnowledgeBase } from '../kb/inference'
import { checkGroundQuery, checkLemma } from '../kb/checker'

interface VerifyRequest {
  requestId: number
  text: string
  rules: Rule[]
  mode: 'scratchpad' | 'predicate'
}

interface VerifyMark {
  line: number
  type: 'verified' | 'failed' | 'unknown'
  message: string
}

type VerifyResponse =
  | { requestId: number; kind: 'mark'; mark: VerifyMark }
  | { requestId: number; kind: 'done' }
  | { requestId: number; kind: 'error'; message: string }

self.onmessage = (event: MessageEvent<VerifyRequest>) => {
  const { requestId, text, rules } = event.data

  try {
    const lines = text.split('\n')
    const queryLineNumbers = lines
      .map((l, i) => ({ i, isQuery: l.trimStart().startsWith('?') }))
      .filter(x => x.isQuery)
      .map(x => x.i)

    const parsed = parseSource(text)
    const runtime = buildRuntimeState(new KnowledgeBase(rules), parsed)

    let queryIndex = 0
    for (const item of parsed) {
      if (item.kind !== 'lemma' && item.kind !== 'ground-query') continue
      const lineNum = queryLineNumbers[queryIndex++] ?? 0
      try {
        const result = item.kind === 'lemma'
          ? checkLemma(item.lemma, runtime.kb)
          : checkGroundQuery(item.pred, runtime.kb, runtime.configuration)

        const response: VerifyResponse = {
          requestId,
          kind: 'mark',
          mark: {
            line: lineNum,
            type: result.result === 'verified' ? 'verified' : 'failed',
            message:
              result.result === 'verified'
                ? 'Verified ✓'
                : result.result === 'invalid-query'
                  ? (result.message ?? 'Invalid ground query')
                  : 'Cannot prove ✗',
          },
        }
        self.postMessage(response)
      } catch (error) {
        const response: VerifyResponse = {
          requestId,
          kind: 'mark',
          mark: {
            line: lineNum,
            type: 'failed',
            message: `Error: ${error}`,
          },
        }
        self.postMessage(response)
      }
    }

    const done: VerifyResponse = { requestId, kind: 'done' }
    self.postMessage(done)
  } catch (error) {
    const response: VerifyResponse = {
      requestId,
      kind: 'error',
      message: `Error: ${error}`,
    }
    self.postMessage(response)
  }
}

export {}
