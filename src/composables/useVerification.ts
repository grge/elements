import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { parseSource, type Rule } from '../language/parser'
import type { KnowledgeBase } from '../kb/inference'
import { showRule } from '../kb/rules'
import { ruleChapter } from './useKB'
import type { EditorMark } from '../components/CodeEditor.vue'

type WorkerMessage =
  | { requestId: number; kind: 'mark'; mark: EditorMark }
  | { requestId: number; kind: 'done' }
  | { requestId: number; kind: 'error'; message: string }

/**
 * Checks the `?` lines of the text in a worker, as marks for the editor's gutter. On a book page,
 * `lineChapters` gives the chapter each line is written in, so that a lemma is checked in the book's
 * order (kb/bookScope.ts).
 */
export function useVerification(text: () => string, kb: () => KnowledgeBase | null, lineChapters: () => readonly (number | null)[] | null = () => null) {
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
        ? verificationMarksState.value.map((mark, i) => i === 0 ? { ...mark, type: 'unproven', message: data.message } : mark)
        : [{ line: 0, type: 'unproven', message: data.message }]
    }
  }

  function pendingMarksFor(textContent: string): EditorMark[] {
    const lines = textContent.split('\n')
    return lines
      .map((l, i) => ({ i, isQuery: l.trimStart().startsWith('?') }))
      .filter(x => x.isQuery)
      // A line keeps its last verdict while it is re-checked, so the page does not jump as you type.
      .map(x => verificationMarksState.value.find(m => m.line === x.i) ?? { line: x.i, type: 'unknown' as const, message: 'checking…' })
  }

  // The chapter of each rule, by the knowledge base (the same rules each time it is unchanged).
  let chaptersFor: { kb: KnowledgeBase; chapters: (number | null)[] } | null = null
  const ruleChapters = (k: KnowledgeBase) => {
    if (chaptersFor?.kb !== k) chaptersFor = { kb: k, chapters: k.allRules().map(r => ruleChapter(showRule(r)) ?? null) }
    return chaptersFor.chapters
  }

  watch([text, kb, lineChapters], ([textContent, currentKb, chapters]) => {
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
        ...(chapters ? { ruleChapters: ruleChapters(currentKb), lineChapters: [...chapters] } : {}),
      })
    } catch {
      // The text does not parse (a line half typed): keep the marks until it does.
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    worker.terminate()
  })

  return {
    verificationMarks: computed(() => verificationMarksState.value)
  }
}