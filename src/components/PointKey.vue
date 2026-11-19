<template>
  <!-- A point's marker as the figure draws it, small, for a key beside the construction's steps. -->
  <svg class="point-key" :class="kind" viewBox="-11 -11 22 22" width="18" height="18" aria-hidden="true">
    <path v-if="kind === 'solved'" :d="asteriskFor(name)" />
    <template v-else>
      <circle v-if="kind === 'slide'" class="ring" r="9.5" />
      <circle class="dot" :r="kind === 'slide' ? 5.5 : 6.5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { asteriskFor } from './asterisks'

/** free: anywhere; slide: on a line or circle; fixed: determined; solved: placed by the solver. */
defineProps<{ name: string; kind: 'free' | 'slide' | 'fixed' | 'solved' }>()
</script>

<style scoped>
.point-key { flex: none; overflow: visible; }
.dot { fill: var(--accent); }
.ring { fill: none; stroke: var(--accent); stroke-width: 2; opacity: 0.6; }
.fixed .dot { fill: none; stroke: var(--accent); stroke-width: 2.5; }
.solved path { fill: none; stroke: var(--accent); stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
</style>
