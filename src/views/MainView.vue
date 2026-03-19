<template>
  <div class="layout" :style="{ gridTemplateColumns: `${browserPct}% 4px ${editorPct}% 4px 1fr` }">
    <KnowledgeBrowser 
      :mode="mode" 
      :selected-pred="selectedPred"
      :selected-ns="selectedNamespace"
      @select-scratchpad="selectScratchpad"
      @select-predicate="selectPredicate"
      @new-user-clause="newUserClause"
    />

    <div class="divider" @pointerdown="e => startDrag(e, 'browser')" />

    <EditorPane
      :mode="mode"
      :selected-pred="selectedPred"
      :source="source"
      :current-clause="currentClause"
      :read-only="isPredicateReadOnly(selectedPred)"
      :namespace="selectedNamespace"
      @update:source="source = $event"
      @update:currentClause="currentClause = $event"
      @save="savePredicate"
      @delete="deletePredicate"
    />

    <div class="divider" @pointerdown="e => startDrag(e, 'editor')" />

    <DiagramPane
      :problem="mergedProblem"
      :plan="constructionPlan"
      :use-planner="usePlanner"
      @update:use-planner="usePlanner = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import KnowledgeBrowser from '../components/KnowledgeBrowser.vue'
import EditorPane from '../components/EditorPane.vue'
import DiagramPane from '../components/DiagramPane.vue'
import { parseSource } from '../language/parser'
import { buildRuntimeState, type RuntimeState } from '../kb/runtime'
import { KnowledgeBase } from '../kb/inference'
import { solve } from '../geometry/solver'
import { plan as planConstruction, extractParams } from '../geometry/planner'
import { useKB } from '../composables/useKB'
import { findUserClauseForPredicate, isPredicateReadOnly as predicateReadOnly } from '../helpers'
import { geometryProblemFromRuntime, seedPredicateHeadFact } from '../geometry/extraction'

const browserPct = ref(25)
const editorPct = ref(35)

type Mode = 'scratchpad' | 'predicate'
const mode = ref<Mode>('scratchpad')
const selectedPred = ref('')
const selectedNamespace = ref('')

const source = ref(`circle a b c
eq-triangle a b c`)
const currentClause = ref('')

function isPredicateReadOnly(predName: string): boolean {
  return predicateReadOnly(predName, predicates.value)
}

const usePlanner = ref(true)

const { kb, predicates, userClauses, addUserClause, updateUserClause, deleteUserClause, clausesForPredicate } = useKB()

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

function savePredicate() {
  if (mode.value === 'predicate' && selectedPred.value && currentClause.value) {
    const userClause = findUserClauseForPredicate(selectedPred.value, userClauses.value)
    if (userClause) updateUserClause(userClause.id, currentClause.value)
    else addUserClause(currentClause.value)
  }
}

function deletePredicate() {
  if (mode.value === 'predicate' && selectedPred.value) {
    if (confirm(`Delete predicate "${selectedPred.value}"?`)) {
      const userClause = findUserClauseForPredicate(selectedPred.value, userClauses.value)
      if (userClause) deleteUserClause(userClause.id)
      selectScratchpad()
    }
  }
}

function startDrag(e: PointerEvent, pane: 'browser' | 'editor') {
  (e.target as HTMLElement).setPointerCapture(e.pointerId)
  function onMove(e: PointerEvent) {
    const totalWidth = window.innerWidth
    const pct = (e.clientX / totalWidth) * 100
    if (pane === 'browser') {
      browserPct.value = Math.max(15, Math.min(50, pct))
    } else {
      const remaining = 100 - browserPct.value - 4
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

const runtimeState = computed<RuntimeState | null>(() => {
  if (!kb.value) return null
  try {
    if (mode.value === 'scratchpad') {
      return buildRuntimeState(kb.value, parseSource(source.value))
    }

    if (!currentClause.value.trim()) return null
    const parsed = parseSource(currentClause.value)

    let baseKB = kb.value
    const isUserPredicate = selectedNamespace.value === 'user' && !!selectedPred.value
    const isReadOnlyPredicate = selectedNamespace.value !== 'user'

    if (isUserPredicate) {
      const filteredRules = kb.value
        .allRules()
        .filter(rule => rule.head.name !== selectedPred.value)
      baseKB = new KnowledgeBase(filteredRules)
    }

    const runtime = isReadOnlyPredicate
      ? buildRuntimeState(baseKB, parsed.filter(item => item.kind !== 'rule'))
      : buildRuntimeState(baseKB, parsed)

    const firstRule = parsed.find((item): item is Extract<typeof parsed[number], { kind: 'rule' }> => item.kind === 'rule')
    if (firstRule) runtime.configuration.addFacts([seedPredicateHeadFact(firstRule.rule.head)])
    return runtime
  } catch (error) {
    console.warn('Runtime construction error:', error)
    return null
  }
})

const mergedProblem = computed(() => {
  if (!runtimeState.value) return null
  try {
    return geometryProblemFromRuntime(runtimeState.value)
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
    const witness = solve(mergedProblem.value)
    if (!witness) return null
    const params = extractParams(planResult.plan, witness, mergedProblem.value)
    return { steps: planResult.plan, params, dof: planResult.totalDOF }
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
