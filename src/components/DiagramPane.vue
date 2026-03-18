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

    <div class="diagram-container" ref="containerRef">
      <div 
        v-if="svgContent"
        class="svg-wrapper"
        v-html="svgContent"
        @mousedown="startInteraction"
        @wheel="onWheel"
      />
      <div v-else class="empty-diagram">
        No geometry to display
      </div>

    </div>

    <!-- Construction plan -->
    <div v-if="plan && plan.steps.length" class="plan-panel">
      <div class="plan-header">
        Construction Plan ({{ plan.steps.length }} steps, DOF={{ plan.dof }})
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { solve } from '../geometry/solver'
import { executePlan } from '../geometry/planner'
import type { Plan, ConstructionStep } from '../geometry/planner'
import type { WitnessModel } from '../geometry/constraints'
import { renderSVG } from '../geometry/renderer'
import { computeRenderTransform, screenToWorld, dragPlannerPoint, renderSVGWithTransform } from '../helpers'

interface PlannerView {
  steps: Plan
  params: number[]
  dof: number
}

const props = defineProps<{
  problem: any
  plan: PlannerView | null
  usePlanner: boolean
}>()

defineEmits<{
  'update:usePlanner': [value: boolean]
}>()

// Container ref for size calculations
const containerRef = ref<HTMLElement>()
const draggedWitness = ref<WitnessModel | null>(null)
const plannerParams = ref<number[] | null>(null)
const frozenTransform = ref<ReturnType<typeof computeRenderTransform> | null>(null)
const animatedTransform = ref<ReturnType<typeof computeRenderTransform> | null>(null)
const viewportWidth = ref(400)
const viewportHeight = ref(400)
let resizeObserver: ResizeObserver | null = null
let animationFrame: number | null = null

const baseWitness = computed(() => {
  if (!props.problem) return null

  if (props.usePlanner && props.plan) {
    const params = plannerParams.value ?? props.plan.params
    const coords = executePlan(props.plan.steps, params, props.problem)
    return coords ? { coords, energy: 0 } satisfies WitnessModel : null
  }

  return solve(props.problem) || null
})

const activeWitness = computed(() => draggedWitness.value ?? baseWitness.value)
const displayTransform = computed(() => frozenTransform.value ?? animatedTransform.value)

function currentPadding() {
  return Math.max(60, Math.min(viewportWidth.value, viewportHeight.value) * 0.12)
}

function animateToTransform(from: NonNullable<typeof animatedTransform.value>, to: NonNullable<typeof animatedTransform.value>, durationMs = 180) {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  const start = performance.now()

  function step(now: number) {
    const t = Math.min(1, (now - start) / durationMs)
    const ease = 1 - Math.pow(1 - t, 3)
    animatedTransform.value = {
      minX: from.minX + (to.minX - from.minX) * ease,
      minY: from.minY + (to.minY - from.minY) * ease,
      scale: from.scale + (to.scale - from.scale) * ease,
      offsetX: from.offsetX + (to.offsetX - from.offsetX) * ease,
      offsetY: from.offsetY + (to.offsetY - from.offsetY) * ease,
    }
    if (t < 1) animationFrame = requestAnimationFrame(step)
    else animationFrame = null
  }

  animationFrame = requestAnimationFrame(step)
}

// SVG rendering
const svgContent = computed(() => {
  if (!props.problem || !activeWitness.value) return null

  try {
    const planToUse = props.usePlanner && props.plan ? props.plan.steps : undefined
    if (displayTransform.value) {
      return renderSVGWithTransform(
        props.problem,
        activeWitness.value,
        displayTransform.value,
        viewportWidth.value,
        viewportHeight.value,
        4,
        planToUse,
      )
    }

    return renderSVG(
      props.problem,
      activeWitness.value,
      { width: viewportWidth.value, height: viewportHeight.value, padding: currentPadding() },
      planToUse,
    )
  } catch (error) {
    console.warn('SVG rendering error:', error)
    return null
  }
})

function startInteraction(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  const pointName = target?.dataset?.point
  if (!pointName) return
  const point = pointName

  const witness = activeWitness.value
  const svgEl = target?.closest('svg') as SVGElement | null
  if (!witness || !svgEl) return
  const rect = svgEl.getBoundingClientRect()

  const transform = computeRenderTransform(witness, viewportWidth.value, viewportHeight.value, currentPadding())
  if (!transform) return
  frozenTransform.value = transform

  function onMove(ev: MouseEvent) {
    const displayX = ev.clientX - rect.left
    const displayY = ev.clientY - rect.top
    const localX = displayX * (viewportWidth.value / rect.width)
    const localY = displayY * (viewportHeight.value / rect.height)
    const world = screenToWorld(localX, localY, transform!)

    if (props.usePlanner && props.plan) {
      const currentParams = plannerParams.value ?? [...props.plan.params]
      const currentCoords = draggedWitness.value?.coords ?? baseWitness.value?.coords ?? witness!.coords
      const result = dragPlannerPoint(props.plan.steps, currentParams, currentCoords, point, world)
      if (!result.draggable) return
      const coords = executePlan(props.plan.steps, result.params, props.problem)
      if (!coords) return
      plannerParams.value = result.params
      draggedWitness.value = { coords, energy: witness!.energy }
      return
    }

    const warmStart = new Map(witness!.coords)
    warmStart.set(point, world)

    try {
      draggedWitness.value = solve(props.problem, 6, warmStart)
    } catch {
      draggedWitness.value = { coords: warmStart, energy: witness!.energy }
    }
  }

  function onUp() {
    const from = frozenTransform.value
    frozenTransform.value = null
    draggedWitness.value = null

    const witnessAfter = baseWitness.value
    const to = witnessAfter
      ? computeRenderTransform(witnessAfter, viewportWidth.value, viewportHeight.value, currentPadding())
      : null
    if (from && to) {
      animatedTransform.value = from
      animateToTransform(from, to)
    } else {
      animatedTransform.value = null
    }

    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Zoom interaction currently disabled.
function onWheel(e: WheelEvent) {
  e.preventDefault()
}

function updateViewportSize() {
  const el = containerRef.value
  if (!el) return
  viewportWidth.value = Math.max(100, Math.round(el.clientWidth))
  viewportHeight.value = Math.max(100, Math.round(el.clientHeight))
}

onMounted(() => {
  updateViewportSize()
  resizeObserver = new ResizeObserver(() => updateViewportSize())
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (animationFrame) cancelAnimationFrame(animationFrame)
})

// Reset drag override when the rendered problem changes
watch([() => props.problem, () => props.plan, () => props.usePlanner], () => {
  draggedWitness.value = null
  plannerParams.value = props.plan ? [...props.plan.params] : null
  frozenTransform.value = null
  animatedTransform.value = null
}, { immediate: true })

watch([baseWitness, viewportWidth, viewportHeight], () => {
  if (frozenTransform.value || !baseWitness.value) return
  animatedTransform.value = computeRenderTransform(
    baseWitness.value,
    viewportWidth.value,
    viewportHeight.value,
    currentPadding(),
  )
}, { immediate: true })

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
  position: relative;
  overflow: hidden;
  background-color: #0a0a15;
  cursor: grab;
}

.diagram-container:active {
  cursor: grabbing;
}

.svg-wrapper {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-diagram {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-style: italic;
}

.view-info {
  position: absolute;
  bottom: 0.5em;
  right: 0.5em;
  font-size: 10px;
  color: #666;
  background: rgba(0, 0, 0, 0.7);
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
}

.plan-panel {
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

/* SVG styling */
:deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

:deep(circle[data-point]) {
  cursor: pointer;
  transition: all 0.15s;
}

:deep(circle[data-point]:hover) {
  r: 7;
  filter: drop-shadow(0 0 4px #ff6b6b);
}
</style>