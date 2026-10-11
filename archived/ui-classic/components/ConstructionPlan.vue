<template>
  <div v-if="plan && plan.steps.length" class="construction-plan">
    <div class="plan-header">
      <slot name="header">
        Construction Plan ({{ plan.steps.length }} steps, DOF={{ plan.dof }})
      </slot>
    </div>
    <div class="plan-list">
      <div
        v-for="(step, i) in plan.steps"
        :key="i"
        class="plan-step"
      >
        <span class="step-num">{{ i + 1 }}.</span>
        <span class="step-text">{{ formatStep(step) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plan, ConstructionStep } from '../geometry/planner'

interface PlannerView {
  steps: Plan
  params: number[]
  dof: number
}

defineProps<{
  plan: PlannerView | null
}>()

// Format construction step for display
function formatStep(step: ConstructionStep): string {
  const pts = (s: Set<string>) => [...s].join('')

  switch (step.kind) {
    case 'free':
      return `free ${step.point}`
    case 'point-on-line':
      return `${step.point} on line ${pts(step.line.points)}`
    case 'point-on-circle':
      return `${step.point} on circle ${step.circle.center}${pts(step.circle.points)}`
    case 'line-line-intersection':
      return `${step.point} = intersection of lines ${pts(step.l1.points)}, ${pts(step.l2.points)}`
    case 'circle-circle-intersection':
      return `${step.point} = intersection of circles ${step.c1.center}${pts(step.c1.points)}, ${step.c2.center}${pts(step.c2.points)}`
    case 'circle-line-intersection':
      return `${step.point} = intersection of circle ${step.circle.center}${pts(step.circle.points)}, line ${pts(step.line.points)}`
  }
}
</script>

<style scoped>
.construction-plan {
  border-top: 1px solid #2a2a3e;
  background: #1a1a2e;
  max-height: 40%;
  overflow-y: auto;
}

.plan-header {
  padding: 0.5em 1em;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
  border-bottom: 1px solid #2a2a3e;
}

.plan-list {
  padding: 0.5em 0;
}

.plan-step {
  padding: 0.3em 1em;
  font-size: 11px;
  display: flex;
  gap: 0.5em;
  align-items: baseline;
}

.step-num {
  color: #666;
  min-width: 1.5em;
  text-align: right;
}

.step-text {
  color: #c8c8e8;
}
</style>