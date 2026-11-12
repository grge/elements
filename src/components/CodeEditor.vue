<template>
  <div ref="host" class="code-editor" />
</template>

<script setup lang="ts">
/**
 * The source editor: CodeMirror, set as a page rather than as code.
 *
 * - Comments are prose: a text face, the `#` hidden except on the line the cursor is on.
 * - Names never break across lines; wrapped lines hang (comments under their first word, clause
 *   lines one indent deeper than they start).
 * - Each `?` line gets ✓, ✗ or ⊥ in the gutter, and a ✗ or ⊥ its reason underneath. A syntax error
 *   is underlined, with its message underneath; a predicate name nothing defines or uses is marked.
 * - Completion offers predicates with their arguments as fields to fill in; Enter continues a clause
 *   body or a comment, and steps out of either on an empty line.
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorState, EditorSelection, StateEffect, StateField, type Range, type Transaction } from '@codemirror/state'
import {
  EditorView, ViewPlugin, Decoration, WidgetType, gutter, GutterMarker, keymap, placeholder as cmPlaceholder,
  type DecorationSet, type ViewUpdate,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { autocompletion, snippetCompletion, type Completion, type CompletionContext } from '@codemirror/autocomplete'
import { Compartment } from '@codemirror/state'

export interface EditorMark {
  /** 0-based line of the `?`. */
  line: number
  /** 0-based last line of the lemma, if it spans several. */
  endLine?: number
  type: 'verified' | 'vacuous' | 'failed' | 'unknown'
  message: string
}

export interface EditorPredicate {
  name: string
  args: string[]
  doc?: string
}

const props = defineProps<{
  modelValue: string
  readonly?: boolean
  placeholder?: string
  marks?: EditorMark[]
  /** Predicates offered by completion. */
  predicates?: EditorPredicate[]
  /** Every predicate name the knowledge base mentions: other names are marked as unknown. */
  known?: ReadonlySet<string>
  /** Where the text fails to parse (1-based line), and why. */
  error?: { line: number; message: string } | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

const INDENT = '    '

// ── state the page pushes in ──

const setMarks = StateEffect.define<EditorMark[]>()
const marksField = StateField.define<EditorMark[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMarks)) return e.value
    return value
  },
})
const setKnown = StateEffect.define<ReadonlySet<string> | null>()
const knownField = StateField.define<ReadonlySet<string> | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setKnown)) return e.value
    return value
  },
})
const setError = StateEffect.define<{ line: number; message: string } | null>()
const errorField = StateField.define<{ line: number; message: string } | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setError)) return e.value
    return value
  },
})

// ── the verdict gutter ──

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

// ── reasons under a line: why a ? line fails, or where the text does not parse ──

class ReasonWidget extends WidgetType {
  constructor(readonly text: string, readonly kind: string, readonly indent: number) { super() }
  eq(o: ReasonWidget) { return o.text === this.text && o.kind === this.kind && o.indent === this.indent }
  toDOM() {
    const el = document.createElement('div')
    el.className = `cm-reason ${this.kind}`
    el.style.paddingLeft = `calc(${this.indent}ch + 0.25rem)`
    el.textContent = this.text
    return el
  }
  ignoreEvent() { return false }
}

function reasons(state: EditorState): DecorationSet {
  const out: Range<Decoration>[] = []
  const doc = state.doc
  const lineOf = (i: number) => doc.line(Math.min(doc.lines, Math.max(1, i)))
  const indentOf = (text: string) => /^\s*/.exec(text)![0].length
  for (const m of state.field(marksField)) {
    if (m.type !== 'failed' && m.type !== 'vacuous') continue
    if (m.line + 1 > doc.lines) continue
    const start = lineOf(m.line + 1), end = lineOf((m.endLine ?? m.line) + 1)
    out.push(Decoration.widget({ widget: new ReasonWidget(m.message, m.type, indentOf(start.text) + 2), block: true, side: 1 }).range(end.to))
  }
  const err = state.field(errorField)
  if (err && err.line <= doc.lines) {
    const line = lineOf(err.line)
    if (line.text.trim()) out.push(Decoration.mark({ class: 'tok-error' }).range(line.from + indentOf(line.text), line.to))
    out.push(Decoration.widget({ widget: new ReasonWidget(err.message, 'error', indentOf(line.text)), block: true, side: 1 }).range(line.to))
  }
  return Decoration.set(out, true)
}

const reasonsField = StateField.define<DecorationSet>({
  create: reasons,
  update(value, tr: Transaction) {
    const changed = tr.docChanged || tr.effects.some(e => e.is(setMarks) || e.is(setError))
    return changed ? reasons(tr.state) : value
  },
  provide: f => EditorView.decorations.from(f),
})

// ── the page's typography: tokens, prose comments, hanging indents ──

const NAME = /[A-Za-z0-9_][A-Za-z0-9_-]*/y
const deco = {
  pred: Decoration.mark({ class: 'tok-pred tok-nowrap' }),
  arg: Decoration.mark({ class: 'tok-arg tok-nowrap' }),
  punct: Decoration.mark({ class: 'tok-punct' }),
  prose: Decoration.mark({ class: 'tok-prose' }),
  hash: Decoration.mark({ class: 'tok-hash' }),
  word: Decoration.mark({ class: 'tok-nowrap' }),
  hidden: Decoration.replace({}),
}
const unknownMark = (name: string) =>
  Decoration.mark({ class: 'tok-pred tok-nowrap tok-unknown', attributes: { title: `nothing defines or uses ${name}` } })

interface Token { from: number; to: number; text: string; pred: boolean }

/** Names and punctuation of a line's code part (before any comment); offsets within the line. */
function tokens(code: string): Token[] {
  const out: Token[] = []
  let expectPred = true
  for (let i = 0; i < code.length;) {
    const ch = code[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    NAME.lastIndex = i
    const m = NAME.exec(code)
    if (m) {
      out.push({ from: i, to: i + m[0].length, text: m[0], pred: expectPred })
      expectPred = false
      i += m[0].length
    } else {
      if (ch === ',' || ch === ':') expectPred = true
      out.push({ from: i, to: i + 1, text: ch, pred: false })
      i++
    }
  }
  return out
}

function typography(view: EditorView): DecorationSet {
  const { state } = view
  const doc = state.doc
  const known = state.field(knownField)
  // The `#` shows on the cursor's line, and only while the editor has focus.
  const cursorLines = new Set(view.hasFocus ? state.selection.ranges.map(r => doc.lineAt(r.head).number) : [])

  // Names the page itself defines, and how often each predicate name appears on it.
  const heads = new Set<string>(), uses = new Map<string, number>()
  const lines: { from: number; text: string; code: string; hash: number }[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const hash = line.text.indexOf('#')
    const code = hash >= 0 ? line.text.slice(0, hash) : line.text
    lines.push({ from: line.from, text: line.text, code, hash })
    const toks = tokens(code)
    toks.forEach((t, i) => {
      if (!t.pred) return
      uses.set(t.text, (uses.get(t.text) ?? 0) + 1)
      const head = !/^\s*\?/.test(code) && i === 0
      if (head && toks.some(u => u.text === ':')) heads.add(t.text)
    })
  }
  const isUnknown = (name: string) =>
    !!known && !known.has(name) && !heads.has(name) && (uses.get(name) ?? 0) === 1

  const out: Range<Decoration>[] = []
  lines.forEach(({ from, text, code, hash }, i) => {
    const indent = /^\s*/.exec(text)![0].length
    const commentOnly = hash >= 0 && !code.trim()
    const showHash = !commentOnly || cursorLines.has(i + 1)

    // Hanging indent: continuation lines start under a comment's first word, or one indent
    // deeper than a clause line.
    const hang = commentOnly ? indent + (showHash ? 2 : 0) : indent + INDENT.length
    if (text.trim()) {
      out.push(Decoration.line({
        class: commentOnly ? 'cm-prose-line' : undefined,
        attributes: { style: `padding-left: calc(${hang}ch + 0.25rem); text-indent: -${hang}ch` },
      }).range(from))
    }

    for (const t of tokens(code)) {
      // A name still being typed is not marked: the cursor is at its end.
      const typing = view.hasFocus && state.selection.ranges.some(r => r.empty && r.head === from + t.to)
      const d = /^[A-Za-z0-9_]/.test(t.text)
        ? (t.pred ? (isUnknown(t.text) && !typing ? unknownMark(t.text) : deco.pred) : deco.arg)
        : deco.punct
      out.push(d.range(from + t.from, from + t.to))
    }

    if (hash >= 0) {
      const start = from + hash
      const afterHash = text[hash + 1] === ' ' ? hash + 2 : hash + 1
      if (showHash) out.push(deco.hash.range(start, from + afterHash))
      else out.push(deco.hidden.range(start, from + afterHash))
      if (afterHash < text.length) {
        out.push(deco.prose.range(from + afterHash, from + text.length))
        // Hyphenated words (a-c-b-d, eq-triangle) do not break across lines.
        for (const m of text.slice(afterHash).matchAll(/[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)+/g)) {
          out.push(deco.word.range(from + afterHash + m.index!, from + afterHash + m.index! + m[0].length))
        }
      }
    }
  })
  return Decoration.set(out, true)
}

const typesetter = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(v: EditorView) { this.decorations = typography(v) }
  update(u: ViewUpdate) {
    const knownChanged = u.startState.field(knownField) !== u.state.field(knownField)
    if (u.docChanged || u.selectionSet || u.focusChanged || knownChanged) this.decorations = typography(u.view)
  }
}, { decorations: v => v.decorations })

// ── keys: Enter continues a body or a comment, Tab indents ──

function insertAt(view: EditorView, from: number, to: number, insert: string): boolean {
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
    scrollIntoView: true,
    userEvent: 'input',
  })
  return true
}

function enter(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty || state.readOnly) return false
  const line = state.doc.lineAt(sel.head)
  const before = line.text.slice(0, sel.head - line.from)
  const indent = /^\s*/.exec(line.text)![0]
  const atEnd = sel.head === line.to

  if (/^\s*#/.test(line.text)) {
    // An empty comment line ends the comment; otherwise the comment goes on.
    if (atEnd && /^\s*#\s*$/.test(line.text)) return insertAt(view, line.from, line.to, indent)
    return insertAt(view, sel.head, sel.head, `\n${indent}# `)
  }
  if (atEnd && !line.text.trim() && indent.length > 0) {
    // An empty indented line steps out of the body.
    return insertAt(view, line.from, line.to, indent.slice(0, Math.max(0, indent.length - INDENT.length)))
  }
  if (/\S\s*:\s*$/.test(before)) return insertAt(view, sel.head, sel.head, `\n${indent}${INDENT}`)
  return insertAt(view, sel.head, sel.head, `\n${indent}`)
}

function shiftLines(view: EditorView, by: 1 | -1): boolean {
  const { state } = view
  if (state.readOnly) return false
  const seen = new Set<number>()
  const changes: { from: number; to?: number; insert?: string }[] = []
  for (const r of state.selection.ranges) {
    for (let pos = r.from; pos <= r.to;) {
      const line = state.doc.lineAt(pos)
      if (!seen.has(line.number)) {
        seen.add(line.number)
        if (by > 0) changes.push({ from: line.from, insert: INDENT })
        else {
          const n = Math.min(INDENT.length, /^ */.exec(line.text)![0].length)
          if (n) changes.push({ from: line.from, to: line.from + n })
        }
      }
      pos = line.to + 1
    }
  }
  if (changes.length) view.dispatch({ changes, userEvent: by > 0 ? 'input.indent' : 'delete.dedent' })
  return true
}

const keys = keymap.of([
  { key: 'Enter', run: enter },
  { key: 'Tab', run: v => shiftLines(v, 1) },
  { key: 'Shift-Tab', run: v => shiftLines(v, -1) },
])

// ── completion: a predicate with its arguments as fields ──

function complete(context: CompletionContext) {
  const word = context.matchBefore(/[A-Za-z][A-Za-z0-9_-]*/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  const line = context.state.doc.lineAt(word.from)
  const before = line.text.slice(0, word.from - line.from)
  // Only where a predicate is expected (line start, after ?, after , or :), never in a comment.
  if (before.includes('#') || !/^\s*\??\s*$|[,:]\s*$/.test(before)) return null
  const after = line.text.slice(word.to - line.from)
  const withArgs = /^\s*(,|#|$)/.test(after)
  const options: Completion[] = (props.predicates ?? []).map(p => {
    const c: Completion = { label: p.name, detail: p.args.join(' '), info: p.doc, type: 'function' }
    return withArgs && p.args.length
      ? snippetCompletion(`${p.name} ${p.args.map(a => `\${${a}}`).join(' ')}`, c)
      : c
  })
  return { from: word.from, options, validFor: /^[A-Za-z0-9_-]*$/ }
}

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
  '.tok-nowrap': { whiteSpace: 'nowrap' },
  '.cm-prose-line': { lineHeight: 'var(--ed-prose-leading, 1.45)' },
  '.tok-pred': { color: 'var(--ed-pred, var(--ed-ink, #c8c8e8))', fontWeight: '600' },
  '.tok-arg': { color: 'var(--ed-arg, var(--ed-ink, #c8c8e8))' },
  '.tok-punct': { color: 'var(--ed-punct, #888)' },
  '.tok-hash': { color: 'var(--ed-punct, #888)' },
  '.tok-prose': {
    fontFamily: "var(--ed-prose-font, serif)",
    fontSize: 'var(--ed-prose-size, 1em)',
    // Match the monospace's x-height, so the prose does not look shrunk beside the clauses.
    fontSizeAdjust: 'var(--ed-prose-adjust, 0.5)',
    color: 'var(--ed-prose, var(--ed-ink, #c8c8e8))',
  },
  '.tok-unknown': {
    textDecorationLine: 'underline', textDecorationStyle: 'dotted',
    textDecorationColor: 'var(--ed-bad, #e88e8e)', textDecorationThickness: '2px', textUnderlineOffset: '0.25em',
  },
  '.tok-error': {
    textDecorationLine: 'underline', textDecorationStyle: 'wavy',
    textDecorationColor: 'var(--ed-bad, #e88e8e)', textUnderlineOffset: '0.3em',
  },
  '.cm-reason': {
    fontSize: '0.72em', lineHeight: '1.5', padding: '0 0 0.35rem', textShadow: 'var(--ed-halo, none)',
    color: 'var(--ed-pending, #888)',
  },
  '.cm-reason.failed, .cm-reason.error': { color: 'var(--ed-bad, #e88e8e)' },
  '.cm-placeholder': { color: 'var(--ed-punct, #888)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--ed-ink, #fff)', color: 'var(--ed-paper, #000)', border: 'none',
    fontFamily: 'var(--ed-font, monospace)', textShadow: 'none',
  },
  '.cm-tooltip-autocomplete': { fontSize: 'calc(var(--ed-size, 13px) * 0.85)' },
  '.cm-tooltip-autocomplete ul li': { padding: '0.2rem 0.6rem' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--ed-caret, #f40)', color: 'var(--ed-paper, #000)',
  },
  '.cm-completionDetail': { fontStyle: 'normal', opacity: '0.7', marginLeft: '0.8em' },
  '.cm-completionInfo': {
    fontFamily: 'var(--ed-prose-font, serif)', fontSize: 'calc(var(--ed-size, 13px) * 0.8)', fontSizeAdjust: 'var(--ed-prose-adjust, 0.5)',
    maxWidth: '24rem', padding: '0.5rem 0.7rem', lineHeight: '1.4',
  },
  '.cm-snippetField': { backgroundColor: 'var(--ed-selection, rgba(255,255,255,0.25))' },
})

const editable = new Compartment()
const placeholderComp = new Compartment()

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        keys,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        marksField, knownField, errorField, reasonsField,
        markGutter, typesetter, theme,
        EditorView.lineWrapping,
        autocompletion({ override: [complete], icons: false }),
        editable.of([EditorView.editable.of(!props.readonly), EditorState.readOnly.of(!!props.readonly)]),
        placeholderComp.of(cmPlaceholder(props.placeholder ?? '')),
        EditorView.updateListener.of(u => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
  view.dispatch({ effects: [setMarks.of(props.marks ?? []), setKnown.of(props.known ?? null), setError.of(props.error ?? null)] })
})

onBeforeUnmount(() => view?.destroy())

watch(() => props.modelValue, v => {
  if (view && v !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }
})
watch(() => props.marks, m => view?.dispatch({ effects: setMarks.of(m ?? []) }), { deep: true })
watch(() => props.known, k => view?.dispatch({ effects: setKnown.of(k ?? null) }))
watch(() => props.error, e => view?.dispatch({ effects: setError.of(e ?? null) }))
watch(() => props.readonly, ro => view?.dispatch({
  effects: editable.reconfigure([EditorView.editable.of(!ro), EditorState.readOnly.of(!!ro)]),
}))

defineExpose({ focus: () => view?.focus() })
</script>

<style scoped>
.code-editor { height: var(--ed-height, 100%); max-height: 100%; overflow: hidden; display: flex; flex-direction: column; }
</style>

<style>
@keyframes cm-pulse { 0%, 100% { opacity: 0.35 } 50% { opacity: 1 } }
</style>
