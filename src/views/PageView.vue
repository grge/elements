<template>
  <div class="page" :class="{ short }" :style="[themeStyle, heightStyle]" @keydown.esc="contentsOpen = false; settingsOpen = false">
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
      <span v-if="ws.mode.value === 'predicate'" class="ns">{{ namespaceLabel }}</span>
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
      <button
        class="quiet settings-toggle" :class="{ on: settingsOpen }" :aria-expanded="settingsOpen"
        title="Working settings: choices the design has not settled"
        @click="settingsOpen = !settingsOpen"
      >settings</button>
      <!-- Phones: one dot, the current theme, that steps to the next. -->
      <button
        class="swatch cycle"
        :style="{ background: THEMES[themeIndex].paper, color: THEMES[themeIndex].accent, borderColor: THEMES[themeIndex].ink }"
        :title="`${THEMES[themeIndex].name}: tap for the next theme`"
        :aria-label="`Colour theme ${THEMES[themeIndex].name}; next theme`"
        @click="setTheme((themeIndex + 1) % THEMES.length)"
      ><span /></button>
    </header>

    <template v-if="settingsOpen">
      <div class="settings-backdrop" @click="settingsOpen = false" />
      <section class="settings" role="dialog" aria-label="Settings">
        <header class="settings-head">
          <h2>Settings</h2>
          <button class="quiet" @click="settingsOpen = false">close</button>
        </header>
        <p class="settings-note">Choices still being settled. Remembered in this browser.</p>
        <div v-for="c in SETTING_CHOICES" :key="c.key" class="setting">
          <div class="setting-label">{{ c.label }}</div>
          <div class="setting-options" role="radiogroup" :aria-label="c.label">
            <button
              v-for="o in c.options" :key="String(o.value)" role="radio"
              :class="{ current: settings[c.key] === o.value }" :aria-checked="settings[c.key] === o.value"
              @click="settings[c.key] = o.value"
            >{{ o.label }}</button>
          </div>
          <p class="setting-help">{{ c.help }}</p>
        </div>
      </section>
    </template>

    <main class="stage" :style="{ '--veil': `${veil}px` }">
      <GeometryDiagram
        class="figure"
        :figure="ws.figure.value"
        :construction="ws.construction.value"
        :use-planner="usingConstruction"
        :solution="ws.solution.value"
        :veil="veil"
        :floor="noticeFloor"
        :padding="48"
        :focus="figureFocus"
        :touch="stepHover"
        @update:construction="ws.setConstruction"
        @hover-point="p => (pointHover = p)"
        @hover-element="e => (elementHover = e)"
      >
        <template #empty><span class="empty">nothing to draw yet</span></template>
      </GeometryDiagram>

      <section ref="textRef" class="text">
        <div class="editor">
          <CodeEditor
            v-model="ws.text.value"
            :readonly="ws.readOnly.value"
            :marks="marks"
            :predicates="completions"
            :known="knownNames"
            :error="ws.parseError.value"
            :highlight="codeHighlight"
            :highlight-lines="sourceLines"
            placeholder="circle a b c"
            @hover="h => (editorHover = h)"
            @open="openByName"
          />
        </div>
        <ol v-if="planSteps.length" class="steps">
          <li
            v-for="(s, i) in planSteps" :key="i"
            :class="{ failed: failure?.step === i, touched: stepHover === s.name, solved: s.solved }"
            @pointerenter="stepHover = s.name" @pointerleave="stepHover = null"
          ><PointKey :name="s.name" :kind="s.kind" /><b>{{ s.point }}</b><span>{{ s.how }}<template v-if="s.solved">, then found by solving</template></span></li>
          <li
            v-for="(u, i) in unconstructedFacts" :key="`u${i}`" class="unconstructed" :class="{ touched: factHover === i, unmet: !u.holds }"
            @pointerenter="factHover = i" @pointerleave="factHover = null"
          >{{ u.text }}</li>
        </ol>
      </section>

      <footer class="foot">
        <!-- How the figure was drawn, when that needs saying: a plate, set like the masthead. -->
        <div v-if="notice && !elementInfo?.text" ref="noticeEl" class="notice" :class="notice.level" role="status">
          <span class="notice-tag"><span v-if="notice.level === 'solved'" class="notice-star" aria-hidden="true">✱</span>{{ notice.tag }}</span>
          <span class="notice-body">{{ notice.text }}</span>
        </div>
        <p v-if="status || !notice || elementInfo?.text" class="status">{{ status }}</p>
      </footer>
    </main>

    <transition name="fade">
      <nav v-if="contentsOpen" class="contents" @click.self="contentsOpen = false">
        <div class="contents-inner" :class="{ wide: browse === 'graph' }">
          <div class="contents-head">
            <button class="entry scratch" @click="go(() => ws.openScratchpad())">Scratch</button>
            <div class="views" role="radiogroup" aria-label="Browse by">
              <button role="radio" :class="{ current: browse === 'chapters' }" :aria-checked="browse === 'chapters'" @click="setBrowse('chapters')">chapters</button>
              <button role="radio" :class="{ current: browse === 'index' }" :aria-checked="browse === 'index'" @click="setBrowse('index')">index</button>
              <button role="radio" :class="{ current: browse === 'graph' }" :aria-checked="browse === 'graph'" @click="setBrowse('graph')">graph</button>
            </div>
          </div>
          <WordIndex
            v-if="browse === 'index'"
            :rows="indexRows" :thumbnail="name => thumbnails.get(name)"
            :current="ws.mode.value === 'predicate' ? ws.selectedPred.value : undefined"
            @open="(name, ns) => go(() => ws.openPredicate(name, ns))"
          />
          <WordGraph
            v-else-if="browse === 'graph'"
            :rows="indexRows" :lanes="graphLanes" :thumbnail="name => thumbnails.get(name)"
            :current="ws.mode.value === 'predicate' ? ws.selectedPred.value : undefined"
            @open="(name, ns) => go(() => ws.openPredicate(name, ns))"
          />
          <template v-else>
          <div class="chapters" role="tablist" aria-label="Chapters">
            <button
              v-for="g in groups" :key="g.ns" role="tab" class="chapter-tab"
              :class="{ current: g.ns === shownGroup?.ns }" :aria-selected="g.ns === shownGroup?.ns"
              @click="shownChapter = g.ns"
            >{{ g.title }}</button>
          </div>
          <div v-if="shownGroup" class="cards">
            <button
              v-for="p in shownGroup.items" :key="p.name" class="card"
              :class="{ current: ws.selectedPred.value === p.name && ws.selectedNamespace.value === shownGroup.ns }"
              @click="go(() => ws.openPredicate(p.name, shownGroup!.ns))"
            >
              <FigureThumb :thumbnail="thumbnails.get(p.name)" :fallback="p.args.join(' ')" />
              <span class="card-name">{{ p.name }}</span>
              <span class="card-args">{{ p.args.join(' ') }}</span>
            </button>
            <button v-if="shownGroup.ns === 'user'" class="card add" @click="addUser">+ new predicate</button>
          </div>
          </template>
        </div>
      </nav>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { settings, SETTING_CHOICES } from '../composables/useSettings'
import type { Lemma } from '../language/parser'
import { RELATIONS } from '../geometry/relations'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useWorkspace } from '../composables/useWorkspace'
import { useVerification } from '../composables/useVerification'
import CodeEditor, { type EditorHover } from '../components/CodeEditor.vue'
import PointKey from '../components/PointKey.vue'
import { extract } from '../geometry/extraction'
import { provenance, type ElementRef } from '../geometry/provenance'
import type { GroundPredicate } from '../kb/inference'
import GeometryDiagram from '../components/GeometryDiagram.vue'
import FigureThumb from '../components/FigureThumb.vue'
import WordIndex, { type IndexRow } from '../components/WordIndex.vue'
import WordGraph from '../components/WordGraph.vue'
import { vocabulary } from '../geometry/vocabulary'
import { useThumbnails } from '../composables/useThumbnails'
import { describeFact, describeLocus, type Step } from '../geometry/construction'
import { displayName } from '../kb/names'
import type { Namespace } from '../composables/useKB'

const ws = useWorkspace()
const contentsOpen = ref(false)
const settingsOpen = ref(false)

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
// The notice plate over the figure's foot: the figure keeps its points above it.
const noticeEl = ref<HTMLElement | null>(null)
const noticeFloor = ref(0)
const measure = () => { veil.value = narrow.matches ? 0 : textRef.value?.offsetWidth ?? 0 }
let observer: ResizeObserver | null = null
// ── the page's height: what is actually visible, so it shrinks when a phone's keyboard opens ──

// 100vh ignores the on-screen keyboard (and on iPhone, Safari's toolbars), which hid the editor
// while typing. The visual viewport is what's left; while pinch-zoomed, keep the last height.
const visibleHeight = ref<number | null>(null)
const vv = window.visualViewport
function onViewport() {
  if (!vv || Math.abs(vv.scale - 1) > 0.01) return
  visibleHeight.value = Math.round(vv.height)
  if (window.scrollY) window.scrollTo(0, 0)
}
const heightStyle = computed(() => visibleHeight.value ? { height: `${visibleHeight.value}px` } : {})
/** Little height to spare (a phone with its keyboard up): the text takes priority over the steps. */
const short = computed(() => (visibleHeight.value ?? window.innerHeight) < 520)
onMounted(() => { onViewport(); vv?.addEventListener('resize', onViewport) })
onBeforeUnmount(() => vv?.removeEventListener('resize', onViewport))

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

const { verificationMarks } = useVerification(() => ws.text.value, () => ws.kb.value)
const marks = computed(() => verificationMarks.value)
// A lemma that checks lends its marks to the figure.
watch(verificationMarks, ms => ws.setVerified(ms.filter(m => m.type === 'verified').map(m => m.line)), { immediate: true })
// Completion offers each predicate once, with its arguments and the start of its doc comment.
const completions = computed(() => {
  const seen = new Map<string, { name: string; args: string[]; doc?: string }>()
  for (const p of ws.predicates.value) if (!seen.has(p.name)) seen.set(p.name, { name: p.name, args: p.args, doc: p.doc })
  return [...seen.values()]
})
// Every name the knowledge base mentions; the editor marks a name outside it that the page uses once.
const knownNames = computed(() => new Set(ws.kb.value.allRules().flatMap(r => [r.head.name, ...r.body.map(b => b.name)])))

// The predicate's signature, as the contents show it (its definition's argument names).
const headArgs = computed(() => ws.signature.value ?? [])

// The book's chapters in order, then the user's own predicates.
const groups = computed(() => [
  ...ws.chapters.map(c => ({ ns: c.id as Namespace, title: c.title, items: ws.predicates.value.filter(p => p.namespace === c.id) })),
  { ns: 'user' as Namespace, title: 'Your predicates', items: ws.predicates.value.filter(p => p.namespace === 'user') },
])
// The contents show one chapter at a time, as cards with a thumbnail of each figure.
const shownChapter = ref<Namespace>('')
const shownGroup = computed(() => groups.value.find(g => g.ns === shownChapter.value) ?? groups.value[0])
const { thumbnails, request } = useThumbnails()
watch(contentsOpen, open => {
  if (!open) return
  const here = ws.mode.value === 'predicate' ? ws.selectedNamespace.value : ''
  shownChapter.value = groups.value.some(g => g.ns === here) ? here : groups.value[0].ns
})
// Or as an index: every word the knowledge base knows, with what it can do (vocabulary.ts); or as the
// graph of what each word's definition rests on, in lanes by chapter.
type Browse = 'chapters' | 'index' | 'graph'
const savedBrowse = stored('elements.browse')
const browse = ref<Browse>(savedBrowse === 'index' || savedBrowse === 'graph' ? savedBrowse : 'chapters')
const graphLanes = computed<[string, string][]>(() => [...ws.chapters.map(c => [c.id, c.title] as [string, string]), ['user', 'Your predicates']])
function setBrowse(b: Browse) {
  browse.value = b
  store('elements.browse', b)
}
const indexRows = computed<IndexRow[]>(() => {
  const preds = ws.predicates.value
  const title = new Map<string, string>([...ws.chapters.map(c => [c.id, c.title] as [string, string]), ['user', 'Your predicates']])
  return vocabulary(ws.kb.value).map(w => {
    const i = preds.findIndex(p => p.name === w.name)
    const p = preds[i]
    return {
      ...w, page: p?.namespace, doc: p?.doc,
      chapter: p ? title.get(p.namespace) ?? p.namespace : w.used ? 'no clauses' : 'unused',
      rank: i >= 0 ? i : preds.length + 1,
    }
  }).sort((a, b) => a.rank - b.rank)
})
watch([contentsOpen, browse, shownGroup, () => ws.kb.value], () => {
  if (!contentsOpen.value) return
  if (browse.value !== 'chapters') request(ws.kb.value, indexRows.value.filter(r => r.page).map(r => ({ name: r.name, args: r.args })))
  else if (shownGroup.value) request(ws.kb.value, shownGroup.value.items)
})

const namespaceLabel = computed(() =>
  ws.chapters.find(c => c.id === ws.selectedNamespace.value)?.title ?? 'your predicate')

function go(fn: () => void) {
  fn()
  contentsOpen.value = false
  if (shuffle.value) shuffleTheme()
}
function addUser() {
  const name = window.prompt('Name of the new predicate')
  if (name && ws.newUserPredicate(name)) contentsOpen.value = false
}

// ── the tether between source and figure ──

const editorHover = ref<EditorHover>(null)
const pointHover = ref<string | null>(null)
/** The point of the construction step hovered in the list: the figure shows its route. */
const stepHover = ref<string | null>(null)
/** The element of the figure under the pointer: the page says where it came from. */
const elementHover = ref<ElementRef | null>(null)

/** Where a written fact is on the page (1-based): its own line, or for the page's subject, its definition. */
function lineOf(f: GroundPredicate): number | null {
  const same = (p: { name: string; args: readonly string[] }) => p.name === f.name && p.args.join(' ') === f.args.join(' ')
  for (const item of ws.items.value) {
    if (item.kind === 'goal' && same(item.pred)) return item.sourceRef?.startLine ?? null
  }
  if (ws.mode.value === 'predicate' && f.name === ws.selectedPred.value) {
    const def = ws.items.value.find(i => i.kind === 'rule' && i.rule.head.name === f.name)
    return def?.sourceRef?.startLine ?? null
  }
  return null
}

const elementInfo = computed(() => {
  const el = elementHover.value, figure = ws.figure.value, rt = ws.runtime.value
  if (!el || !figure || !rt) return null
  const written = rt.configuration.allFacts()
  const p = provenance(figure, el, written, lineOf)
  const lines = p.origins.flatMap(o => { const l = written[o] ? lineOf(written[o]) : null; return l ? [l - 1] : [] })
  return { text: p.text, lines }
})
const sourceLines = computed(() => {
  if (factHover.value !== null) {
    const line = unconstructedFacts.value[factHover.value]?.line
    return line ? [line - 1] : []
  }
  return elementInfo.value?.lines ?? []
})

/**
 * A name in the source as a point of the figure: the point itself, or, for a variable of the page's
 * construction that only its body mentions (`d` in `transfer`), the auxiliary point it became (`d₁`).
 */
function pointOf(name: string): string | null {
  const coords = ws.drawing.value?.coords
  if (!coords) return null
  return coords.has(name) ? name : coords.has(`${name}#1`) ? `${name}#1` : null
}

/** The lemma whose `?` line (or a line it continues on) is this source line, 0-based. */
function lemmaAtLine(line: number): Lemma | null {
  const parsed = ws.items.value
  for (const i of parsed) {
    if (i.kind !== 'lemma' || !i.sourceRef) continue
    if (line >= i.sourceRef.startLine - 1 && line <= (i.sourceRef.endLine ?? i.sourceRef.startLine) - 1) return i.lemma
  }
  return null
}

const lemmaKey = (l: Lemma) => JSON.stringify([l.head, l.hypotheses])

/**
 * What a lemma's line brings forward: the marks its proof put on the figure (each member it joined
 * to another, by class and member), their points, and what its claim draws (a line for `collinear`).
 */
function lemmaFocus(lemma: Lemma): { facts: GroundPredicate[]; points: string[]; marks: string[] } | null {
  const figure = ws.figure.value, rt = ws.runtime.value
  if (!figure) return null
  const key = lemmaKey(lemma)
  const marks: string[] = []
  const points = new Set<string>()
  figure.marks.forEach((cls, ci) => {
    for (const e of cls.edges) {
      if (e.source.kind !== 'proven' || lemmaKey(e.source.lemma) !== key) continue
      for (const mi of [e.from, e.to]) {
        marks.push(`${ci}:${mi}`)
        cls.members[mi].points.forEach(p => points.add(p))
      }
    }
  })
  // Its claim, read with the page's names, where its points are the figure's (a lemma about the
  // page's own construction): the marks of the blocks it says are equal, whoever proved them (a
  // lemma whose hypotheses name points the figure lacks marks nothing itself), and what it draws.
  let facts: GroundPredicate[] = []
  const args = lemma.head.args.map(a => pointOf(a))
  if (args.every(a => a !== null)) {
    figure.marks.forEach((cls, ci) => {
      if (cls.name !== lemma.head.name || args.length !== 2 * cls.k) return
      const blocks = [args.slice(0, cls.k), args.slice(cls.k)] as string[][]
      // A member is a block up to its symmetries: an angle by its vertex and its arms either way, any
      // other block by its points.
      const angle = RELATIONS.get(cls.name)?.classMark?.as === 'arcs'
      const same = (m: string[], b: string[]) => angle
        ? m[1] === b[1] && new Set([m[0], m[2], b[0], b[2]]).size === 2
        : m.length === b.length && b.every(p => m.includes(p))
      cls.members.forEach((m, mi) => {
        if (blocks.some(b => same(m.points, b))) { marks.push(`${ci}:${mi}`); m.points.forEach(p => points.add(p)) }
      })
    })
  }
  if (rt && args.every(a => a !== null)) {
    try { facts = extract(rt.kb, [{ name: lemma.head.name, args: args as string[] }]).outline } catch { facts = [] }
    args.forEach(a => points.add(a!))
  }
  return marks.length || facts.length ? { facts, points: [...points], marks } : null
}

/** What the figure brings forward: the hovered name's point, or everything the hovered atom draws. */
const figureFocus = computed(() => {
  if (stepHover.value) return { facts: [], points: [stepHover.value] }
  const u = factHover.value !== null ? unconstructedFacts.value[factHover.value] : null
  if (u) return { facts: [u.fact], points: [...u.fact.args] }
  const el = elementHover.value, figure = ws.figure.value
  if (el && figure) {
    // A mark brings forward its whole class: what made each equality in its chain.
    const cls = el.mark ? figure.marks[el.mark.mark] : null
    const facts: GroundPredicate[] = cls
      ? cls.edges.flatMap(e => e.source.kind === 'stated' ? [e.source.fact] : e.source.kind === 'proven' ? e.source.facts : [])
      : el.facts.flatMap(k => { const f = figure.sources.get(k); return f ? [f] : [] })
    return facts.length ? { facts, points: [] } : null
  }
  const h = editorHover.value
  if (!h) return null
  if (h.kind === 'name') {
    const p = pointOf(h.name)
    return p ? { facts: [], points: [p] } : null
  }
  // A `?` line, anywhere but on a point's name: what its lemma marks on the figure.
  const lemma = lemmaAtLine(h.line)
  if (lemma) return lemmaFocus(lemma)
  if (h.kind === 'line') return null
  // The page's own predicate with its signature is the whole figure: nothing to single out.
  if (ws.mode.value === 'predicate' && h.name === ws.selectedPred.value) return null
  const rt = ws.runtime.value
  if (!rt) return null
  try {
    const args = h.args.map(a => pointOf(a) ?? a)
    // Its outline: what it draws, and the constructions in it whose lemmas mark the figure.
    const facts = extract(rt.kb, [{ name: h.name, args }]).outline
    return facts.length ? { facts, points: args.filter(a => pointOf(a) !== null) } : null
  } catch { return null }
})

/**
 * The point hovered in the figure, as the name the source uses for it: the inverse of `pointOf`, so an
 * auxiliary point lights its name only where that name is it (`d₁` is `d` in `transfer`, but not in
 * `square`, whose `d` is a corner and whose `d₁` is inside its right angle).
 */
const codeHighlight = computed(() => {
  const p = pointHover.value
  if (!p) return []
  const name = p.split('#')[0]
  return pointOf(name) === p ? [name] : []
})

function openByName(name: string) {
  const entry = ws.predicates.value.find(p => p.name === name && p.namespace !== 'user')
    ?? ws.predicates.value.find(p => p.name === name)
  if (entry) go(() => ws.openPredicate(entry.name, entry.namespace))
}

// ── the construction, in words ──

function describe(s: Step): string {
  switch (s.kind) {
    case 'free': return 'anywhere'
    case 'on': return `on ${describeLocus(s.locus)}`
    case 'meet': return `where ${describeLocus(s.loci[0])} meets ${describeLocus(s.loci[1])}`
  }
}
const planSteps = computed(() =>
  (ws.construction.value?.plan.steps ?? []).map(s => ({
    name: s.point, point: displayName(s.point), how: describe(s), solved: !!ws.solution.value?.points.has(s.point),
    kind: ws.solution.value?.points.has(s.point) ? 'solved' as const
      : s.kind === 'free' ? 'free' as const : s.kind === 'on' ? 'slide' as const : 'fixed' as const,
  })))

/**
 * A solved figure: the facts its construction does not give, each with the point the solver places
 * for it and whether the solved figure meets it. A fact unfolded from a written one says which.
 */
const factHover = ref<number | null>(null)
const unconstructedFacts = computed(() => {
  const sol = ws.solution.value, rt = ws.runtime.value
  if (!sol || !rt) return []
  const written = rt.configuration.allFacts()
  return sol.facts.map(u => {
    const from = u.fact.depth > 0 && u.fact.origin !== undefined ? written[u.fact.origin] : undefined
    const fact = describeFact(u.fact) + (from ? `, from ${describeFact(from)}` : '')
    const text = u.holds
      ? `Not constructed: ${fact}. The solver places ${displayName(u.point)} so that it holds.`
      : `Not constructed: ${fact}. The solver did not find a figure where it holds.`
    return { ...u, text, line: from ? lineOf(from) : lineOf(u.fact) }
  })
})

// Ruler and compass when a valid construction exists; otherwise the numerical solver.
const usingConstruction = computed(() => !!ws.construction.value?.valid)
const failure = computed(() => usingConstruction.value ? ws.drawing.value?.failure : undefined)
// Facts the figure has no reading for (eq-point, triangle, a user's open predicate) are said, not dropped.
// While the source has an error the figure is the last good one, and so is its list: not worth saying.
const unreadNote = computed(() => {
  if (ws.parseError.value) return ''
  const names = [...new Set(ws.extraction.value.unread.map(f => f.name))]
  return names.length ? `Not drawn: ${names.join(', ')} (the figure has no reading for ${names.length > 1 ? 'them' : 'it'}).` : ''
})
/**
 * How the figure was drawn, when that needs saying: solved numerically (mild), or a figure that does
 * not meet its facts (an error: the solver failed, the construction cannot be carried out from
 * here, or a fact does not hold in this drawing).
 */
const notice = computed<{ level: 'solved' | 'error'; tag: string; text: string } | null>(() => {
  const sol = ws.solution.value
  if (sol) {
    const points = [...sol.points].map(displayName)
    const list = points.length > 1 ? `${points.slice(0, -1).join(', ')} and ${points.at(-1)}` : points[0]
    if (sol.facts.some(u => !u.holds) || (!sol.facts.length && sol.witness.energy > 1e-4)) {
      return { level: 'error', tag: 'Not met', text: 'The solver found no figure that meets every fact. This is its closest try.' }
    }
    if (!sol.facts.length) return { level: 'solved', tag: 'Solved', text: 'No configuration of this construction meets every fact, so the figure is solved numerically.' }
    return { level: 'solved', tag: 'Solved', text: `${points.length > 1 ? 'Points' : 'Point'} ${list} placed by the numerical solver.` }
  }
  const d = ws.drawing.value
  if (!usingConstruction.value || !d) return null
  if (d.failure) return { level: 'error', tag: 'Stuck', text: `${displayName(d.failure.point)}: ${d.failure.reason}` }
  if (d.violations.length) return { level: 'error', tag: 'Not met', text: `Does not hold here: ${d.violations.map(v => v.what).join('; ')}` }
  return null
})
watch(notice, async n => {
  await nextTick()
  noticeFloor.value = n && noticeEl.value ? noticeEl.value.getBoundingClientRect().height + 16 : 0
}, { immediate: true })
const status = computed(() => elementInfo.value?.text ?? unreadNote.value)
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
  /* Each face falls back to the nearest system face that keeps its role: a heavy grotesque for the
     display voice (asked for at 900, so a family without Archivo Black's single weight still shouts),
     a modern system monospace rather than Courier, a book serif (Iowan Old Style on Apple devices is
     itself a Caslon-like face). */
  --font-display: 'Archivo Black', 'Arial Black', 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'Courier New', monospace;
  --font-prose: 'Libre Caslon Text', 'Iowan Old Style', Georgia, 'Noto Serif', 'Times New Roman', serif;

  --ed-font: var(--font-mono);
  /* Byrne's edition was set in Caslon: the book's running text, beside the clauses' monospace. */
  --ed-prose-font: var(--font-prose);
  --ed-prose: var(--ink);
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
  --dg-font: var(--font-display);

  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh; overflow: hidden;
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
  font: 900 1.7rem var(--font-display);
  letter-spacing: 0.04em; text-transform: uppercase;
}
.title {
  margin: 0; align-self: center; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font: 900 2rem var(--font-display);
  letter-spacing: 0.04em; text-transform: uppercase;
}
.arg { color: var(--accent); margin-left: 0.8rem; }
.ns { align-self: center; color: var(--soft); font: 0.85rem var(--font-mono); }
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
.cycle { display: none; }
.shuffle { margin-left: 0.4rem; text-decoration-style: dotted; }
.shuffle.on { color: var(--ink); text-decoration-style: solid; }
.themes { margin-right: 1rem; }
.settings-toggle { align-self: center; margin-right: 1.5rem; text-decoration-style: dotted; }
.settings-toggle.on { color: var(--ink); text-decoration-style: solid; }

/* ── settings: a card under the masthead, in the page's own colours ── */
.settings-backdrop { position: fixed; inset: 0; z-index: 6; }
.settings {
  position: fixed; z-index: 7; top: 92px; right: 1.5rem; width: min(380px, calc(100vw - 2rem));
  background: var(--paper); color: var(--ink); border: 2px solid var(--ink);
  box-shadow: 6px 6px 0 var(--ink); padding: 1rem 1.2rem 1.2rem;
}
.settings-head { display: flex; align-items: baseline; justify-content: space-between; }
.settings-head h2 { margin: 0; font: 900 1.1rem var(--font-display); letter-spacing: 0.04em; text-transform: uppercase; }
.settings-note { margin: 0.3rem 0 1rem; color: var(--soft); font: 0.75rem var(--font-mono); }
.setting + .setting { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--soft); }
.setting-label { font: 400 0.75rem var(--font-mono); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 0.5rem; }
.setting-options { display: inline-flex; border: 2px solid var(--ink); }
.setting-options button {
  background: none; border: 0; padding: 0.25rem 0.9rem; cursor: pointer; color: var(--ink);
  font: 0.85rem var(--font-mono);
}
.setting-options button + button { border-left: 2px solid var(--ink); }
.setting-options button.current { background: var(--ink); color: var(--paper); }
.setting-options button:not(.current):hover { color: var(--accent); }
.setting-help { margin: 0.6rem 0 0; font: 0.9rem/1.4 var(--font-prose); color: var(--ink); opacity: 0.8; }

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
  font: 0.9rem/1.7 var(--font-mono); color: var(--soft);
  text-shadow: var(--halo);
}
/* A key: each point's marker as the figure draws it, its name, how the construction places it. */
.steps li:not(.unconstructed) { display: flex; align-items: baseline; gap: 0.55rem; }
/* Beside the first line of its step, centred on it, however many lines the step wraps to. */
.steps .point-key { align-self: flex-start; margin-top: calc((1.7em - 18px) / 2); }
.steps b { color: var(--accent); font-weight: 600; min-width: 1.4em; }
.steps li.touched { color: var(--ink); }
.steps li.failed { color: var(--ink); text-decoration: underline wavy var(--accent); }
/* A solved figure: the steps that place a solved point, and the facts no step constructs. */
.steps li.unconstructed { color: var(--ink); margin-top: 0.4rem; }
.steps li.unconstructed.touched { color: var(--accent); }
.steps li.unmet { text-decoration: underline wavy var(--accent); }

.foot {
  position: absolute; z-index: 1; left: calc(var(--veil) + 1.5rem); right: 1.5rem; bottom: 0.8rem;
  display: flex; align-items: flex-end; gap: 1.5rem;
  pointer-events: none;
}
.foot > * { pointer-events: auto; }
.status {
  flex: 1; margin: 0; min-height: 1em;
  font: 0.85rem/1.4 var(--font-mono); color: var(--ink);
  text-shadow: var(--halo);
}
.empty { color: var(--soft); font-family: var(--font-mono); padding-left: var(--veil); }

/* The notice: a plate in the masthead's manner, a tag in the display face and the words in mono.
   Solved: the tag a block of ink, the words on paper inside a rule of ink. An error: the whole plate
   in the accent, knocked out in the paper colour, with a hard offset shadow of ink, like a sticker
   slapped on the poster. */
.notice {
  flex: none; display: flex; align-items: stretch; max-width: min(100%, 44rem);
  font: 0.85rem/1.4 var(--font-mono);
  animation: notice-in 0.22s ease-out;
}
.notice-tag {
  flex: none; display: flex; align-items: center; gap: 0.4rem;
  padding: 0.35rem 0.8rem;
  font: 900 0.95rem var(--font-display); letter-spacing: 0.06em; text-transform: uppercase;
}
.notice-body { padding: 0.45rem 0.8rem; }
.notice-star { font-family: var(--font-mono); font-weight: 400; font-size: 1.15em; line-height: 1; }

.notice.solved .notice-tag { background: var(--ink); color: var(--paper); }
.notice.solved .notice-body { background: var(--paper); color: var(--ink); box-shadow: inset 0 0 0 3px var(--ink); }

.notice.error { background: var(--accent); color: var(--paper); box-shadow: 6px 6px 0 var(--ink); transform: rotate(-0.6deg); }
.notice.error .notice-tag { font-size: 1.15rem; border-right: 3px solid var(--paper); }
.notice.error .notice-body { font-weight: 600; }

@keyframes notice-in { from { opacity: 0; translate: 0 6px; } }

.quiet {
  background: none; border: 0; color: var(--soft); cursor: pointer; white-space: nowrap;
  font: 0.8rem var(--font-mono); text-decoration: underline; text-underline-offset: 3px;
}
.quiet:hover { color: var(--ink); }

/* ── contents ── */
.contents {
  position: fixed; inset: 84px 0 0 0; background: var(--paper); overflow: auto; z-index: 5;
  scrollbar-width: thin; scrollbar-color: var(--soft) transparent;
}
.contents-inner { padding: 2rem 2.5rem 4rem; max-width: 1400px; }
.contents-inner.wide { max-width: none; }
.entry {
  display: block; background: none; border: 0; padding: 0.1rem 0; cursor: pointer; color: var(--ink);
  font: 900 1.5rem var(--font-display); text-transform: uppercase; letter-spacing: 0.03em; text-align: left;
}
.entry:hover { color: var(--accent); }
.entry.scratch { font-size: 2.2rem; margin-bottom: 1.2rem; }

.contents-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; }
.contents-head .entry.scratch { margin-bottom: 0; }
.views { display: inline-flex; border: 2px solid var(--ink); }
.views button {
  background: none; border: 0; padding: 0.25rem 0.9rem; cursor: pointer; color: var(--ink);
  font: 0.8rem var(--font-mono); letter-spacing: 0.15em; text-transform: uppercase;
}
.views button + button { border-left: 2px solid var(--ink); }
.views button.current { background: var(--ink); color: var(--paper); }
.views button:not(.current):hover { color: var(--accent); }
.chapters { display: flex; flex-wrap: wrap; gap: 0.4rem 1.6rem; margin-bottom: 1.6rem; }
.chapter-tab {
  background: none; border: 0; padding: 0 0 0.25rem; cursor: pointer; color: var(--soft);
  font: 400 0.8rem var(--font-mono); letter-spacing: 0.15em; text-transform: uppercase;
  border-bottom: 2px solid transparent;
}
.chapter-tab:hover { color: var(--ink); }
.chapter-tab.current { color: var(--ink); border-bottom-color: var(--accent); }

.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1.6rem 1.4rem; }
.card {
  --dg-ink: var(--ink); --dg-accent: var(--accent); --dg-paper: var(--paper);
  display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start;
  background: none; border: 0; padding: 0; cursor: pointer; color: var(--ink); text-align: left;
}
.card :deep(.figure-thumb) {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  margin-bottom: 0.45rem;
  transition: background 0.15s;
}
.card:hover :deep(.figure-thumb), .card.current :deep(.figure-thumb) { background: color-mix(in srgb, var(--ink) 13%, transparent); }
.card-name {
  font: 900 1rem var(--font-display); text-transform: uppercase; letter-spacing: 0.03em;
  overflow-wrap: anywhere;
}
.card:hover .card-name, .card.current .card-name { color: var(--accent); }
.card-args { font: 0.8rem var(--font-mono); color: var(--accent); letter-spacing: 0.2em; }
.card.add {
  justify-content: center; align-items: center; min-height: 8rem;
  font: 0.95rem var(--font-mono); color: var(--soft);
  border: 2px dashed color-mix(in srgb, var(--ink) 25%, transparent);
}
.card.add:hover { color: var(--ink); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.12s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 720px) {
  .masthead { gap: 0.8rem; }
  .wordmark { padding: 0 1rem; font-size: 1.2rem; }
  .title { font-size: 1.3rem; }
  .ns, .shuffle { display: none; }
  .settings-toggle { margin: 0 0 0 auto; }
  .settings { top: auto; bottom: 1rem; right: 1rem; }
  /* One theme dot instead of six, so the title has room. */
  .themes { display: none; }
  .cycle {
    display: grid; flex: none; align-self: center; margin: 0 0.9rem 0 0.8rem;
    width: 30px; height: 30px; position: relative;
  }
  .cycle span { width: 11px; height: 11px; }
  .cycle::after { content: ''; position: absolute; inset: -8px; }  /* a 46px target */
  .stage { display: flex; flex-direction: column; }
  .text { order: -1; position: relative; width: 100%; max-height: 45%; flex: none; padding: 1rem; }
  /* Phones show the source and the figure only, without the construction steps. */
  .page { --ed-size: 15px; --ed-leading: 1.6; --ed-gutter: 1.8rem; }
  .editor { min-height: 6rem; }
  .steps { display: none; }
  .short .text { max-height: 60%; padding-block: 0.6rem; }
  .figure { position: relative; inset: auto; flex: 1; min-height: 0; }
  .foot { left: 1rem; right: 1rem; }
}
</style>
