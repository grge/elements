<template>
  <svg class="figure-thumb" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <template v-if="scene">
      <line v-for="(l, i) in scene.lines" :key="`l${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :opacity="fade(l[4])" />
      <circle v-for="(c, i) in scene.circles" :key="`c${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" :opacity="fade(c[3])" />
      <line v-for="(l, i) in [...scene.segments, ...scene.ticks]" :key="`s${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" :opacity="fade(l[4])" />
      <circle v-for="p in scene.points" :key="p.name" class="point" :cx="p.x" :cy="p.y" :r="isAuxiliary(p.name) ? 2 : 2.8" />
    </template>
    <text v-else-if="thumbnail === null && fallback" class="fallback" :x="W / 2" :y="H / 2">{{ fallback }}</text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** Deeper levels fainter, as on the page (thumbnails are too small for thinner). */
const fade = (level: number | undefined) => Math.max(0.3, 0.62 ** (level ?? 0)).toFixed(3)
import { computeRenderTransform } from '../geometry/view'
import { buildScene } from '../geometry/scene'
import { isAuxiliary } from '../kb/names'
import type { Thumbnail } from '../composables/useThumbnails'

const props = defineProps<{
  /** The figure; null if there is nothing to draw; undefined while it is being computed. */
  thumbnail: Thumbnail | null | undefined
  /** Shown when there is nothing to draw. */
  fallback?: string
}>()

const W = 160, H = 112, PAD = 14

const scene = computed(() => {
  const th = props.thumbnail
  if (!th) return null
  const t = computeRenderTransform({ coords: th.coords, energy: 0 }, W, H, PAD, th.problem)
  return t ? buildScene(th.problem, th.coords, t, W, H, 5) : null
})
</script>

<style scoped>
.figure-thumb { display: block; width: 100%; height: auto; overflow: hidden; }
line, circle { fill: none; stroke: var(--dg-ink, currentColor); stroke-width: 1.6; }
.point { fill: var(--dg-accent, currentColor); stroke: var(--dg-paper, transparent); stroke-width: 1; }
.fallback {
  fill: var(--dg-accent, currentColor);
  font: 400 22px var(--ed-font, monospace);
  text-anchor: middle;
  dominant-baseline: central;
  letter-spacing: 0.3em;
}
</style>
