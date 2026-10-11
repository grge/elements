<template>
  <div class="diagram-pane">
    <div class="pane-header">
      <span>Diagram</span>
      <div class="diagram-controls">
        <button 
          @click="$emit('update:usePlanner', !usePlanner)"
          class="btn-toggle"
          :class="{ active: usePlanner }"
          title="Construction planner"
        >
          📐
        </button>
      </div>
    </div>

    <div class="diagram-container">
      <GeometryDiagram
        :problem="problem"
        :plan="plan"
        :use-planner="usePlanner"
      />
    </div>

    <ConstructionPlan :plan="plan" />
  </div>
</template>

<script setup lang="ts">
import GeometryDiagram from './GeometryDiagram.vue'
import ConstructionPlan from './ConstructionPlan.vue'
import type { Plan } from '../geometry/planner'

interface PlannerView {
  steps: Plan
  params: number[]
  dof: number
}

defineProps<{
  problem: any
  plan: PlannerView | null
  usePlanner: boolean
}>()

defineEmits<{
  'update:usePlanner': [value: boolean]
}>()
</script>

<style scoped>
.diagram-pane {
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.diagram-controls {
  margin-left: auto;
}

.btn-toggle {
  background: none;
  border: 1px solid #444;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 12px;
  transition: all 0.15s;
  color: #888;
}

.btn-toggle:hover {
  border-color: #666;
  color: #aaa;
}

.btn-toggle.active {
  border-color: #7ec8e3;
  color: #7ec8e3;
  background: rgba(126, 200, 227, 0.1);
}

.diagram-container {
  flex: 1;
}
</style>