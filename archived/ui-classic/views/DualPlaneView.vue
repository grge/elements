<template>
  <div class="viewport">
    <div class="container" :class="{ 'scroll-right': currentPanel === 'book' }">
      <!-- Floating Ribbon -->
      <div class="ribbon">
        <div class="ribbon-content">
          <span class="header-subtitle">SCRATCH PAD</span>
          <span class="separator">|</span>
          <span class="header-label">BOOK</span>
          <span class="header-subtitle">{{ selectedBookPredicate.toUpperCase() }}</span>
        </div>
      </div>

      <!-- Purple Panel (Playground/Scratchpad) -->
      <div class="panel panel-purple">
        <div class="content">
          <!-- Semi-transparent editor overlay on left -->
          <div class="editor-overlay">
            <CodeEditor
              v-model="scratchpadSource"
              placeholder="Enter geometry goals..."
              :marks="scratchpadMarks"
            />
          </div>

          <!-- Geometry diagram constrained to right half -->
          <div class="diagram-container diagram-constrained">
            <GeometryDiagram
              :problem="scratchpadProblem"
              :plan="scratchpadPlan"
              :use-planner="usePlanner"
              :padding="80"
            />
          </div>
        </div>
      </div>

      <!-- Red Panel (Book/Knowledge Base) -->
      <div class="panel panel-red">
        <div class="content">
          <!-- Floating code display overlay -->
          <div class="code-overlay">
            {{ bookPredicateCode }}
          </div>

          <!-- Geometry diagram constrained to right half -->
          <div class="diagram-container diagram-constrained">
            <GeometryDiagram
              :problem="bookProblem"
              :plan="bookPlan"
              :use-planner="false"
              :padding="80"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { parseSource } from '../language/parser'
import { buildRuntimeState } from '../kb/runtime'
import { geometryProblemFromRuntime } from '../geometry/extraction'
import { plan as planConstruction, extractParams } from '../geometry/planner'
import { solve } from '../geometry/solver'
import { useKB } from '../composables/useKB'
import { useVerification } from '../composables/useVerification'
import { findUserClauseForPredicate } from '../helpers'
import GeometryDiagram from '../components/GeometryDiagram.vue'
import CodeEditor from '../components/CodeEditor.vue'

// Panel navigation state
const currentPanel = ref<'playground' | 'book'>('playground')

// Knowledge base and planner
const { kb, predicates, userClauses } = useKB()
const usePlanner = ref(true)

// Scratchpad state
const scratchpadSource = ref(`circle a b c
eq-triangle a b c`)

// Book state - pick an interesting predicate from KB
const selectedBookPredicate = ref('eq-triangle')

// Verification for scratchpad
const { verificationMarks: scratchpadMarks } = useVerification(
  () => scratchpadSource.value,
  () => kb.value,
  () => 'scratchpad'
)

// Scratchpad geometry processing
const scratchpadRuntimeState = computed(() => {
  if (!kb.value) return null
  try {
    return buildRuntimeState(kb.value, parseSource(scratchpadSource.value))
  } catch (error) {
    console.warn('Scratchpad runtime error:', error)
    return null
  }
})

const scratchpadProblem = computed(() => {
  if (!scratchpadRuntimeState.value) return null
  try {
    return geometryProblemFromRuntime(scratchpadRuntimeState.value)
  } catch (error) {
    console.warn('Scratchpad geometry error:', error)
    return null
  }
})

const scratchpadPlan = computed(() => {
  if (!scratchpadProblem.value || !usePlanner.value) return null
  try {
    const planResult = planConstruction(scratchpadProblem.value)
    if (!planResult) return null
    const witness = solve(scratchpadProblem.value)
    if (!witness) return null
    const params = extractParams(planResult.plan, witness, scratchpadProblem.value)
    return { steps: planResult.plan, params, dof: planResult.totalDOF }
  } catch (error) {
    console.warn('Scratchpad planning error:', error)
    return null
  }
})

// Book predicate processing
const bookPredicateCode = computed(() => {
  if (!predicates.value.length) return 'Loading...'
  
  // Find the selected predicate in the knowledge base
  const userClause = findUserClauseForPredicate(selectedBookPredicate.value, userClauses.value)
  if (userClause) {
    return userClause.source
  }
  
  // If not in user clauses, generate a display from built-in predicates
  const builtinPred = predicates.value.find(p => p.name === selectedBookPredicate.value)
  if (builtinPred) {
    return `${builtinPred.name.toUpperCase()} ${builtinPred.arity > 0 ? 'A B C' : ''}:\n\n[Built-in predicate]`
  }
  
  return `${selectedBookPredicate.value.toUpperCase()}:\n\n[Definition not found]`
})

const bookRuntimeState = computed(() => {
  if (!kb.value) return null
  try {
    // Create a simple test case for the selected predicate
    const testSource = `${selectedBookPredicate.value} a b c`
    return buildRuntimeState(kb.value, parseSource(testSource))
  } catch (error) {
    console.warn('Book runtime error:', error)
    return null
  }
})

const bookProblem = computed(() => {
  if (!bookRuntimeState.value) return null
  try {
    return geometryProblemFromRuntime(bookRuntimeState.value)
  } catch (error) {
    console.warn('Book geometry error:', error)
    return null
  }
})

const bookPlan = computed(() => {
  if (!bookProblem.value) return null
  try {
    const planResult = planConstruction(bookProblem.value)
    if (!planResult) return null
    const witness = solve(bookProblem.value)
    if (!witness) return null
    const params = extractParams(planResult.plan, witness, bookProblem.value)
    return { steps: planResult.plan, params, dof: planResult.totalDOF }
  } catch (error) {
    console.warn('Book planning error:', error)
    return null
  }
})

// Keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && currentPanel.value === 'book') {
    currentPanel.value = 'playground'
  }
  if (e.key === 'ArrowRight' && currentPanel.value === 'playground') {
    currentPanel.value = 'book'
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.viewport {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.container {
  width: 210vw;
  height: 100vh;
  display: flex;
  position: relative;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  margin-left: -5vw;
}

.container.scroll-right {
  transform: translateX(-90vw);
}

.ribbon {
  position: absolute;
  top: 30px;
  left: 52.5vw;
  width: 105vw;
  height: 60px;
  padding: 12px 40px;
  display: flex;
  align-items: center;
  gap: 30px;
  background: rgba(255, 180, 100, 0.3);
  z-index: 20;
  border-radius: 30px;
  pointer-events: none;
}

.ribbon-content {
  display: flex;
  gap: 30px;
  align-items: center;
}

.header-label {
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 2px;
  white-space: nowrap;
}

.header-subtitle {
  font-size: 16px;
  opacity: 0.95;
  letter-spacing: 1px;
  padding: 6px 20px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  white-space: nowrap;
}

.separator {
  opacity: 0.5;
}

.panel {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.panel-purple {
  background: linear-gradient(135deg, #5352ed 0%, #3c2e8f 100%);
  clip-path: polygon(5% 0%, 100% 0%, 100% 100%, 0% 100%);
  margin-left: -2.5vw;
}

.panel-red {
  background: linear-gradient(135deg, #ff4757 0%, #ff6b6b 100%);
  clip-path: polygon(0% 0%, 100% 0%, 95% 100%, 0% 100%);
  margin-right: -2.5vw;
}

.content {
  width: 100%;
  height: 100%;
  position: relative;
}

.diagram-container {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

/* Semi-transparent editor overlay for scratchpad */
.editor-overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 50vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  z-index: 10;
  padding: 120px 40px 40px 60px;
}

/* Floating transparent code overlay for book */
.code-overlay {
  position: absolute;
  left: 8vw;
  top: 35vh;
  max-width: 35vw;
  z-index: 10;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  line-height: 1.8;
  color: white;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
  white-space: pre-line;
  pointer-events: none;
}

/* Constrain diagram to right half to avoid overlays */
.diagram-constrained {
  padding-left: 45vw;
}
</style>