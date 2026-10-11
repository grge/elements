<template>
  <div class="page" :style="themeStyle" @keydown.esc="contentsOpen = false">
    <header class="masthead">
      <button class="wordmark" @click="contentsOpen = !contentsOpen" :aria-expanded="contentsOpen">
        Elements
      </button>
      <h1 class="title" @click="contentsOpen = true">
        <template v-if="ws.mode.value === 'scratchpad'">Scratch</template>
        <template v-else>
          {{ ws.selectedPred.value }}
          <span v-for="(a, i) in headArgs" :key="i" class="arg">{{ a }}</span>
        </template>
      </h1>
      <span v-if="ws.mode.value === 'predicate'" class="ns">{{ ws.selectedNamespace.value }}</span>
      <button v-if="ws.selectedNamespace.value === 'user'" class="quiet" @click="ws.deleteSelected()">delete</button>

      <div class="themes" role="group" aria-label="Colour theme">
        <button
          v-for="(t, i) in THEMES" :key="t.name"
          class="swatch" :class="{ current: i === themeIndex }"
          :style="{ background: t.paper, color: t.accent, borderColor: t.ink }"
          :title="t.name" :aria-label="t.name" :aria-pressed="i === themeIndex"
          @click="setTheme(i)"
        ><span /></button>
        <button
          class="quiet shuffle" :class="{ on: shuffle }" :aria-pressed="shuffle"
          title="Change theme whenever something is opened from the contents"
          @click="toggleShuffle"
        >shuffle</button>
      </div>
    </header>

    <main class="stage" :style="{ '--veil': `${veil}px` }">
      <GeometryDiagram
        class="figure"
        :problem="ws.problem.value"
        :construction="ws.construction.value"
        :use-planner="usingConstruction"
        :veil="veil"
        :padding="48"
        @update:construction="ws.setConstruction"
      >
        <template #empty><span class="empty">nothing to draw yet</span></template>
      </GeometryDiagram>

      <section ref="textRef" class="text">
        <div class="editor">
          <CodeEditor
            v-model="ws.text.value"
            :readonly="ws.readOnly.value"
            :marks="marks"
            :predicates="predicateNames"
            placeholder="circle a b c"
          />
        </div>
        <ol v-if="planSteps.length" class="steps">
          <li v-for="(s, i) in planSteps" :key="i" :class="{ failed: failure?.step === i }"><b>{{ s.point }}</b> {{ s.how }}</li>
        </ol>
      </section>

      <footer class="foot">
        <p class="status">{{ status }}</p>
        <button class="quiet" @click="ws.usePlanner.value = !ws.usePlanner.value">
          {{ ws.usePlanner.value ? 'ruler & compass' : 'numerical solver' }}
        </button>
      </footer>
    </main>

    <transition name="fade">
      <nav v-if="contentsOpen" class="contents" @click.self="contentsOpen = false">
        <div class="contents-inner">
          <button class="entry scratch" @click="go(() => ws.openScratchpad())">Scratch</button>
          <div v-for="g in groups" :key="g.ns" class="group">
            <h2>{{ g.ns }}</h2>
            <button
              v-for="p in g.items" :key="p.name" class="entry"
              :class="{ current: ws.selectedPred.value === p.name && ws.selectedNamespace.value === g.ns }"
              @click="go(() => ws.openPredicate(p.name, g.ns))"
            >{{ p.name }}<sup>{{ p.arity }}</sup></button>
            <button v-if="g.ns === 'user'" class="entry add" @click="addUser">+ new</button>
          </div>
        </div>
      </nav>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { parseSource } from '../language/parser'
import { useWorkspace } from '../composables/useWorkspace'
import { useVerification } from '../composables/useVerification'
import CodeEditor from '../components/CodeEditor.vue'
import GeometryDiagram from '../components/GeometryDiagram.vue'
import type { Locus, Step } from '../geometry/construction'
import { displayName } from '../kb/names'
import type { Namespace } from '../composables/useKB'

const ws = useWorkspace()
const contentsOpen = ref(false)

// ── colour themes (contrast checked: ink and accent ≥ 4.5:1 on paper, soft ≥ 4.5:1) ──

interface Theme { name: string; paper: string; ink: string; accent: string; soft: string }
const THEMES: Theme[] = [
  { name: 'Byrne blue', paper: '#0a3fd0', ink: '#ffffff', accent: '#ffc21a', soft: '#bfcdf3' },
  { name: 'Vermilion', paper: '#b01c12', ink: '#fff4e2', accent: '#ffe066', soft: '#f2d1c1' },
  { name: 'Ochre', paper: '#f0b400', ink: '#141210', accent: '#8a1208', soft: '#4d3c0c' },
  { name: 'Vellum', paper: '#f3ecdc', ink: '#1d1b17', accent: '#b8221a', soft: '#55514a' },
  { name: 'Night', paper: '#121419', ink: '#ece7dc', accent: '#f2b705', soft: '#b3b0a9' },
  { name: 'Verdigris', paper: '#0a4f46', ink: '#f3ecdc', accent: '#ffc845', soft: '#b6c3b5' },
]

function stored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function store(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private window etc.: not remembered */ }
}

const themeIndex = ref(Math.max(0, THEMES.findIndex(t => t.name === stored('elements.theme'))))
const shuffle = ref(stored('elements.shuffle') !== 'off')
const themeStyle = computed(() => {
  const t = THEMES[themeIndex.value]
  return { '--paper': t.paper, '--ink': t.ink, '--accent': t.accent, '--soft': t.soft }
})
function setTheme(i: number) {
  themeIndex.value = i
  store('elements.theme', THEMES[i].name)
}
function toggleShuffle() {
  shuffle.value = !shuffle.value
  store('elements.shuffle', shuffle.value ? 'on' : 'off')
}
function shuffleTheme() {
  const others = THEMES.map((_, i) => i).filter(i => i !== themeIndex.value)
  setTheme(others[Math.floor(Math.random() * others.length)])
}

// ── text over the figure: the diagram is told how wide the text column is ──

// On narrow screens the text sits above the figure instead of over it, so there is no veil.
const narrow = window.matchMedia('(max-width: 720px)')
const textRef = ref<HTMLElement | null>(null)
const veil = ref(0)
const measure = () => { veil.value = narrow.matches ? 0 : textRef.value?.offsetWidth ?? 0 }
let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (textRef.value) observer.observe(textRef.value)
  narrow.addEventListener('change', measure)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  narrow.removeEventListener('change', measure)
})

// ── source, verification, contents ──

const { verificationMarks } = useVerification(
  () => ws.text.value,
  () => ws.kb.value,
  () => ws.mode.value,
)
const marks = computed(() => verificationMarks.value)
const predicateNames = computed(() => [...new Set(ws.predicates.value.map(p => p.name))])

const headArgs = computed(() => {
  try {
    const first = parseSource(ws.text.value).find(i => i.kind === 'rule')
    return first && first.kind === 'rule' ? first.rule.head.args : []
  } catch { return [] }
})

const groups = computed(() =>
  (['core', 'euclid', 'lemmas', 'user'] as Namespace[]).map(ns => ({
    ns,
    items: ws.predicates.value.filter(p => p.namespace === ns),
  })).filter(g => g.items.length || g.ns === 'user'))

function go(fn: () => void) {
  fn()
  contentsOpen.value = false
  if (shuffle.value) shuffleTheme()
}
function addUser() {
  const name = window.prompt('Name of the new predicate')
  if (name && ws.newUserPredicate(name)) contentsOpen.value = false
}

// ── the construction, in words ──

function describeLocus(l: Locus): string {
  const n = (ps: readonly string[]) => ps.map(displayName).join('')
  switch (l.kind) {
    case 'line': return `line ${n(l.through)}`
    case 'circle': return `circle about ${displayName(l.center)} with radius ${n(l.radius)}`
    case 'bisector': return `the perpendicular bisector of ${n(l.of)}`
  }
}
function describe(s: Step): string {
  switch (s.kind) {
    case 'free': return 'anywhere'
    case 'on': return `on ${describeLocus(s.locus)}`
    case 'meet': return `where ${describeLocus(s.loci[0])} meets ${describeLocus(s.loci[1])}`
  }
}
const planSteps = computed(() =>
  (ws.construction.value?.plan.steps ?? []).map(s => ({ point: displayName(s.point), how: describe(s) })))

// Ruler and compass when a valid construction exists; otherwise the numerical solver.
const usingConstruction = computed(() => ws.usePlanner.value && !!ws.construction.value?.valid)
const failure = computed(() => usingConstruction.value ? ws.drawing.value?.failure : undefined)
const status = computed(() => {
  if (ws.usePlanner.value && ws.construction.value && !ws.construction.value.valid) {
    return 'No configuration satisfies every fact with this construction; drawn numerically instead.'
  }
  const d = ws.drawing.value
  if (!usingConstruction.value || !d) return ''
  if (d.failure) return `${displayName(d.failure.point)}: ${d.failure.reason.replace(/[a-z]#\d+/g, displayName)}`
  if (d.violations.length) return `Does not hold here: ${d.violations.map(v => v.what).join('; ')}`
  return ''
})
</script>

<style>
/* Registered so that theme changes cross-fade instead of jumping. */
@property --paper { syntax: '<color>'; inherits: true; initial-value: #0a3fd0; }
@property --ink { syntax: '<color>'; inherits: true; initial-value: #ffffff; }
@property --accent { syntax: '<color>'; inherits: true; initial-value: #ffc21a; }
@property --soft { syntax: '<color>'; inherits: true; initial-value: #bfcdf3; }
</style>

<style scoped>
.page {
  --halo: 0 0 2px var(--paper), 0 0 4px var(--paper), 0 0 7px var(--paper), 0 0 12px var(--paper);

  --ed-ink: var(--ink);
  --ed-paper: var(--paper);
  --ed-pred: var(--ink);
  --ed-arg: var(--accent);
  --ed-punct: var(--soft);
  --ed-ink-readonly: var(--ink);
  --ed-font: 'JetBrains Mono', 'Courier New', monospace;
  --ed-size: 19px;
  --ed-leading: 1.7;
  --ed-pad: 0.2rem 0;
  --ed-caret: var(--accent);
  --ed-selection: color-mix(in srgb, var(--accent) 35%, transparent);
  --ed-ok: var(--ink);
  --ed-bad: var(--accent);
  --ed-pending: var(--soft);
  --ed-mark-size: 1.15em;
  --ed-gutter: 2.4rem;
  --ed-halo: var(--halo);
  --ed-height: auto;

  --dg-ink: var(--ink);
  --dg-paper: var(--paper);
  --dg-accent: var(--accent);
  --dg-soft: var(--soft);
  --dg-stroke: 3.5;
  --dg-label-size: 26px;
  --dg-font: 'Archivo Black', 'Arial Black', sans-serif;

  display: flex; flex-direction: column;
  height: 100vh; overflow: hidden;
  background: var(--paper); color: var(--ink);
  transition: --paper 0.7s ease, --ink 0.7s ease, --accent 0.7s ease, --soft 0.7s ease;
}

/* ── masthead ── */
.masthead {
  position: relative; z-index: 2;
  display: flex; align-items: stretch; gap: 1.6rem;
  height: 76px; flex: none;
  background: var(--paper);
  border-bottom: 8px solid var(--ink);
}
.wordmark {
  background: var(--ink); color: var(--paper);
  border: 0; padding: 0 2rem; cursor: pointer;
  font: 400 1.7rem 'Archivo Black', 'Arial Black', sans-serif;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.title {
  margin: 0; align-self: center; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font: 400 2rem 'Archivo Black', 'Arial Black', sans-serif;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.arg { color: var(--accent); margin-left: 0.8rem; }
.ns { align-self: center; color: var(--soft); font: 0.85rem 'JetBrains Mono', monospace; }
.masthead > .quiet { align-self: center; }

.themes { margin-left: auto; margin-right: 1.5rem; align-self: center; display: flex; align-items: center; gap: 0.45rem; }
.swatch {
  width: 22px; height: 22px; border-radius: 50%; padding: 0; cursor: pointer;
  border: 2px solid; display: grid; place-items: center;
  transition: transform 0.15s;
}
.swatch span { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.swatch:hover { transform: scale(1.15); }
.swatch.current { outline: 2px solid var(--ink); outline-offset: 3px; }
.shuffle { margin-left: 0.4rem; text-decoration-style: dotted; }
.shuffle.on { color: var(--ink); text-decoration-style: solid; }

/* ── stage: the figure fills it, the text floats over its left side ── */
.stage { position: relative; flex: 1; min-height: 0; }
.figure { position: absolute; inset: 0; }

.text {
  position: absolute; z-index: 1; top: 0; bottom: 0; left: 0;
  width: clamp(320px, 38vw, 640px);
  display: flex; flex-direction: column;
  padding: 2rem 1rem 1.5rem 2.5rem;
  pointer-events: none;   /* only the text itself takes the mouse; the gaps belong to the figure */
}
.editor { flex: 0 1 auto; min-height: 0; display: flex; flex-direction: column; pointer-events: auto; }
.steps {
  pointer-events: auto;
  margin: auto 0 0; padding: 1rem 0 0; list-style: none; flex: none; max-height: 30%; overflow: auto;
  scrollbar-width: thin; scrollbar-color: var(--soft) transparent;
  border-top: 2px solid var(--soft);
  font: 0.9rem/1.7 'JetBrains Mono', monospace; color: var(--soft);
  text-shadow: var(--halo);
}
.steps b { color: var(--accent); font-weight: 600; margin-right: 0.5rem; }
.steps li.failed { color: var(--ink); text-decoration: underline wavy var(--accent); }

.foot {
  position: absolute; z-index: 1; left: calc(var(--veil) + 1.5rem); right: 1.5rem; bottom: 0.8rem;
  display: flex; align-items: flex-end; gap: 1.5rem;
  pointer-events: none;
}
.foot > * { pointer-events: auto; }
.status {
  flex: 1; margin: 0; min-height: 1em;
  font: 0.85rem/1.4 'JetBrains Mono', monospace; color: var(--ink);
  text-shadow: var(--halo);
}
.empty { color: var(--soft); font-family: 'JetBrains Mono', monospace; padding-left: var(--veil); }

.quiet {
  background: none; border: 0; color: var(--soft); cursor: pointer; white-space: nowrap;
  font: 0.8rem 'JetBrains Mono', monospace; text-decoration: underline; text-underline-offset: 3px;
}
.quiet:hover { color: var(--ink); }

/* ── contents ── */
.contents {
  position: fixed; inset: 84px 0 0 0; background: var(--paper); overflow: auto; z-index: 5;
}
.contents-inner { padding: 2rem 2.5rem 4rem; max-width: 1200px; display: flex; flex-wrap: wrap; gap: 1rem 4rem; align-items: flex-start; }
.group h2 {
  margin: 0 0 0.6rem; font: 400 0.8rem 'JetBrains Mono', monospace;
  letter-spacing: 0.15em; text-transform: uppercase; color: var(--soft);
}
.entry {
  display: block; background: none; border: 0; padding: 0.1rem 0; cursor: pointer; color: var(--ink);
  font: 400 1.5rem 'Archivo Black', 'Arial Black', sans-serif; text-transform: uppercase; letter-spacing: 0.03em; text-align: left;
}
.entry sup { font: 0.7rem 'JetBrains Mono', monospace; color: var(--soft); margin-left: 0.3rem; }
.entry:hover, .entry.current { color: var(--accent); }
.entry.scratch { flex-basis: 100%; font-size: 2.2rem; margin-bottom: 1rem; }
.entry.add { font: 0.95rem 'JetBrains Mono', monospace; text-transform: none; color: var(--soft); margin-top: 0.5rem; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.12s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .masthead { gap: 0.8rem; }
  .wordmark { padding: 0 1rem; font-size: 1.2rem; }
  .title { font-size: 1.3rem; }
  .ns, .shuffle { display: none; }
  .themes { margin-right: 0.8rem; gap: 0.3rem; }
  .stage { display: flex; flex-direction: column; }
  .text { order: -1; position: relative; width: 100%; max-height: 45%; flex: none; padding: 1rem; }
  .steps { max-height: 8rem; margin-top: 0.5rem; }
  .figure { position: relative; inset: auto; flex: 1; min-height: 0; }
  .foot { left: 1rem; right: 1rem; }
}
</style>
