/**
 * Lemmas as their pages check them: the page's text (useWorkspace, from useKB's clauses) through the
 * checking worker, as the app runs it. The book's tests check the chapter files; these check what a
 * reader sees, which once differed:
 * - a written proof's steps were dropped from its page, so the page checked the bare lemma (III.32
 *   showed ?);
 * - a page checked its lemmas with every rule of the book, so chapter 3's parallelogram was proved
 *   through chapter 6's similar triangles. A book lemma is now checked in the book's order
 *   (kb/bookScope.ts).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ruleChapter, chapters } from '../src/composables/useKB'
import { showRule } from '../src/kb/rules'
import type { EditorMark } from '../src/components/CodeEditor.vue'

// The workspace's marks closure runs in a worker of its own, which is not wanted here.
;(globalThis as any).Worker ??= class { postMessage() {} terminate() {} addEventListener() {} }
let ws: ReturnType<typeof import('../src/composables/useWorkspace').useWorkspace>
let check: (text: string, lineChapters: readonly (number | null)[] | null) => EditorMark[]

beforeAll(async () => {
  ws = (await import('../src/composables/useWorkspace')).useWorkspace()
  const posted: any[] = []
  ;(globalThis as any).self = { postMessage: (r: any) => posted.push(r) }
  await import('../src/workers/lemmaCheckWorker')
  const onmessage = (globalThis as any).self.onmessage
  check = (text, lineChapters) => {
    posted.length = 0
    const rules = ws.kb.value.allRules()
    onmessage({ data: { requestId: 1, text, rules, ...(lineChapters ? { ruleChapters: rules.map(r => ruleChapter(showRule(r)) ?? null), lineChapters } : {}) } })
    return posted.filter(p => p.kind === 'mark').map(p => p.mark)
  }
})

const page = (name: string, ns: string) => {
  ws.openPredicate(name, ns)
  return { text: ws.text.value, lineChapters: ws.clauseChapters.value }
}
const markAt = (marks: EditorMark[], text: string, line: string) => {
  const i = text.split('\n').findIndex(l => l.startsWith(line))
  expect(i, `no line ${line}`).toBeGreaterThanOrEqual(0)
  return marks.find(m => m.line === i)
}

describe('a written proof on its page', () => {
  it('III.32 is shown with its construction step, and proves', () => {
    const { text, lineChapters } = page('tangent-chord', '05-circle')
    expect(text).toContain('    ? double a o e            # the diameter through a, to e')
    const marks = check(text, lineChapters)
    expect(markAt(marks, text, '? eq-turn a t a b c a c b:')?.type).toBe('verified')
    expect(markAt(marks, text, '    ? double a o e')?.message).toMatch(/^constructs e/)
  })

  it("Thales' converse, written out in Beyond the book, proves on its page", () => {
    const { text, lineChapters } = page('thales-converse', 'beyond')
    const lines = text.split('\n')
    const step = lines.indexOf('    ? double b o d')
    expect(step).toBeGreaterThan(1)
    expect(lines[step - 2]).toBe('? eq-lines o a o b:')
    const marks = check(text, lineChapters)
    expect(marks.find(m => m.line === step - 2)?.type).toBe('verified')
    expect(marks.find(m => m.line === step)?.message).toMatch(/^constructs d/)
  })
})

describe("a book lemma is checked in the book's order", () => {
  // Rule steps are named by their text; its chapter is where the book first writes it.
  const laterSteps = (mark: EditorMark, chapter: number) =>
    (mark.proof?.steps ?? []).concat(mark.proof?.side ?? []).filter(s => s.rule && s.why === 'rule' && (ruleChapter(s.rule) ?? 0) > chapter)

  it("chapter 3's parallelogram is proved in chapter 3, not through chapter 6's similar triangles", () => {
    const { text, lineChapters } = page('parallelogram', '03-direction')
    const marks = check(text, lineChapters)
    const m = markAt(marks, text, '? eq-lines a b c d: parallelogram a b c d')!
    expect(m.type).toBe('verified')
    expect(laterSteps(m, 3)).toEqual([])
    expect(m.proof!.steps.every(s => !s.fact.startsWith('eq-ratio'))).toBe(true)
  })

  it('on every page of the book, every lemma is ✓ and rests on no later chapter', () => {
    const book = chapters.filter(c => /^\d+-/.test(c.id))
    for (const p of ws.predicates.value.filter(p => book.some(c => c.id === p.namespace))) {
      const { text, lineChapters } = page(p.name, p.namespace)
      const marks = check(text, lineChapters)
      for (const m of marks) {
        const where = `${p.namespace} ${p.name}, line ${m.line + 1}: ${text.split('\n')[m.line]}`
        expect(m.type, where).toBe('verified')
        const chapter = lineChapters![m.line]!
        expect(laterSteps(m, chapter).map(s => s.rule), where).toEqual([])
      }
    }
  })
}, 600_000)
