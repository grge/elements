<template>
  <div class="geometry-diagram" ref="containerRef" :class="{ dragging: dragging !== null }">
    <svg
      v-if="scene"
      :width="viewportWidth"
      :height="viewportHeight"
      :viewBox="`0 0 ${viewportWidth} ${viewportHeight}`"
      @mousedown="startInteraction"
      @wheel.prevent
    >
      <defs>
        <!-- Left of the veil the figure is drawn as a dotted ghost; right of it, crisp. -->
        <linearGradient :id="`${uid}-in`" gradientUnits="userSpaceOnUse" :x1="veilAt - VEIL_FADE" :x2="veilAt + VEIL_FADE" y1="0" y2="0">
          <stop offset="0" stop-color="black" />
          <stop offset="1" stop-color="white" />
        </linearGradient>
        <linearGradient :id="`${uid}-out`" gradientUnits="userSpaceOnUse" :x1="veilAt - VEIL_FADE" :x2="veilAt + VEIL_FADE" y1="0" y2="0">
          <stop offset="0" stop-color="white" />
          <stop offset="1" stop-color="black" />
        </linearGradient>
        <mask :id="`${uid}-crisp`" maskUnits="userSpaceOnUse" x="0" y="0" :width="viewportWidth" :height="viewportHeight">
          <rect :width="viewportWidth" :height="viewportHeight" :fill="`url(#${uid}-in)`" />
        </mask>
        <mask :id="`${uid}-ghost`" maskUnits="userSpaceOnUse" x="0" y="0" :width="viewportWidth" :height="viewportHeight">
          <rect :width="viewportWidth" :height="viewportHeight" :fill="`url(#${uid}-out)`" />
        </mask>
      </defs>

      <g class="ghost" :mask="`url(#${uid}-ghost)`">
        <line v-for="(l, i) in scene.lines" :key="`gl${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" />
        <circle v-for="(c, i) in scene.circles" :key="`gc${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" />
      </g>

      <g class="crisp" :mask="`url(#${uid}-crisp)`">
        <line v-for="(l, i) in scene.lines" :key="`l${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" />
        <circle v-for="(c, i) in scene.circles" :key="`c${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" />
        <text v-for="p in scene.points" :key="`t${p.name}`" class="label" :class="{ aux: p.aux }" :x="p.x + 12" :y="p.y - 12">{{ p.label }}</text>
      </g>

      <!-- Points stay crisp and grabbable everywhere, even under the text. -->
      <g
        v-for="p in scene.points"
        :key="p.name"
        class="pt"
        :class="[p.kind, { aux: p.aux, active: dragging === p.name }]"
        :data-point="p.name"
        :transform="`translate(${p.x} ${p.y})`"
      >
        <title>{{ p.title }}</title>
        <circle class="hit" r="22" />
        <circle class="ring" r="14" />
        <circle class="dot" :r="p.aux ? 5 : 7" />
      </g>
    </svg>
    <div v-else class="empty-diagram">
      <slot name="empty">No geometry to display</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import { solve } from '../geometry/solver'
import type { GeometryProblem, WitnessModel } from '../geometry/constraints'
import { computeRenderTransform, screenToWorld, type RenderTransform } from '../geometry/view'
import {
  execute, drag as dragConstruction, draggable, plan as planConstruction, realise,
  type ConstructionPlan, type Point,
} from '../geometry/construction'
import { displayName, isAuxiliary } from '../kb/names'
import type { ConstructionState } from '../composables/useWorkspace'

const props = defineProps<{
  problem: GeometryProblem | null
  /** Ruler-and-compass construction; without it (or with usePlanner off) the numerical solver draws. */
  construction?: ConstructionState | null
  usePlanner?: boolean
  /** Width in px of the strip on the left where text lies over the figure. */
  veil?: number
  padding?: number
}>()

const emit = defineEmits<{ 'update:construction': [state: ConstructionState] }>()

const VEIL_FADE = 48
/** How much of the text column the fitted figure keeps clear of: the rest it fills, behind the text. */
const VEIL_SHARE = 0.3
const uid = `dg${Math.random().toString(36).slice(2, 8)}`

// The construction being shown; dragging changes it locally and reports it on release.
const local = shallowRef<ConstructionState | null>(null)
let lastCoords: Map<string, Point> | undefined

const containerRef = ref<HTMLElement>()
const draggedWitness = ref<WitnessModel | null>(null)
const frozenTransform = ref<RenderTransform | null>(null)
const animatedTransform = ref<RenderTransform | null>(null)
const viewportWidth = ref(400)
const viewportHeight = ref(400)
const dragging = ref<string | null>(null)
let resizeObserver: ResizeObserver | null = null
let animationFrame: number | null = null

const planning = computed(() => !!(props.usePlanner && local.value))
const veilAt = computed(() => props.veil ?? 0)

const baseWitness = computed<WitnessModel | null>(() => {
  if (!props.problem) return null
  if (planning.value) {
    // Keep each intersection on the branch it was on (continuity while dragging).
    const drawing = execute(local.value!.plan, local.value!.params, { previous: lastCoords })
    if (!drawing.failure) lastCoords = drawing.coords
    return { coords: drawing.coords, energy: 0 }
  }
  return solve(props.problem) || null
})

const activeWitness = computed(() => draggedWitness.value ?? baseWitness.value)
const displayTransform = computed(() => frozenTransform.value ?? animatedTransform.value)

function currentPadding() {
  return props.padding ?? Math.max(60, Math.min(viewportWidth.value, viewportHeight.value) * 0.12)
}

function fit(witness: WitnessModel) {
  return computeRenderTransform(witness, viewportWidth.value, viewportHeight.value, currentPadding(), props.problem, veilAt.value * VEIL_SHARE)
}

// ── how each point can be moved ──

type PointKind = 'free' | 'slide' | 'fixed' | 'locked'
const freeable = new WeakMap<ConstructionPlan, Map<string, boolean>>()

/** Can this determined point become an input under another order of construction, losing nothing? */
function canFree(state: ConstructionState, point: string): boolean {
  let cache = freeable.get(state.plan)
  if (!cache) freeable.set(state.plan, cache = new Map())
  if (!cache.has(point)) cache.set(point, planConstruction(state.model, { free: [point] }).used >= state.plan.used)
  return cache.get(point)!
}

function kindOf(point: string): PointKind {
  if (!planning.value) return 'free'
  const step = local.value!.plan.steps.find(s => s.point === point)
  if (!step || step.kind === 'free') return 'free'
  if (step.kind === 'on') return 'slide'
  return canFree(local.value!, point) ? 'fixed' : 'locked'
}

const TITLES: Record<PointKind, string> = {
  free: 'drag to move',
  slide: 'drag along its line or circle',
  fixed: 'determined by the construction; dragging reverses it',
  locked: 'determined by the construction',
}

// ── the scene in screen coordinates ──

const scene = computed(() => {
  const witness = activeWitness.value, t = displayTransform.value
  if (!props.problem || !witness || !t) return null
  const coords = witness.coords
  const tx = (x: number) => t.offsetX + (x - t.minX) * t.scale
  const ty = (y: number) => t.offsetY + (y - t.minY) * t.scale
  const reach = viewportWidth.value + viewportHeight.value

  const lines: number[][] = []
  for (const line of props.problem.lines) {
    const pts = [...line.points].map(p => coords.get(p)).filter((p): p is Point => !!p)
    if (pts.length < 2) continue
    const [a, b] = pts
    const [ax, ay, bx, by] = [tx(a[0]), ty(a[1]), tx(b[0]), ty(b[1])]
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1e-9) continue
    const [ux, uy] = [(bx - ax) / len, (by - ay) / len]
    lines.push([ax - ux * reach, ay - uy * reach, ax + ux * reach, ay + uy * reach])
  }

  const circles: number[][] = []
  for (const circle of props.problem.circles) {
    const c = coords.get(circle.center)
    const pts = [...circle.points].map(p => coords.get(p)).filter((p): p is Point => !!p)
    if (!c || !pts.length) continue
    const r = pts.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / pts.length
    circles.push([tx(c[0]), ty(c[1]), r * t.scale])
  }

  const points = [...coords].map(([name, [x, y]]) => {
    const kind = kindOf(name)
    return { name, x: tx(x), y: ty(y), kind, aux: isAuxiliary(name), label: displayName(name), title: `${displayName(name)}: ${TITLES[kind]}` }
  })
  return { lines, circles, points }
})

// ── dragging ──

function animateToTransform(from: RenderTransform, to: RenderTransform, durationMs = 220) {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    const e = 1 - Math.pow(1 - t, 3)
    const mix = (a: number, b: number) => a + (b - a) * e
    animatedTransform.value = {
      minX: mix(from.minX, to.minX), minY: mix(from.minY, to.minY), scale: mix(from.scale, to.scale),
      offsetX: mix(from.offsetX, to.offsetX), offsetY: mix(from.offsetY, to.offsetY),
    }
    animationFrame = t < 1 ? requestAnimationFrame(step) : null
  }
  animationFrame = requestAnimationFrame(step)
}

function startInteraction(e: MouseEvent) {
  const target = (e.target as Element | null)?.closest('[data-point]') as SVGGElement | null
  const point = target?.dataset.point
  const witness = activeWitness.value
  const svgEl = target?.ownerSVGElement
  if (!point || !witness || !svgEl) return
  e.preventDefault()

  // A point the construction determines can still be dragged if another order of construction
  // makes it free without losing any fact.
  if (planning.value && !draggable(local.value!.plan, point)) {
    if (!canFree(local.value!, point)) return
    const alt = planConstruction(local.value!.model, { free: [point] })
    const r = realise(alt, { previous: witness.coords })
    if (!r.valid) return
    local.value = { ...local.value!, plan: alt, params: r.params }
  }

  const transform = displayTransform.value ?? fit(witness)
  if (!transform) return
  frozenTransform.value = transform
  dragging.value = point
  const rect = svgEl.getBoundingClientRect()

  function onMove(ev: MouseEvent) {
    const world = screenToWorld(
      (ev.clientX - rect.left) * (viewportWidth.value / rect.width),
      (ev.clientY - rect.top) * (viewportHeight.value / rect.height),
      transform!,
    )
    if (planning.value) {
      local.value = { ...local.value!, params: dragConstruction(local.value!.plan, local.value!.params, point!, world) }
      return
    }
    const warmStart = new Map(witness!.coords)
    warmStart.set(point!, world)
    try { draggedWitness.value = solve(props.problem!, 6, warmStart) }
    catch { draggedWitness.value = { coords: warmStart, energy: witness!.energy } }
  }

  function onUp() {
    if (planning.value) emit('update:construction', local.value!)
    dragging.value = null
    const from = frozenTransform.value
    frozenTransform.value = null
    draggedWitness.value = null
    const to = baseWitness.value ? fit(baseWitness.value) : null
    if (from && to) { animatedTransform.value = from; animateToTransform(from, to) }
    else animatedTransform.value = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── layout ──

function updateViewportSize() {
  const el = containerRef.value
  if (!el) return
  viewportWidth.value = Math.max(100, Math.round(el.clientWidth))
  viewportHeight.value = Math.max(100, Math.round(el.clientHeight))
}

onMounted(() => {
  updateViewportSize()
  resizeObserver = new ResizeObserver(updateViewportSize)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (animationFrame) cancelAnimationFrame(animationFrame)
})

watch(() => props.construction, c => { local.value = c ?? null }, { immediate: true })

watch([() => props.problem, () => props.usePlanner], () => {
  draggedWitness.value = null
  frozenTransform.value = null
  animatedTransform.value = null
}, { immediate: true })

watch([baseWitness, viewportWidth, viewportHeight, veilAt], () => {
  if (frozenTransform.value || !baseWitness.value) return
  animatedTransform.value = fit(baseWitness.value)
}, { immediate: true })

defineExpose({ activeWitness, baseWitness })
</script>

<style scoped>
.geometry-diagram {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
}
.geometry-diagram svg { display: block; }

.empty-diagram {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dg-soft, #888);
}

/* ── lines and circles ── */
.crisp line, .crisp > circle {
  fill: none;
  stroke: var(--dg-ink, #fff);
  stroke-width: var(--dg-stroke, 3);
}
/* Behind the text the figure becomes a dotted ghost, like a construction pencilled in. */
.ghost line, .ghost circle {
  fill: none;
  stroke: var(--dg-ink, #fff);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 0.1 10;
  opacity: 0.45;
}

/* ── points ── */
.pt { cursor: grab; }
.pt.locked { cursor: default; }
.dragging, .dragging .pt { cursor: grabbing; }

.pt .hit { fill: transparent; }
.pt .ring {
  fill: none;
  stroke: var(--dg-accent, #f40);
  stroke-width: 2.5;
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.15s, transform 0.15s;
}
.pt .dot {
  fill: var(--dg-accent, #f40);
  stroke: var(--dg-paper, #000);
  stroke-width: 2.5;
  transition: transform 0.15s;
}
.pt .ring, .pt .dot { transform-box: fill-box; transform-origin: center; }

/* free: solid; slide: solid with a standing ring; determined: open; locked: small and quiet */
.pt.slide .ring { opacity: 0.5; transform: scale(0.75); }
.pt.fixed .dot, .pt.locked .dot { fill: var(--dg-paper, #000); stroke: var(--dg-accent, #f40); stroke-width: 3; }
.pt.locked .dot { transform: scale(0.8); }

.pt:not(.locked):hover .ring, .pt.active .ring { opacity: 1; transform: scale(1); }
.pt:not(.locked):hover .dot, .pt.active .dot { transform: scale(1.3); }

.label {
  font-family: var(--dg-font, sans-serif);
  font-size: var(--dg-label-size, 24px);
  fill: var(--dg-accent, #f40);
  /* A halo in the paper colour, so lines break around the letters. */
  paint-order: stroke;
  stroke: var(--dg-paper, #000);
  stroke-width: 7px;
  stroke-linejoin: round;
  pointer-events: none;
}
.label.aux { font-size: calc(var(--dg-label-size, 24px) * 0.75); }
</style>
