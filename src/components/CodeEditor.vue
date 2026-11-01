<template>
  <div ref="host" class="code-editor" />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorState, StateEffect, StateField, Compartment, RangeSetBuilder } from '@codemirror/state'
import {
  EditorView, ViewPlugin, Decoration, gutter, GutterMarker, keymap, placeholder as cmPlaceholder,
  type DecorationSet, type ViewUpdate,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'

export interface EditorMark {
  /** 0-based line index. */
  line: number
  type: 'verified' | 'vacuous' | 'failed' | 'unknown'
  message: string
}

const props = defineProps<{
  modelValue: string
  readonly?: boolean
  placeholder?: string
  marks?: EditorMark[]
  /** Predicate names offered by completion. */
  predicates?: string[]
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

// ── verification marks, rendered by a real CodeMirror gutter so they track their lines ──

const setMarks = StateEffect.define<EditorMark[]>()
const marksField = StateField.define<EditorMark[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) return e.value
    return value
  },
})

class MarkMarker extends GutterMarker {
  constructor(readonly mark: EditorMark) { super() }
  eq(other: MarkMarker) { return other.mark.type === this.mark.type && other.mark.message === this.mark.message }
  toDOM() {
    const el = document.createElement('span')
    el.className = `mark ${this.mark.type}`
    el.title = this.mark.message
    el.textContent = { verified: '✓', vacuous: '⊥', failed: '✗', unknown: '…' }[this.mark.type]
    return el
  }
}

const markGutter = gutter({
  class: 'cm-marks',
  lineMarker(v, line) {
    const idx = v.state.doc.lineAt(line.from).number - 1
    const mark = v.state.field(marksField).find(m => m.line === idx)
    return mark ? new MarkMarker(mark) : null
  },
  lineMarkerChange: update => update.startState.field(marksField) !== update.state.field(marksField),
  initialSpacer: () => new MarkMarker({ line: -1, type: 'verified', message: '' }),
})

// ── syntax highlighting: predicate heads vs. variables, punctuation, comments ──

const deco = {
  pred: Decoration.mark({ class: 'tok-pred' }),
  arg: Decoration.mark({ class: 'tok-arg' }),
  punct: Decoration.mark({ class: 'tok-punct' }),
  comment: Decoration.mark({ class: 'tok-comment' }),
}

function highlight(state: EditorState): DecorationSet {
  const b = new RangeSetBuilder<Decoration>()
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n)
    const hash = line.text.indexOf('#')
    const code = hash >= 0 ? line.text.slice(0, hash) : line.text
    const re = /[A-Za-z][A-Za-z0-9_-]*|[?:,-]/g
    let expectPred = true
    let m: RegExpExecArray | null
    while ((m = re.exec(code))) {
      const from = line.from + m.index, to = from + m[0].length
      if (/^[A-Za-z]/.test(m[0])) {
        b.add(from, to, expectPred ? deco.pred : deco.arg)
        expectPred = false
      } else {
        if (m[0] === ',' || m[0] === ':') expectPred = true
        b.add(from, to, deco.punct)
      }
    }
    if (hash >= 0) b.add(line.from + hash, line.to, deco.comment)
  }
  return b.finish()
}

const highlighter = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(v: EditorView) { this.decorations = highlight(v.state) }
  update(u: ViewUpdate) { if (u.docChanged) this.decorations = highlight(u.state) }
}, { decorations: v => v.decorations })

// ── theme: all colour and type decisions come from CSS variables set by the page ──

const theme = EditorView.theme({
  '&': { height: 'var(--ed-height, 100%)', maxHeight: '100%', color: 'var(--ed-ink, #c8c8e8)', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--ed-punct, #888) transparent',
    fontFamily: "var(--ed-font, 'JetBrains Mono', monospace)",
    fontSize: 'var(--ed-size, 13px)',
    lineHeight: 'var(--ed-leading, 1.5)',
  },
  '.cm-content': { caretColor: 'var(--ed-caret, currentColor)', padding: 'var(--ed-pad, 0.2rem 0)' },
  '.cm-cursor': { borderLeftColor: 'var(--ed-caret, currentColor)', borderLeftWidth: '2px' },
  '.cm-line': { padding: '0 0.25rem', textShadow: 'var(--ed-halo, none)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--ed-selection, rgba(255,255,255,0.25)) !important',
  },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'inherit' },
  '.cm-marks': { minWidth: 'var(--ed-gutter, 2rem)' },
  '.cm-marks .cm-gutterElement': { textAlign: 'center' },
  '.mark': { textShadow: 'var(--ed-halo, none)', fontWeight: '700', fontSize: 'var(--ed-mark-size, 0.9em)', cursor: 'default' },
  '.mark.verified': { color: 'var(--ed-ok, #8ec88e)' },
  '.mark.vacuous': { color: 'var(--ed-pending, #888)' },
  '.mark.failed': { color: 'var(--ed-bad, #e88e8e)', fontWeight: '700' },
  '.mark.unknown': { color: 'var(--ed-pending, #888)', animation: 'cm-pulse 1s infinite ease-in-out' },
  '.tok-pred': { color: 'var(--ed-pred, var(--ed-ink, #c8c8e8))', fontWeight: '600' },
  '.tok-arg': { color: 'var(--ed-arg, var(--ed-ink, #c8c8e8))' },
  '.tok-punct': { color: 'var(--ed-punct, #888)' },
  '.tok-comment': { color: 'var(--ed-punct, #888)', fontStyle: 'italic' },
  '.cm-placeholder': { color: 'var(--ed-punct, #888)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--ed-ink, #fff)', color: 'var(--ed-paper, #000)', border: 'none',
    fontFamily: "var(--ed-font, monospace)",
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--ed-caret, #f40)', color: 'var(--ed-ink, #fff)',
  },
})

const editable = new Compartment()
const placeholderComp = new Compartment()

function complete(context: CompletionContext) {
  const word = context.matchBefore(/[A-Za-z][A-Za-z0-9_-]*/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  // Only offer predicate names where a predicate is expected: line start, or after , or :
  const before = context.state.doc.lineAt(word.from).text.slice(0, word.from - context.state.doc.lineAt(word.from).from)
  if (!/^\s*\??\s*$|[,:]\s*$/.test(before)) return null
  return {
    from: word.from,
    options: (props.predicates ?? []).map(label => ({ label, type: 'function' })),
    validFor: /^[A-Za-z0-9_-]*$/,
  }
}

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        marksField, markGutter, highlighter, theme,
        EditorView.lineWrapping,
        autocompletion({ override: [complete], icons: false }),
        editable.of(EditorView.editable.of(!props.readonly)),
        placeholderComp.of(cmPlaceholder(props.placeholder ?? '')),
        EditorView.updateListener.of(u => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
  view.dispatch({ effects: setMarks.of(props.marks ?? []) })
})

onBeforeUnmount(() => view?.destroy())

watch(() => props.modelValue, v => {
  if (view && v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})
watch(() => props.marks, m => view?.dispatch({ effects: setMarks.of(m ?? []) }), { deep: true })
watch(() => props.readonly, ro => view?.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!ro)) }))

defineExpose({ focus: () => view?.focus() })
</script>

<style scoped>
.code-editor { height: var(--ed-height, 100%); max-height: 100%; overflow: hidden; display: flex; flex-direction: column; }
</style>

<style>
@keyframes cm-pulse { 0%, 100% { opacity: 0.35 } 50% { opacity: 1 } }
</style>
