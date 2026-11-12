<template>
  <div class="geometry-diagram" ref="containerRef" :class="{ dragging: dragging !== null }">
    <svg
      v-if="scene"
      :width="viewportWidth"
      :height="viewportHeight"
      :viewBox="`0 0 ${viewportWidth} ${viewportHeight}`"
      @pointerdown="startInteraction"
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
        <line v-for="(l, i) in scene.lines" :key="`gl${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :style="look(l[4], 'lines', i)" />
        <circle v-for="(c, i) in scene.circles" :key="`gc${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" :style="look(c[3], 'circles', i)" />
        <line v-for="(l, i) in scene.segments" :key="`gs${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :style="look(l[4], 'segments', i)" />
        <line v-for="(l, i) in scene.ticks" :key="`gk${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :style="look(l[4], 'segments', scene.meta.ticks[i])" />
        <path v-for="(a, i) in scene.arcs" :key="`ga${i}`" :d="a.d" :style="weight(a.level)" />
      </g>

      <g class="crisp" :mask="`url(#${uid}-crisp)`">
        <line v-for="(l, i) in scene.lines" :key="`l${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :style="look(l[4], 'lines', i)" />
        <circle v-for="(c, i) in scene.circles" :key="`c${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" :style="look(c[3], 'circles', i)" />
        <line v-for="(l, i) in scene.segments" :key="`s${i}`" class="segment" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :style="look(l[4], 'segments', i)" />
        <line v-for="(l, i) in scene.ticks" :key="`k${i}`" class="tick" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :style="look(l[4], 'segments', scene.meta.ticks[i])" />
        <path v-for="(a, i) in scene.arcs" :key="`a${i}`" class="arc" :d="a.d" :style="weight(a.level)" />
        <template v-for="(r, i) in scene.route" :key="`r${i}`">
          <line v-if="r.kind === 'line'" class="route" :x1="r.x1" :y1="r.y1" :x2="r.x2" :y2="r.y2" />
          <circle v-else class="route" :cx="r.cx" :cy="r.cy" :r="r.r" />
        </template>
        <text v-for="p in scene.points" :key="`t${p.name}`" class="label" :class="{ aux: p.aux, lit: lit(p.name), dim: dimPoint(p.name) }" :x="p.x + 12" :y="p.y - 12">{{ p.label }}</text>
      </g>

      <!-- Points stay crisp and grabbable everywhere, even under the text. -->
      <g
        v-for="p in scene.points"
        :key="p.name"
        class="pt"
        :class="[p.kind, { aux: p.aux, active: dragging === p.name, lit: lit(p.name), dim: dimPoint(p.name) }]"
        :data-point="p.name"
        :transform="`translate(${p.x} ${p.y})`"
        @pointerenter="hoverPoint(p.name)"
        @pointerleave="hoverPoint(null)"
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
import { solve, type WitnessModel } from '../geometry/solver'
import type { Figure } from '../geometry/figure'
import { computeRenderTransform, screenToWorld, type RenderTransform } from '../geometry/view'
import { buildScene, emphasise, type Emphasis, type Helper } from '../geometry/scene'
import type { GroundPredicate } from '../kb/inference'
import {
  execute, drag as dragConstruction, draggable, plan as planConstruction, realise,
  type ConstructionPlan, type Point,
  curveNear,
} from '../geometry/construction'
import { displayName, isAuxiliary } from '../kb/names'
import type { ConstructionState } from '../composables/useWorkspace'

const props = defineProps<{
  /** What to draw through the points (figure.ts). */
  figure: Figure | null
  /**
   * The construction model and, if one was found, its plan. With usePlanner the plan places the
   * points; without it the numerical solver places them from the same model.
   */
  construction?: ConstructionState | null
  usePlanner?: boolean
  /** Width in px of the strip on the left where text lies over the figure. */
  veil?: number
  padding?: number
  /** Bring forward what these facts draw and these points (what is hovered in the source). */
  focus?: { facts: GroundPredicate[]; points: string[] } | null
  /** A point touched from outside the figure (a construction step hovered): its route is shown. */
  touch?: string | null
}>()

const emit = defineEmits<{
  'update:construction': [state: ConstructionState]
  /** The point under the pointer, or null when it leaves. */
  'hover-point': [name: string | null]
}>()

const VEIL_FADE = 48
/** Length of a tick mark across an equal segment, in px: bold, as Byrne draws them. */
const TICK = 16
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
  if (!props.figure || !props.construction) return null
  try {
    if (planning.value) {
      // Keep each intersection on the branch it was on (continuity while dragging).
      const drawing = execute(local.value!.plan, local.value!.params, { previous: lastCoords })
      if (!drawing.failure) lastCoords = drawing.coords
      return { coords: drawing.coords, energy: 0 }
    }
    return solve(props.construction.model) || null
  } catch (e) {
    console.warn('Drawing error:', e)
    return null
  }
})

const activeWitness = computed(() => draggedWitness.value ?? baseWitness.value)
const displayTransform = computed(() => frozenTransform.value ?? animatedTransform.value)

function currentPadding() {
  return props.padding ?? Math.max(60, Math.min(viewportWidth.value, viewportHeight.value) * 0.12)
}

function fit(witness: WitnessModel) {
  return computeRenderTransform(witness, viewportWidth.value, viewportHeight.value, currentPadding(), props.figure, veilAt.value)
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

/**
 * How a level is drawn: each level deeper is thinner and fainter, down to a floor, so a
 * construction's own lines lead and the scaffolding of the constructions inside it recedes.
 */
function weight(level: number | undefined) {
  const n = level ?? 0
  if (n === 0) return undefined
  return { strokeWidth: `calc(var(--dg-stroke, 3) * ${Math.max(0.3, 0.68 ** n).toFixed(3)})`, opacity: Math.max(0.22, 0.62 ** n).toFixed(3) }
}

/** What the focus brings forward; everything else recedes. */
const emphasis = computed<Emphasis | null>(() =>
  props.focus && scene.value ? emphasise(scene.value, props.focus.facts, props.focus.points) : null)

/** How an element is drawn: its level, and whether the focus brings it forward or lets it recede. */
function look(level: number | undefined, kind: 'lines' | 'circles' | 'segments', i: number) {
  const base = weight(level)
  const em = emphasis.value
  if (!em || !props.focus?.facts.length) return base   // a name alone lights its point, nothing else
  if (em[kind].has(i)) return { strokeWidth: `calc(var(--dg-stroke, 3) * 1.25)`, opacity: '1' }
  return { ...(base ?? {}), opacity: '0.18' }
}
const lit = (name: string) => !!emphasis.value?.points.has(name)
const dimPoint = (name: string) => !!emphasis.value && !!props.focus?.facts.length && !emphasis.value.points.has(name)

function hoverPoint(name: string | null) {
  if (dragging.value) return
  hovered.value = name
  emit('hover-point', name)
}

/** The point touched (hovered, or held while dragging): its route is shown. */
const hovered = ref<string | null>(null)
const touched = computed(() => dragging.value ?? hovered.value ?? props.touch ?? null)

/** The loci the construction used to place the touched point, at the current positions. */
function helpersFor(coords: Map<string, Point>): Helper[] {
  if (!planning.value || !touched.value) return []
  const out: Helper[] = []
  for (const step of local.value!.plan.steps) {
    if (step.point !== touched.value) continue
    const loci = step.kind === 'on' ? [step.locus] : step.kind === 'meet' ? step.loci : []
    for (const locus of loci) {
      const curve = curveNear(locus, coords, coords.get(step.point)!)
      if (!curve) continue
      out.push(curve.kind === 'line'
        ? { point: step.point, kind: 'line', p: curve.p, d: curve.d, ray: curve.ray }
        : { point: step.point, kind: 'circle', c: curve.c, r: curve.r })
    }
  }
  return out
}

const scene = computed(() => {
  const witness = activeWitness.value, t = displayTransform.value
  if (!props.figure || !witness || !t) return null
  let helpers: Helper[] = []
  try { helpers = helpersFor(witness.coords) } catch { /* a step whose points are missing: draw without */ }
  const base = buildScene(props.figure, witness.coords, t, viewportWidth.value, viewportHeight.value, TICK, helpers)
  const points = base.points.map(p => {
    const kind = kindOf(p.name)
    return { ...p, kind, aux: isAuxiliary(p.name), label: displayName(p.name), title: `${displayName(p.name)}: ${TITLES[kind]}` }
  })
  return { ...base, points }
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

function startInteraction(e: PointerEvent) {
  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
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

  function onMove(ev: PointerEvent) {
    if (ev.pointerId !== e.pointerId) return
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
    try { draggedWitness.value = solve(props.construction!.model, 0, warmStart, new Map([[point!, world]])) }
    catch { draggedWitness.value = { coords: warmStart, energy: witness!.energy } }
  }

  function onUp(ev: PointerEvent) {
    if (ev.pointerId !== e.pointerId) return
    if (planning.value) emit('update:construction', local.value!)
    dragging.value = null
    const from = frozenTransform.value
    frozenTransform.value = null
    draggedWitness.value = null
    const to = baseWitness.value ? fit(baseWitness.value) : null
    if (from && to) { animatedTransform.value = from; animateToTransform(from, to) }
    else animatedTransform.value = null
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onUp)
  }

  // Pointer events cover mouse, touch and pen alike.
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
  document.addEventListener('pointercancel', onUp)
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

watch([() => props.figure, () => props.usePlanner], () => {
  draggedWitness.value = null
  frozenTransform.value = null
  animatedTransform.value = null
}, { immediate: true })

watch([baseWitness, viewportWidth, viewportHeight, veilAt], () => {
  if (frozenTransform.value || !baseWitness.value) return
  animatedTransform.value = fit(baseWitness.value)
}, { immediate: true })

</script>

<style scoped>
.geometry-diagram {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
}
.geometry-diagram svg { display: block; touch-action: none; }  /* a finger on the figure drags points, not the page */

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
.crisp .tick { stroke-width: var(--dg-stroke, 3); stroke-linecap: round; }
.crisp .arc, .ghost path { fill: none; stroke: var(--dg-ink, #fff); stroke-width: var(--dg-stroke, 3); stroke-linecap: round; }

/* The route: the loci that placed the touched point. Not the figure, so drawn apart: thin, dashed,
   in the accent colour. */
.crisp .route {
  fill: none;
  stroke: var(--dg-accent, #f40);
  stroke-width: 1.5;
  stroke-dasharray: 6 5;
  opacity: 0.9;
  pointer-events: none;
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
  font-weight: 900;  /* the display face has one weight; a fallback family takes its heaviest */
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

/* ── the focus: what is hovered in the source comes forward, the rest recedes ── */
.crisp line, .crisp > circle, .ghost line, .ghost circle { transition: opacity 0.15s, stroke-width 0.15s; }
.label, .pt { transition: opacity 0.15s; }
.label.dim, .pt.dim { opacity: 0.3; }
.pt.lit .ring { opacity: 1; transform: scale(1); }
.pt.lit .dot { transform: scale(1.3); }
</style>
