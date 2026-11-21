<template>
  <div class="index">
    <div class="tools">
      <label class="search">
        <span class="visually-hidden">Search words</span>
        <input v-model="query" type="search" placeholder="search words" spellcheck="false" autocomplete="off" />
      </label>
      <span class="count">{{ shown.length }} of {{ rows.length }}</span>
      <button v-if="filtering" class="quiet" @click="clearFilters">clear filters</button>
    </div>

    <p class="legend">
      <span><i class="dot own" /> the plane knows it itself</span>
      <span><i class="dot via" /> through its definition</span>
      <span><i class="dot rules" /> proved from its rules</span>
    </p>

    <div class="scroller">
      <table>
        <thead>
          <tr>
            <th v-for="c in COLUMNS" :key="c.key" :class="[c.key, { sorted: sort.key === c.key }]" :aria-sort="ariaSort(c.key)" scope="col">
              <button class="head" :title="c.help" @click="sortBy(c.key)">
                {{ c.label }}<span class="arrow" aria-hidden="true">{{ sort.key === c.key ? (sort.dir > 0 ? '↓' : '↑') : '' }}</span>
              </button>
              <select
                v-if="c.filter" v-model="filters[c.key]" class="filter" :class="{ on: filters[c.key] !== '' }"
                :aria-label="`Filter by ${c.label}`"
              >
                <option value="">all</option>
                <option v-for="v in valuesOf(c.key)" :key="v" :value="v">{{ c.key === 'chapter' ? shortChapter(v) : v }}</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in shown" :key="r.name"
            :class="{ openable: !!r.page, current: r.name === current, unused: !r.used }"
            :tabindex="r.page ? 0 : -1"
            @click="open(r)" @keydown.enter="open(r)"
          >
            <th scope="row" class="name">
              <div class="word">
                <FigureThumb v-if="r.page" class="thumb" :thumbnail="thumbnail(r.name)" />
                <span v-else class="thumb none" />
                <span class="word-text">
                  <span class="word-name">{{ r.name }}</span>
                  <span class="word-args">{{ r.args.join(' ') }}</span>
                  <span v-if="r.doc" class="word-doc">{{ r.doc }}</span>
                </span>
              </div>
            </th>
            <td class="chapter">{{ shortChapter(r.chapter) }}</td>
            <td class="defined"><span :class="r.defined ? 'tag' : 'plain'">{{ r.defined ? 'defined' : 'open' }}</span></td>
            <td v-for="k in CAPS" :key="k" :class="k">
              <span class="cap" :class="r[k].source">
                <i class="dot" :class="r[k].source === 'itself' ? 'own' : r[k].source === 'none' ? '' : 'via'" />
                <span v-if="r[k].source === 'definition'" class="words"><span v-for="w in r[k].detail" :key="w">{{ w }}</span></span>
                <span v-else>{{ capText(k, r[k]) }}</span>
              </span>
            </td>
            <td class="measured">
              <span class="cap" :class="r.measured.source">
                <i class="dot" :class="r.measured.source === 'itself' ? 'own' : r.measured.source === 'none' ? '' : 'via'" />
                <span>{{ measureText(r.measured) }}</span>
              </span>
            </td>
            <td class="convention">
              <span class="cap" :class="r.convention ? 'itself' : 'none'">
                <i class="dot" :class="{ own: r.convention }" /><span>{{ r.convention ? 'names apart' : '–' }}</span>
              </span>
            </td>
            <td class="discovered">
              <span class="cap" :class="r.discovered.length ? 'rules' : 'none'">
                <i class="dot" :class="{ rules: r.discovered.length }" /><span>{{ r.discovered.join(', ') || '–' }}</span>
              </span>
            </td>
          </tr>
          <tr v-if="!shown.length" class="nothing"><td :colspan="COLUMNS.length">No word matches.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import FigureThumb from './FigureThumb.vue'
import type { Thumbnail } from '../composables/useThumbnails'
import type { Capability, WordRow } from '../geometry/vocabulary'
import type { Namespace } from '../composables/useKB'

/** A row of the index: a word of the vocabulary, with its page if it has one. */
export interface IndexRow extends WordRow {
  /** The page to open: the chapter (or 'user') that defines it. Absent for a word with no clauses. */
  page?: Namespace
  chapter: string
  /** Its place in the book, for the default order. */
  rank: number
  doc?: string
}

const props = defineProps<{
  rows: IndexRow[]
  /** A word's thumbnail, read when drawn, so the index follows them as they are computed. */
  thumbnail: (name: string) => Thumbnail | null | undefined
  current?: string
}>()
const emit = defineEmits<{ open: [name: string, ns: Namespace] }>()

type CapKey = 'constructs' | 'draws' | 'marks'
const CAPS: CapKey[] = ['constructs', 'draws', 'marks']
type Key = 'name' | 'chapter' | 'defined' | CapKey | 'measured' | 'convention' | 'discovered'

const COLUMNS: { key: Key; label: string; help: string; filter: boolean }[] = [
  { key: 'name', label: 'Word', help: 'The word, with its arguments', filter: false },
  { key: 'chapter', label: 'Chapter', help: 'Where it is first defined', filter: true },
  { key: 'defined', label: 'Defined', help: 'Defined: the book gives it a definition the engine may unfold. Open: only rules about it.', filter: true },
  { key: 'constructs', label: 'Constructs', help: 'The planner reads it when placing points', filter: true },
  { key: 'draws', label: 'Draws', help: 'The figure draws ink for it', filter: true },
  { key: 'marks', label: 'Marks', help: 'Equalities shown on the figure: ticks, arcs, arrows, hatching, the square of a right angle', filter: true },
  { key: 'measured', label: 'Measured', help: 'Whether a claim of it can be checked against a figure’s positions', filter: true },
  { key: 'convention', label: 'Convention', help: 'Held by the checker’s convention that different names are different points', filter: true },
  { key: 'discovered', label: 'Discovered', help: 'Structure the engine proves from the rules: the equality, equivalences, symmetries', filter: true },
]

const SOURCE_LABEL = { itself: 'itself', definition: 'via definition', none: 'no' } as const
const MEASURE_LABEL = { itself: 'itself', definition: 'via definition', hypothesis: 'hypothesis only', none: 'no' } as const

/** "Chapter 1 — Length" as "1 Length": the column is narrow. */
const shortChapter = (t: string) => t.replace(/^Chapter\s+(\S+)\s*[—–-]\s*/, '$1 ')

function capText(k: CapKey, c: Capability): string {
  if (c.source === 'none') return '–'
  if (c.source === 'itself') return k === 'marks' ? c.detail.join(', ') : 'itself'
  return c.detail.join(' ')
}
function measureText(m: WordRow['measured']): string {
  if (m.source === 'none') return m.detail.length ? `no: ${m.detail.join(', ')}` : '–'
  if (m.source === 'hypothesis') return 'as a hypothesis'
  return m.source === 'itself' ? 'itself' : 'via definition'
}

/** The value a column filters and sorts by. */
function valueOf(r: IndexRow, k: Key): string {
  switch (k) {
    case 'name': return r.name
    case 'chapter': return r.chapter
    case 'defined': return r.defined ? 'defined' : 'open'
    case 'constructs': case 'draws': case 'marks': return SOURCE_LABEL[r[k].source]
    case 'measured': return MEASURE_LABEL[r.measured.source]
    case 'convention': return r.convention ? 'yes' : 'no'
    case 'discovered': return r.discovered.join(', ') || 'nothing'
  }
}
const ORDER: Record<string, number> = { itself: 0, 'via definition': 1, 'hypothesis only': 2, no: 3, yes: 0, defined: 0, open: 1, nothing: 9 }

function valuesOf(k: Key): string[] {
  const vs = [...new Set(props.rows.map(r => valueOf(r, k)))]
  return k === 'chapter'
    ? vs.sort((a, b) => rankOf(a) - rankOf(b))
    : vs.sort((a, b) => (ORDER[a] ?? 5) - (ORDER[b] ?? 5) || a.localeCompare(b))
}
const rankOf = (chapter: string) => Math.min(...props.rows.filter(r => r.chapter === chapter).map(r => r.rank))

// ── search, filters, sort: remembered in this browser ──

const KEY = 'elements.index'
function load(): { query: string; filters: Partial<Record<Key, string>>; sort: { key: Key | null; dir: 1 | -1 } } {
  try { return { query: '', filters: {}, sort: { key: null, dir: 1 }, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } }
  catch { return { query: '', filters: {}, sort: { key: null, dir: 1 } } }
}
const saved = load()
const query = ref(saved.query)
const filters = reactive(Object.fromEntries(COLUMNS.map(c => [c.key, saved.filters[c.key] ?? ''])) as Record<Key, string>)
/** null: the book's order. */
const sort = reactive(saved.sort)
watch([query, filters, sort], () => {
  try { localStorage.setItem(KEY, JSON.stringify({ query: query.value, filters, sort })) } catch { /* not remembered */ }
}, { deep: true })

const filtering = computed(() => COLUMNS.some(c => filters[c.key] !== '') || query.value !== '')
function clearFilters() {
  for (const c of COLUMNS) filters[c.key] = ''
  query.value = ''
}

/** Click a heading: sort by it, then the other way, then back to the book's order. */
function sortBy(k: Key) {
  if (sort.key !== k) { sort.key = k; sort.dir = 1 }
  else if (sort.dir === 1) sort.dir = -1
  else { sort.key = null; sort.dir = 1 }
}
const ariaSort = (k: Key) => sort.key !== k ? 'none' : sort.dir > 0 ? 'ascending' : 'descending'

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = props.rows.filter(r =>
    COLUMNS.every(c => !filters[c.key] || valueOf(r, c.key) === filters[c.key]) &&
    (!q || [r.name, r.chapter, r.doc ?? ''].some(s => s.toLowerCase().includes(q)) ||
      // A word's exact name also finds the words built on it: `eq-angle` finds the rectangle.
      [...r.constructs.detail, ...r.draws.detail, ...r.marks.detail, ...r.discovered].some(s => s.toLowerCase() === q)))
  const k = sort.key
  if (!k) return rows
  const cmp = (a: IndexRow, b: IndexRow) => {
    if (k === 'name') return a.name.localeCompare(b.name)
    if (k === 'chapter') return a.rank - b.rank
    const va = valueOf(a, k), vb = valueOf(b, k)
    return (ORDER[va] ?? 5) - (ORDER[vb] ?? 5) || va.localeCompare(vb)
  }
  return [...rows].sort((a, b) => sort.dir * cmp(a, b) || a.rank - b.rank)
})

function open(r: IndexRow) {
  if (r.page) emit('open', r.name, r.page)
}
</script>

<style scoped>
.index { --row-hover: color-mix(in srgb, var(--ink) 7%, var(--paper)); --dg-ink: var(--ink); --dg-accent: var(--accent); --dg-paper: var(--paper); }

.tools { display: flex; align-items: center; gap: 1.2rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.search input {
  width: min(22rem, 70vw); background: none; color: var(--ink);
  border: 0; border-bottom: 3px solid var(--ink); padding: 0.3rem 0;
  font: 900 1.3rem var(--font-display); text-transform: uppercase; letter-spacing: 0.03em;
}
.search input::placeholder { color: var(--soft); opacity: 0.8; }
.search input:focus { outline: none; border-bottom-color: var(--accent); }
.count { color: var(--soft); font: 0.8rem var(--font-mono); }

.legend { display: flex; flex-wrap: wrap; gap: 0.3rem 1.4rem; margin: 0 0 1.2rem; color: var(--soft); font: 0.75rem var(--font-mono); }
.legend span { display: inline-flex; align-items: center; gap: 0.45rem; }

/* The capability dots: a solid accent disc, the plane's own; a ring, by definition; a solid ink
   square, proved from the rules. */
.dot { flex: none; display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
.dot.own { background: var(--accent); }
.dot.via { box-shadow: inset 0 0 0 2px var(--ink); }
.dot.rules { background: var(--ink); border-radius: 1px; }

.scroller { overflow-x: auto; scrollbar-width: thin; scrollbar-color: var(--soft) transparent; }
table { border-collapse: collapse; width: 100%; min-width: 1040px; }

thead th {
  text-align: left; vertical-align: bottom; padding: 0 0.7rem 0.5rem 0;
  border-bottom: 4px solid var(--ink); white-space: nowrap;
}
.head {
  display: block; background: none; border: 0; padding: 0; cursor: pointer; color: var(--soft);
  font: 400 0.72rem var(--font-mono); letter-spacing: 0.15em; text-transform: uppercase;
}
.head:hover, th.sorted .head { color: var(--ink); }
.arrow { color: var(--accent); margin-left: 0.3rem; }
.filter {
  display: block; width: 100%; margin-top: 0.35rem; cursor: pointer;
  background: none; color: var(--soft); border: 0; border-bottom: 1px dotted var(--soft); padding: 0 0 1px;
  font: 0.72rem var(--font-mono);
}
.filter.on { color: var(--accent); border-bottom: 2px solid var(--accent); }
.filter option { background: var(--paper); color: var(--ink); }

tbody tr { border-bottom: 1px solid color-mix(in srgb, var(--ink) 18%, transparent); }
tbody tr.openable { cursor: pointer; }
tbody tr.openable:hover, tbody tr.openable:focus-visible { background: var(--row-hover); outline: none; }
/* The word stays in view while the table scrolls sideways (a phone). */
thead th.name, tbody th.name { position: sticky; left: 0; z-index: 1; background: var(--paper); }
tbody tr.openable:hover th.name, tbody tr.openable:focus-visible th.name { background: var(--row-hover); }
tbody tr.openable:hover .word-name, tbody tr.current .word-name { color: var(--accent); }
tbody tr.unused { opacity: 0.6; }
td, tbody th { padding: 0.45rem 0.7rem 0.45rem 0; vertical-align: middle; text-align: left; font: 0.8rem/1.35 var(--font-mono); }

.word { display: flex; align-items: center; gap: 0.8rem; }
.thumb { flex: none; width: 64px; height: 45px; background: color-mix(in srgb, var(--ink) 6%, transparent); }
.thumb.none { display: block; background: none; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 14%, transparent); }
.word-text { display: flex; flex-direction: column; min-width: 0; max-width: 20rem; }
.word-name { font: 900 0.95rem var(--font-display); text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink); }
.word-args { font: 0.75rem var(--font-mono); color: var(--accent); letter-spacing: 0.2em; }
.word-doc {
  font: 0.8rem/1.3 var(--font-prose); color: var(--soft); font-weight: 400;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;
}
tbody tr:hover .word-doc { -webkit-line-clamp: 3; }

.chapter { color: var(--soft); white-space: nowrap; }
.tag { color: var(--ink); }
.plain { color: var(--soft); }

.cap { display: inline-flex; align-items: flex-start; gap: 0.45rem; }
.cap .dot { margin-top: calc((1.35em - 9px) / 2); }
.words { display: flex; flex-wrap: wrap; gap: 0 0.7em; }
.words span { white-space: nowrap; }
.cap.itself, .cap.rules { color: var(--ink); }
.cap.definition, .cap.hypothesis { color: var(--soft); }
.cap.none { color: color-mix(in srgb, var(--soft) 60%, transparent); }
.constructs, .draws, .marks { max-width: 13rem; }
.measured { white-space: nowrap; }

.nothing td { padding: 2rem 0; color: var(--soft); }

.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.quiet {
  background: none; border: 0; color: var(--soft); cursor: pointer; white-space: nowrap;
  font: 0.8rem var(--font-mono); text-decoration: underline; text-underline-offset: 3px;
}
.quiet:hover { color: var(--ink); }

@media (max-width: 720px) {
  .word-doc { display: none; }
}
</style>
