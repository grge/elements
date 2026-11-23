/**
 * Lemmas as their pages check them: the page's text (useWorkspace, from useKB's clauses) through
 * `checkPage`, which the checking worker runs. The book's tests check the chapter files; these check
 * what a reader sees, which once differed:
 * - a written proof's steps were dropped from its page, so the page checked the bare lemma (III.32
 *   showed ?);
 * - a page checked its lemmas with every rule of the book, so chapter 3's parallelogram was proved
 *   through chapter 6's similar triangles. A book lemma is now checked in the book's order
 *   (kb/bookScope.ts).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { ruleChapter, chapters } from '../src/composables/useKB'
import { showRule } from '../src/kb/rules'
import { checkPage, KeptProofs, type PageMark } from '../src/geometry/pageCheck'
import type { Proof } from '../src/kb/proof'

// The workspace's marks closure runs in a worker of its own, which is not wanted here.
;(globalThis as any).Worker ??= class { postMessage() {} terminate() {} addEventListener() {} }
let ws: ReturnType<typeof import('../src/composables/useWorkspace').useWorkspace>
beforeAll(async () => { ws = (await import('../src/composables/useWorkspace')).useWorkspace() })

/** A page as the app opens it, checked as the worker checks it. */
const checked = (name: string, ns: string) => {
  ws.openPredicate(name, ns)
  const text = ws.text.value, lineChapters = ws.clauseChapters.value
  const rules = ws.kb.value.allRules()
  const marks: PageMark[] = []
  checkPage({ text, rules, ...(lineChapters ? { ruleChapters: rules.map(r => ruleChapter(showRule(r)) ?? null), lineChapters } : {}) }, new KeptProofs(), m => marks.push(m))
  const lines = text.split('\n')
  const at = (line: string) => {
    const i = lines.findIndex(l => l.startsWith(line))
    expect(i, `no line ${line}`).toBeGreaterThanOrEqual(0)
    return marks.find(m => m.line === i)
  }
  return { text, lines, lineChapters, marks, at }
}

/** A proof's rule steps first written in a chapter after `chapter`. */
const laterSteps = (proof: Proof | undefined, chapter: number) =>
  (proof?.steps ?? []).flatMap(s => s.by.kind === 'rule' && (ruleChapter(showRule(s.by.rule)) ?? 0) > chapter ? [showRule(s.by.rule)] : [])

describe('a written proof on its page', () => {
  it('III.32 is shown with its construction step, and proves', () => {
    const { text, at } = checked('tangent-chord', '05-circle')
    expect(text).toContain('    ? double a o e            # the diameter through a, to e')
    expect(at('? eq-turn a t a b c a c b:')?.type).toBe('verified')
    expect(at('    ? double a o e')?.message).toMatch(/^constructs e/)
  })

  it("Thales' converse, written out in Beyond the book, proves on its page", () => {
    const { lines, marks } = checked('thales-converse', 'beyond')
    const step = lines.indexOf('    ? double b o d')
    expect(step).toBeGreaterThan(1)
    expect(lines[step - 2]).toBe('? eq-lines o a o b:')
    expect(marks.find(m => m.line === step - 2)?.type).toBe('verified')
    expect(marks.find(m => m.line === step)?.message).toMatch(/^constructs d/)
  })
})

describe("a book lemma is checked in the book's order", () => {
  it("chapter 3's parallelogram is proved in chapter 3, not through chapter 6's similar triangles", () => {
    const { at } = checked('parallelogram', '03-direction')
    const m = at('? eq-lines a b c d: parallelogram a b c d')!
    expect(m.type).toBe('verified')
    expect(laterSteps(m.proof, 3)).toEqual([])
    expect(m.proof!.steps.every(s => s.fact.name !== 'eq-ratio')).toBe(true)
  })

  it('on every page of the book, every lemma is ✓ and rests on no later chapter', () => {
    const book = chapters.filter(c => /^\d+-/.test(c.id))
    for (const p of ws.predicates.value.filter(p => book.some(c => c.id === p.namespace))) {
      const { lines, lineChapters, marks } = checked(p.name, p.namespace)
      for (const m of marks) {
        const where = `${p.namespace} ${p.name}, line ${m.line + 1}: ${lines[m.line]}`
        expect(m.type, where).toBe('verified')
        expect(laterSteps(m.proof, lineChapters![m.line]!), where).toEqual([])
      }
    }
  })
}, 600_000)
