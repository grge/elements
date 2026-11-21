<template>
  <div class="graph-view">
    <p class="legend">
      <span>Each word points to the words its definition uses.</span>
      <span><i class="key leaf" /> open: rests on nothing</span>
      <span><i class="key defined" /> defined</span>
      <span><i class="key plane" /> a word of the plane</span>
      <span class="hint">Arrows between chapters show on hover. Hover a word to trace what it rests on <i class="swatch down" /> and what rests on it <i class="swatch up" /></span>
    </p>

    <div class="scroller">
      <div class="canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }" :class="{ tracing: !!focus }">
        <div
          v-for="(l, i) in layout.lanes" :key="l.id" class="lane" :class="{ alt: i % 2 === 1 }"
          :style="{ top: `${l.y}px`, height: `${l.height}px` }"
        >
          <span class="lane-title">{{ laneTitle(l.id) }}</span>
        </div>

        <svg class="edges" :width="layout.width" :height="layout.height" aria-hidden="true">
          <defs>
            <marker v-for="m in ['plain', 'down', 'up']" :id="`${uid}-${m}`" :key="m" :class="m"
              viewBox="0 0 8 8" refX="7.5" refY="4" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" />
            </marker>
          </defs>
          <path
            v-for="e in orderedEdges" :key="`${e.from}>${e.to}`" :d="e.d" class="edge" :class="edgeClass(e)"
            :marker-end="`url(#${uid}-${edgeClass(e) || 'plain'})`"
          />
        </svg>

        <button
          v-for="n in nodes" :key="n.id" class="node"
          :class="[n.kind, { plane: n.plane, current: n.id === current, unused: !n.used, openable: !!n.page }, traceClass(n.id)]"
          :style="{ left: `${n.x}px`, top: `${n.y}px`, width: `${SIZES.nodeWidth}px`, height: `${SIZES.nodeHeight}px` }"
          :title="n.doc"
          :tabindex="n.page ? 0 : -1"
          @pointerenter="focus = n.id" @pointerleave="focus = null"
          @focus="focus = n.id" @blur="focus = null"
          @click="n.page && emit('open', n.id, n.page)"
        >
          <span class="node-thumb">
            <FigureThumb v-if="n.page" :thumbnail="thumbnail(n.id)" />
          </span>
          <span class="node-text">
            <span class="node-name">{{ n.id }}</span>
            <span class="node-args">{{ n.args.join(' ') }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import FigureThumb from './FigureThumb.vue'
import type { Thumbnail } from '../composables/useThumbnails'
import { layoutWordGraph, SIZES, type PlacedEdge } from './wordGraphLayout'
import type { IndexRow } from './WordIndex.vue'
import type { Namespace } from '../composables/useKB'

const props = defineProps<{
  rows: IndexRow[]
  /** Lanes in order: [id, title]. A row's lane is its page's namespace, or 'none'. */
  lanes: [string, string][]
  current?: string
  /** A word's thumbnail, read when drawn, so the graph follows them as they are computed. */
  thumbnail: (name: string) => Thumbnail | null | undefined
}>()
const emit = defineEmits<{ open: [name: string, ns: Namespace] }>()
const uid = `graph-${useId()}`

const laneOf = (r: IndexRow) => r.page ?? (r.used ? 'none' : 'unused')
const laneTitle = (id: string) => props.lanes.find(l => l[0] === id)?.[1] ?? (id === 'unused' ? 'Not used' : 'Without clauses')

const layout = computed(() => layoutWordGraph(
  props.rows.map(r => ({ id: r.name, lane: laneOf(r), order: r.rank, dependsOn: r.dependsOn })),
  [...props.lanes.map(l => l[0]), 'none', 'unused'],
))

const nodes = computed(() => props.rows.map(r => {
  const p = layout.value.nodes.get(r.name)!
  return { ...r, id: r.name, x: p.x, y: p.y, kind: r.defined ? 'defined' : 'leaf' }
}))

// ── tracing: what the hovered word rests on (down), and what rests on it (up) ──

const focus = ref<string | null>(null)
const dependsOn = computed(() => new Map(props.rows.map(r => [r.name, r.dependsOn])))
const dependents = computed(() => {
  const m = new Map<string, string[]>()
  for (const r of props.rows) for (const d of r.dependsOn) m.set(d, [...(m.get(d) ?? []), r.name])
  return m
})
function closure(start: string, next: Map<string, string[]>): Set<string> {
  const out = new Set<string>()
  const stack = [...(next.get(start) ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    if (out.has(n)) continue
    out.add(n)
    stack.push(...(next.get(n) ?? []))
  }
  return out
}
const down = computed(() => focus.value ? closure(focus.value, dependsOn.value) : new Set<string>())
const up = computed(() => focus.value ? closure(focus.value, dependents.value) : new Set<string>())

function traceClass(id: string): string {
  if (!focus.value) return ''
  return id === focus.value ? 'focus' : down.value.has(id) ? 'down' : up.value.has(id) ? 'up' : 'dim'
}
function edgeClass(e: PlacedEdge): string {
  const f = focus.value
  if (!f) return ''
  if ((e.from === f || down.value.has(e.from)) && down.value.has(e.to)) return 'down'
  if (up.value.has(e.from) && (e.to === f || up.value.has(e.to))) return 'up'
  return 'dim'
}
// Arrows within a chapter always; arrows between chapters only on a trace through them, so the long
// cables down to chapter 1 appear for the word being traced, not all at once. Lit arrows drawn last.
const orderedEdges = computed(() => {
  const shown = layout.value.edges.filter(e => !e.cross || edgeClass(e) === 'down' || edgeClass(e) === 'up')
  const rank = (e: PlacedEdge) => { const c = edgeClass(e); return c === 'dim' ? 0 : c === '' ? 1 : 2 }
  return shown.sort((a, b) => rank(a) - rank(b))
})
</script>

<style scoped>
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 1.4rem; margin: 0 0 1.2rem; color: var(--soft); font: 0.75rem var(--font-mono); }
.legend span { display: inline-flex; align-items: center; gap: 0.45rem; }
.legend .hint { flex-basis: 100%; }
.key { display: inline-block; width: 16px; height: 10px; }
.key.leaf { background: var(--ink); }
.key.defined { box-shadow: inset 0 0 0 2px var(--ink); }
.key.plane { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }
.swatch { display: inline-block; width: 18px; height: 3px; }
.swatch.down { background: var(--accent); }
.swatch.up { background: var(--ink); }

.scroller { overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--soft) transparent; padding-bottom: 1rem; }
.canvas { position: relative; min-width: 100%; }

/* Lanes: chapters, full width, alternate ones faintly tinted, each under a rule. */
.lane {
  position: absolute; left: 0; right: 0;
  border-top: 2px solid var(--ink);
}
.lane.alt { background: color-mix(in srgb, var(--ink) 4%, transparent); }
.lane-title {
  position: absolute; left: 0; top: 0.6rem; white-space: nowrap;
  font: 400 0.75rem var(--font-mono); letter-spacing: 0.15em; text-transform: uppercase; color: var(--soft);
}

.edges { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.edge { fill: none; stroke: var(--ink); stroke-width: 1.2; opacity: 0.22; transition: opacity 0.12s; }
.edge.down { stroke: var(--accent); stroke-width: 2.6; opacity: 1; }
.edge.up { stroke: var(--ink); stroke-width: 2.2; opacity: 0.9; }
.edge.dim { opacity: 0.08; }
marker path { fill: var(--ink); opacity: 0.6; }
marker.down path { fill: var(--accent); opacity: 1; }
marker.up path { fill: var(--ink); opacity: 1; }

.node {
  position: absolute; box-sizing: border-box; overflow: hidden;
  display: flex; align-items: stretch; gap: 0.55rem;
  padding: 0 0.6rem 0 0; text-align: left; cursor: default;
  background: var(--paper); color: var(--ink); border: 0;
  box-shadow: inset 0 0 0 2px var(--ink);
  transition: opacity 0.12s, transform 0.12s;
}
.node.openable { cursor: pointer; }
/* The word's figure, a small window of paper at its left, inside the frame. */
.node-thumb {
  flex: none; width: 54px; margin: 2px 0 2px 2px; display: grid; place-items: center;
  background: color-mix(in srgb, var(--ink) 6%, var(--paper));
  --dg-ink: var(--ink); --dg-accent: var(--accent); --dg-paper: var(--paper);
}
.node-thumb :deep(.figure-thumb) { width: 100%; height: 100%; }
.node-text { display: flex; flex-direction: column; justify-content: center; gap: 0.1rem; min-width: 0; }
.node.leaf .node-thumb { margin: 0; }
.node-name {
  max-width: 100%; padding-right: 0.5rem;
  font: 900 0.68rem/1.12 var(--font-display); text-transform: uppercase; letter-spacing: 0.03em;
}
.node-args { font: 0.68rem var(--font-mono); letter-spacing: 0.2em; color: var(--accent); white-space: nowrap; overflow: hidden; max-width: 100%; }

/* Open words rest on nothing: solid blocks of ink. */
.node.leaf { background: var(--ink); color: var(--paper); }
.node.leaf .node-args { color: var(--paper); opacity: 0.7; }
/* A word of the plane: the relation table knows it itself. */
.node.plane::after {
  content: ''; position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent);
}
.node.unused { opacity: 0.55; }
.node.current { outline: 3px solid var(--accent); outline-offset: 3px; }

.node.openable:hover, .node.focus { transform: translate(-2px, -2px); box-shadow: inset 0 0 0 2px var(--ink), 4px 4px 0 var(--ink); }
.node.leaf.focus, .node.leaf.openable:hover { box-shadow: 4px 4px 0 var(--accent); }
.node:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.node.down { box-shadow: inset 0 0 0 3px var(--accent); }
.node.leaf.down { background: var(--accent); color: var(--paper); box-shadow: none; }
.node.leaf.down .node-args { color: var(--paper); }
.node.up { box-shadow: inset 0 0 0 3px var(--ink); }
.node.dim { opacity: 0.22; }
</style>
