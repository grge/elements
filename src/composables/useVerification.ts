import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { parseSource, type Rule } from '../language/parser'
import type { EditorMark } from '../components/CodeEditor.vue'

type WorkerMessage =
  | { requestId: number; kind: 'mark'; mark: EditorMark }
  | { requestId: number; kind: 'done' }
  | { requestId: number; kind: 'error'; message: string }

export function useVerification(
  text: () => string,
  kb: () => any,
  mode: () => string
) {
  const worker = new Worker(new URL('../workers/lemmaCheckWorker.ts', import.meta.url), { type: 'module' })
  const lastRequestId = ref(0)
  const verificationMarksState = ref<EditorMark[]>([])

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const data = event.data
    if (data.requestId !== lastRequestId.value) return

    if (data.kind === 'mark') {
      verificationMarksState.value = verificationMarksState.value.map(mark =>
        mark.line === data.mark.line ? data.mark : mark
      )
      return
    }

    if (data.kind === 'error') {
      verificationMarksState.value = verificationMarksState.value.length > 0
        ? verificationMarksState.value.map((mark, i) => i === 0 ? { ...mark, type: 'failed', message: data.message } : mark)
        : [{ line: 0, type: 'failed', message: data.message }]
    }
  }

  function pendingMarksFor(textContent: string): EditorMark[] {
    const lines = textContent.split('\n')
    return lines
      .map((l, i) => ({ i, isQuery: l.trimStart().startsWith('?') }))
      .filter(x => x.isQuery)
      .map(x => ({ line: x.i, type: 'unknown' as const, message: 'Checking…' }))
  }

  watch([text, kb, mode], ([textContent, currentKb, currentMode]) => {
    if (!textContent.trim() || !currentKb) {
      verificationMarksState.value = []
      return
    }

    try {
      const parsed = parseSource(textContent)
      const hasQuery = parsed.some(item => item.kind === 'lemma' || item.kind === 'ground-query')
      if (!hasQuery) {
        verificationMarksState.value = []
        return
      }

      verificationMarksState.value = pendingMarksFor(textContent)
      const requestId = ++lastRequestId.value
      worker.postMessage({
        requestId,
        text: textContent,
        rules: currentKb.allRules() as Rule[],
        mode: currentMode,
      })
    } catch {
      verificationMarksState.value = []
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    worker.terminate()
  })

  return {
    verificationMarks: computed(() => verificationMarksState.value)
  }
}