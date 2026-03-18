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
      <div class="editor-wrapper">
        <textarea
          v-if="mode === 'scratchpad'"
          :value="source"
          @input="$emit('update:source', ($event.target as HTMLTextAreaElement).value)"
          class="editor"
          placeholder="Enter geometry goals..."
          spellcheck="false"
        />
        <textarea
          v-else
          :value="currentClause"
          @input="$emit('update:currentClause', ($event.target as HTMLTextAreaElement).value)"
          :readonly="readOnly"
          class="editor"
          :class="{ readonly: readOnly }"
          placeholder="Enter rule or lemma..."
          spellcheck="false"
        />
      </div>

      <!-- Verification marks for scratchpad -->
      <div v-if="mode === 'scratchpad'" class="gutter">
        <div
          v-for="(mark, i) in verificationMarks"
          :key="i"
          class="gutter-mark"
          :class="mark.type"
          :style="{ top: `${mark.line * 1.4 + 0.5}em` }"
          :title="mark.message"
        >
          {{ mark.type === 'verified' ? '✓' : mark.type === 'failed' ? '✗' : '?' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseSource } from '../language/parser'
import { useKB } from '../composables/useKB'
import { prove, forwardClosure, groundKey, type GroundPredicate } from '../kb/inference'

const props = defineProps<{
  mode: 'scratchpad' | 'predicate'
  selectedPred: string
  source: string
  currentClause: string
  readOnly: boolean
}>()

defineEmits<{
  'update:source': [value: string]
  'update:currentClause': [value: string]
  save: []
  delete: []
}>()

const { kb } = useKB()

// Verification marks for scratchpad mode
const verificationMarks = computed(() => {
  if (props.mode !== 'scratchpad' || !props.source.trim() || !kb.value) return []

  try {
    const parsed = parseSource(props.source)
    const marks: Array<{ line: number; type: 'verified' | 'failed' | 'unknown'; message: string }> = []

    parsed.forEach((item, i) => {
      if (item.kind === 'lemma') {
        try {
          const lemma = item.lemma
          const seeds: GroundPredicate[] = lemma.hypotheses.map(h => ({ name: h.name, args: h.args }))
          const closed = forwardClosure(kb.value, seeds, 2000)
          const factSet = new Set(closed.map(f => groundKey(f)))
          const goalKey = groundKey({ name: lemma.head.name, args: lemma.head.args })
          const result = factSet.has(goalKey)
          marks.push({
            line: i,
            type: result ? 'verified' : 'failed',
            message: result ? 'Verified ✓' : 'Cannot prove ✗'
          })
        } catch (error) {
          marks.push({
            line: i,
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
  position: relative;
  overflow: hidden;
}

.editor-wrapper {
  height: 100%;
  position: relative;
}

.editor {
  width: 100%;
  height: 100%;
  background: none;
  border: none;
  color: #c8c8e8;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  padding: 1em;
  padding-right: 2.5em; /* space for gutter */
  outline: none;
  resize: none;
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
  position: absolute;
  top: 0;
  right: 0;
  width: 2em;
  height: 100%;
  pointer-events: none;
  padding: 1em 0.5em;
}

.gutter-mark {
  position: absolute;
  right: 0.5em;
  font-size: 11px;
  line-height: 1;
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