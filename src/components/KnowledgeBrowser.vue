<template>
  <div class="browser-pane">
    <div class="pane-header">Knowledge Base</div>
    <div class="browser-list">

      <!-- Scratchpad entry -->
      <div
        class="browser-item scratchpad-item"
        :class="{ active: mode === 'scratchpad' }"
        @click="$emit('selectScratchpad')"
      >
        ✏ Scratchpad
      </div>

      <!-- Lemmas section -->
      <div class="ns-header" @click="showLemmas = !showLemmas">
        <span class="ns-toggle">{{ showLemmas ? '▼' : '▶' }}</span>
        lemmas/ 🔒
      </div>
      <template v-if="showLemmas">
        <div
          v-for="p in lemmaPredicates"
          :key="p.name"
          class="browser-item"
          :class="{ active: mode === 'predicate' && selectedPred === p.name }"
          @click="$emit('selectPredicate', p.name, 'lemmas')"
        >
          <span class="pred-name">{{ p.name }}</span>
          <span class="pred-arity">/{{ p.arity }}</span>
          <span class="pred-lock">🔒</span>
        </div>
        <div v-if="!lemmaPredicates.length" class="empty-ns">empty</div>
      </template>

      <!-- Namespace groups -->
      <template v-for="ns in namespaces" :key="ns">
        <div class="ns-header" @click="toggleNS(ns)">
          <span class="ns-toggle">{{ collapsed[ns] ? '▶' : '▼' }}</span>
          {{ ns }}/
          <span v-if="ns === 'user'" class="ns-add" @click.stop="$emit('newUserClause')">＋</span>
        </div>
        <template v-if="!collapsed[ns]">
          <div
            v-for="p in predicatesInNS(ns)"
            :key="p.name"
            class="browser-item"
            :class="{ active: mode === 'predicate' && selectedPred === p.name }"
            @click="$emit('selectPredicate', p.name, ns)"
          >
            <span class="pred-name">{{ p.name }}</span>
            <span class="pred-arity">/{{ p.arity }}</span>
            <span v-if="p.readOnly" class="pred-lock">🔒</span>
          </div>
          <div v-if="predicatesInNS(ns).length === 0" class="empty-ns">empty</div>
        </template>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useKB } from '../composables/useKB'
import type { Namespace } from '../composables/useKB'

defineProps<{
  mode: 'scratchpad' | 'predicate'
  selectedPred: string
}>()

defineEmits<{
  selectScratchpad: []
  selectPredicate: [name: string, namespace: string]
  newUserClause: []
}>()

const { predicates, lemmaPredicates, builtinLemmas } = useKB()
const namespaces: Namespace[] = ['core', 'euclid', 'user']

// Filter predicates by namespace - UI logic belongs here, not in composable
function predicatesInNS(ns: Namespace) {
  return predicates.value.filter(p => p.namespace === ns)
}

// Namespace collapse state
const showLemmas = ref(true)
const collapsed = ref<Record<Namespace, boolean>>({
  core: false,
  euclid: false,
  lemmas: false,
  user: false
})

function toggleNS(ns: Namespace) {
  collapsed.value[ns] = !collapsed.value[ns]
}
</script>

<style scoped>
.browser-pane {
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
}

.browser-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5em 0;
}

.browser-item {
  padding: 0.4em 1em;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 0.3em;
}

.browser-item:hover {
  background: #2a2a3e;
}

.browser-item.active {
  background: #3a3a5e;
  color: #fff;
}

.scratchpad-item {
  margin-bottom: 0.5em;
  border-bottom: 1px solid #2a2a3e;
  font-weight: 500;
}

.ns-header {
  padding: 0.5em 1em;
  cursor: pointer;
  font-weight: 500;
  color: #888;
  display: flex;
  align-items: center;
  gap: 0.3em;
  margin-top: 0.5em;
  transition: color 0.15s;
}

.ns-header:hover {
  color: #aaa;
}

.ns-toggle {
  font-size: 10px;
  color: #666;
}

.ns-add {
  margin-left: auto;
  font-size: 12px;
  color: #7ec8e3;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background 0.15s;
}

.ns-add:hover {
  background: #2a2a3e;
}

.pred-name {
  color: #c8c8e8;
  font-size: 12px;
}

.pred-arity {
  color: #666;
  font-size: 10px;
}

.pred-lock {
  margin-left: auto;
  font-size: 10px;
  color: #666;
}

.empty-ns {
  padding: 0.3em 2em;
  color: #666;
  font-size: 11px;
  font-style: italic;
}

.lemma-item {
  cursor: default;
}

.lemma-head {
  color: #9a9acf;
  font-size: 11px;
}
</style>