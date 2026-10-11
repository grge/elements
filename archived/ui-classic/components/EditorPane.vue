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
      <CodeEditor
        v-if="mode === 'scratchpad'"
        :model-value="source"
        @update:model-value="$emit('update:source', $event)"
        placeholder="Enter geometry goals..."
        :marks="verificationMarks"
      />
      <CodeEditor
        v-else
        :model-value="currentClause"
        @update:model-value="$emit('update:currentClause', $event)"
        :readonly="readOnly"
        placeholder="Enter rule or lemma..."
        :marks="verificationMarks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CodeEditor from './CodeEditor.vue'
import { useKB } from '../composables/useKB'
import { useVerification } from '../composables/useVerification'

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

const textForVerification = computed(() => props.mode === 'predicate' ? props.currentClause : props.source)

const { verificationMarks } = useVerification(
  () => textForVerification.value,
  () => kb.value,
  () => props.mode
)
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

.readonly-indicator {
  margin-left: auto;
  font-size: 11px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}
</style>
