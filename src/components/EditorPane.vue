<template>
  <div class="editor-pane">
    <div class="pane-header">
      <span v-if="mode === 'scratchpad'">Scratchpad</span>
      <span v-else>{{ selectedPred }}</span>
      
      <!-- Predicate actions -->
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

      <!-- Verification gutter: shown whenever the text contains lemma (?) lines -->
      <div v-if="verificationMarks.length > 0" class="gutter" ref="gutterRef">
        <div
          v-for="(mark, i) in verificationMarks"
          :key="i"
          class="gutter-mark"
          :class="mark.type"
          :style="{ top: `${gutterTop(mark.line)}px` }"
          :title="mark.message"
        >
          {{ mark.type === 'verified' ? '✓' : mark.type === 'failed' ? '✗' : '?' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseSource } from '../language/parser'
import { useKB } from '../composables/useKB'
import { prove, forwardClosure, groundKey, type GroundPredicate } from '../kb/inference'

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

// Textarea and gutter refs for scroll sync
const editorRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLDivElement | null>(null)
const scrollTop = ref(0)

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLTextAreaElement).scrollTop
}

// Compute mark top position in px, matching textarea font metrics exactly.
// Textarea uses font-size 13px, line-height 1.4 (= 18.2px), padding-top 16px (1em at 16px base).
// We measure the actual padding from the element if available, otherwise use known constants.
const FONT_SIZE = 13   // px — must match .editor CSS
const LINE_HEIGHT = FONT_SIZE * 1.4  // 18.2px

function gutterTop(lineIndex: number): number {
  const paddingTop = editorRef.value
    ? parseFloat(getComputedStyle(editorRef.value).paddingTop)
    : 13  // fallback: 1em at 13px
  return paddingTop + lineIndex * LINE_HEIGHT - scrollTop.value
}

// Verification marks for scratchpad mode
const verificationMarks = computed(() => {
  const text = props.mode === 'predicate' ? props.currentClause : props.source
  if (!text.trim() || !kb.value) return []

  try {
    // Find the real line numbers of each '?' line in the source
    const lines = text.split('\n')
    const lemmaLineNumbers = lines
      .map((l, i) => ({ i, isLemma: l.trimStart().startsWith('?') }))
      .filter(x => x.isLemma)
      .map(x => x.i)

    const parsed = parseSource(text)
    const marks: Array<{ line: number; type: 'verified' | 'failed' | 'unknown'; message: string }> = []

    let lemmaIndex = 0
    parsed.forEach((item) => {
      if (item.kind === 'lemma') {
        const lineNum = lemmaLineNumbers[lemmaIndex++] ?? 0
        try {
          const lemma = item.lemma
          const seeds: GroundPredicate[] = lemma.hypotheses.map(h => ({ name: h.name, args: h.args }))
          const goal: GroundPredicate = { name: lemma.head.name, args: lemma.head.args }
          const goalKey = groundKey(goal)
          const closed = forwardClosure(kb.value, seeds, 2000, goalKey)
          const factSet = new Set(closed.map(f => groundKey(f)))
          const result = factSet.has(goalKey)
          marks.push({
            line: lineNum,
            type: result ? 'verified' : 'failed',
            message: result ? 'Verified ✓' : 'Cannot prove ✗'
          })
        } catch (error) {
          marks.push({
            line: lineNum,
            type: 'failed',
            message: `Error: ${error}`
          })
        }
      }
    })

    return marks
  } catch {
    return []
  }
})
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
}
</style>