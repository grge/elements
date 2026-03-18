<template>
  <div class="layout" :style="{ gridTemplateColumns: `${browserPct}% 4px ${editorPct}% 4px 1fr` }">
    
    <!-- LEFT: Knowledge Base Browser -->
    <KnowledgeBrowser 
      :mode="mode" 
      :selected-pred="selectedPred"
      :selected-ns="selectedNamespace"
      @select-scratchpad="selectScratchpad"
      @select-predicate="selectPredicate"
      @new-user-clause="newUserClause"
    />

    <!-- DIVIDER 1 -->
    <div class="divider" @pointerdown="e => startDrag(e, 'browser')" />

    <!-- MIDDLE: Editor -->
    <EditorPane
      :mode="mode"
      :selected-pred="selectedPred"
      :source="source"
      :current-clause="currentClause"
      :read-only="isPredicateReadOnly(selectedPred)"
      :namespace="selectedNamespace"
      @update:source="source = $event"
      @update:current-clause="currentClause = $event"
      @save="savePredicate"
      @delete="deletePredicate"
    />

    <!-- DIVIDER 2 -->
    <div class="divider" @pointerdown="e => startDrag(e, 'editor')" />

    <!-- RIGHT: Diagram -->
    <DiagramPane
      :problem="mergedProblem"
      :plan="constructionPlan"
      :use-planner="usePlanner"
      @update:use-planner="usePlanner = $event"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import KnowledgeBrowser from '../components/KnowledgeBrowser.vue'
import EditorPane from '../components/EditorPane.vue'
import DiagramPane from '../components/DiagramPane.vue'
import { parseSource } from '../language/parser'
import { solve } from '../geometry/solver'
import { plan as planConstruction, extractParams } from '../geometry/planner'
import { useKB } from '../composables/useKB'
import {
  buildKnowledgeBase,
  extractProblemFromTopLevel,
  findUserClauseForPredicate,
  isPredicateReadOnly as predicateReadOnly,
  diagramSourceForMode,
} from '../helpers'

// Layout state
const browserPct = ref(25)
const editorPct = ref(35)

// App state  
type Mode = 'scratchpad' | 'predicate'
const mode = ref<Mode>('scratchpad')
const selectedPred = ref('')
const selectedNamespace = ref('')

// Content state
const source = ref(`circle a b c
eq-triangle a b c`)
const currentClause = ref('')

function isPredicateReadOnly(predName: string): boolean {
  return predicateReadOnly(predName, predicates.value)
}

// Geometry state
const usePlanner = ref(true)

// Knowledge base
const { kb, predicates, userClauses, addUserClause, updateUserClause, deleteUserClause, clausesForPredicate } = useKB()

// Mode switching
function selectScratchpad() {
  mode.value = 'scratchpad'
  selectedPred.value = ''
  selectedNamespace.value = ''
}

function selectPredicate(predName: string, ns: string) {
  mode.value = 'predicate'
  selectedPred.value = predName
  selectedNamespace.value = ns
  const clauses = clausesForPredicate(predName, ns as any)
  currentClause.value = clauses.map(c => c.source).join('\n\n')
}

function newUserClause() {
  const name = prompt('New predicate name:')
  if (name && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    const text = `${name} x y: `
    addUserClause(text)
    selectPredicate(name, 'user')
  }
}

// Predicate editing
function savePredicate() {
  if (mode.value === 'predicate' && selectedPred.value && currentClause.value) {
    const userClause = findUserClauseForPredicate(selectedPred.value, userClauses.value)

    if (userClause) {
      updateUserClause(userClause.id, currentClause.value)
    } else {
      addUserClause(currentClause.value)
    }
  }
}

function deletePredicate() {
  if (mode.value === 'predicate' && selectedPred.value) {
    if (confirm(`Delete predicate "${selectedPred.value}"?`)) {
      const userClause = findUserClauseForPredicate(selectedPred.value, userClauses.value)

      if (userClause) {
        deleteUserClause(userClause.id)
      }
      selectScratchpad()
    }
  }
}

// Layout dragging
function startDrag(e: PointerEvent, pane: 'browser' | 'editor') {
  (e.target as HTMLElement).setPointerCapture(e.pointerId)
  
  function onMove(e: PointerEvent) {
    const totalWidth = window.innerWidth
    const pct = (e.clientX / totalWidth) * 100
    
    if (pane === 'browser') {
      browserPct.value = Math.max(15, Math.min(50, pct))
    } else {
      const remaining = 100 - browserPct.value - 4 // account for first divider
      const editorPos = pct - browserPct.value - 4
      editorPct.value = Math.max(20, Math.min(60, (editorPos / remaining) * 100))
    }
  }
  
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const diagramSource = computed(() =>
  diagramSourceForMode(mode.value, source.value, currentClause.value)
)

// Geometry processing pipeline
const mergedProblem = computed(() => {
  if (!diagramSource.value.trim() || !kb.value) return null

  try {
    const parsed = parseSource(diagramSource.value)
    const tempKB = buildKnowledgeBase(kb.value, parsed)
    return extractProblemFromTopLevel(parsed, tempKB)
  } catch (error) {
    console.warn('Geometry processing error:', error)
    return null
  }
})

const constructionPlan = computed(() => {
  if (!mergedProblem.value || !usePlanner.value) return null
  
  try {
    const planResult = planConstruction(mergedProblem.value)
    if (!planResult) return null
    
    // Get witness from numerical solver to extract parameters
    const witness = solve(mergedProblem.value)
    if (!witness) return null
    
    const params = extractParams(planResult.plan, witness, mergedProblem.value)
    return {
      steps: planResult.plan,
      params,
      dof: planResult.totalDOF
    }
  } catch (error) {
    console.warn('Construction planning error:', error)
    return null
  }
})
</script>

<style scoped>
.layout {
  display: grid;
  height: 100vh;
  overflow: hidden;
  background: #0f0e17;
  color: #c8c8e8;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}

.divider {
  background: #2a2a3e;
  cursor: col-resize;
  transition: background 0.15s;
}

.divider:hover, .divider:active {
  background: #5555aa;
}
</style>