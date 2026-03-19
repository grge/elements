<template>
  <div class="editor-pane">
    <div class="pane-header">
      <span v-if="mode === 'scratchpad'">Scratchpad</span>
      <span v-else>{{ selectedPred }}</span>
      
      <div v-if="mode === 'predicate' && !readOnly" class="pred-actions">
        <button @click="$emit('save')" class="btn-save" title="Save">💾</button>
        <button @click="$emit('delete')" class="btn-delete" title="Delete">🗑</button>
      </div>
      <div v-if="mode === 'predicate' && readOnly" class="readonly-indicator">
        🔒 Read-only
      </div>
    </div>

    <div class="editor-container">
      <textarea
        v-if="mode === 'scratchpad'"
        :value="source"
        @input="$emit('update:source', ($event.target as HTMLTextAreaElement).value)"
        @scroll="onScroll"
        ref="editorRef"
        class="editor"
        placeholder="Enter geometry goals..."
        spellcheck="false"
      />
      <textarea
        v-else
        :value="currentClause"
        @input="$emit('update:currentClause', ($event.target as HTMLTextAreaElement).value)"
        @scroll="onScroll"
        ref="editorRef"
        :readonly="readOnly"
        class="editor"
        :class="{ readonly: readOnly }"
        placeholder="Enter rule or lemma..."
        spellcheck="false"
      />

      <div v-if="verificationMarks.length > 0" class="gutter" ref="gutterRef">
        <div
          v-for="(mark, i) in verificationMarks"
          :key="i"
          class="gutter-mark"
          :class="mark.type"
          :style="{ top: `${gutterTop(mark.line)}px` }"
          :title="mark.message"
        >
          {{ mark.type === 'verified' ? '✓' : mark.type === 'failed' ? '✗' : '…' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { parseSource, type Rule } from '../language/parser'
import { useKB } from '../composables/useKB'

interface VerifyMark {
  line: number
  type: 'verified' | 'failed' | 'unknown'
  message: string
}

type WorkerMessage =
  | { requestId: number; kind: 'mark'; mark: VerifyMark }
  | { requestId: number; kind: 'done' }
  | { requestId: number; kind: 'error'; message: string }

const props = defineProps<{
  mode: 'scratchpad' | 'predicate'
  selectedPred: string
  source: string
  currentClause: string
  readOnly: boolean
  namespace?: string
}>()

defineEmits<{
  'update:source': [value: string]
  'update:currentClause': [value: string]
  save: []
  delete: []
}>()

const { kb } = useKB()

const worker = new Worker(new URL('../workers/lemmaCheckWorker.ts', import.meta.url), { type: 'module' })
const lastRequestId = ref(0)
const verificationMarksState = ref<VerifyMark[]>([])

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

const editorRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const scrollTop = ref(0)

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLTextAreaElement).scrollTop
}

const FONT_SIZE = 13
const LINE_HEIGHT = FONT_SIZE * 1.4

function gutterTop(lineIndex: number): number {
  const paddingTop = editorRef.value
    ? parseFloat(getComputedStyle(editorRef.value).paddingTop)
    : 13
  return paddingTop + lineIndex * LINE_HEIGHT - scrollTop.value
}

const textForVerification = computed(() => props.mode === 'predicate' ? props.currentClause : props.source)

function pendingMarksFor(text: string): VerifyMark[] {
  const lines = text.split('\n')
  return lines
    .map((l, i) => ({ i, isQuery: l.trimStart().startsWith('?') }))
    .filter(x => x.isQuery)
    .map(x => ({ line: x.i, type: 'unknown' as const, message: 'Checking…' }))
}

watch([textForVerification, () => kb.value, () => props.mode], ([text, currentKb, mode]) => {
  if (!text.trim() || !currentKb) {
    verificationMarksState.value = []
    return
  }

  try {
    const parsed = parseSource(text)
    const hasQuery = parsed.some(item => item.kind === 'lemma' || item.kind === 'ground-query')
    if (!hasQuery) {
      verificationMarksState.value = []
      return
    }

    verificationMarksState.value = pendingMarksFor(text)
    const requestId = ++lastRequestId.value
    worker.postMessage({
      requestId,
      text,
      rules: currentKb.allRules() as Rule[],
      mode,
    })
  } catch {
    verificationMarksState.value = []
  }
}, { immediate: true })

onBeforeUnmount(() => {
  worker.terminate()
})

const verificationMarks = computed(() => verificationMarksState.value)
</script>

<style scoped>
.editor-pane {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #2a2a3e;
}

.pane-header {
  padding: 0.75em 1em;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
  border-bottom: 1px solid #2a2a3e;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.pred-actions {
  margin-left: auto;
  display: flex;
  gap: 0.3em;
}

.btn-save, .btn-delete {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 3px;
  font-size: 12px;
  transition: background 0.15s;
  color: #888;
}

.btn-save:hover {
  background: #2a4a2a;
  color: #8ec88e;
}

.btn-delete:hover {
  background: #4a2a2a;
  color: #e88e8e;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.editor {
  flex: 1;
  background: none;
  border: none;
  color: #c8c8e8;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  padding: 1em;
  outline: none;
  resize: none;
  overflow-y: auto;
}

.editor::placeholder {
  color: #666;
}

.editor.readonly {
  background: #1a1a2e;
  color: #999;
  cursor: default;
}

.readonly-indicator {
  margin-left: auto;
  font-size: 11px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.gutter {
  position: relative;
  width: 2em;
  flex-shrink: 0;
  overflow: hidden;
}

.gutter-mark {
  position: absolute;
  right: 0.3em;
  font-size: 11px;
  line-height: 1.4em;
}

.gutter-mark.verified {
  color: #8ec88e;
}

.gutter-mark.failed {
  color: #e88e8e;
}

.gutter-mark.unknown {
  color: #888;
  animation: pulse 1s infinite ease-in-out;
}

@keyframes pulse {
  0% { opacity: 0.35; }
  50% { opacity: 1; }
  100% { opacity: 0.35; }
}
</style>
