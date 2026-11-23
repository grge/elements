/**
 * Lemmas as their pages check them: the page's text (useWorkspace, from useKB's clauses) through
 * `checkPage`, which the checking worker runs. The book's tests check the chapter files; these check
 * what a reader sees, which once differed:
 * - a written proof's steps were dropped from its page, so the page checked the bare lemma (III.32
 *   showed ?);
 * - a page checked its lemmas with every rule of the book, and one search, so chapter 3's parallelogram
 *   was proved through chapter 6's similar triangles. It is still checked with every rule, as the
 *   book's tests check it, but in strata (kb/modules.ts): the modules its words need first.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { chapters } from '../src/composables/useKB'
import { checkPage, KeptProofs, type PageMark } from '../src/geometry/pageCheck'

// The workspace's marks closure runs in a worker of its own, which is not wanted here.
;(globalThis as any).Worker ??= class { postMessage() {} terminate() {} addEventListener() {} }
let ws: ReturnType<typeof import('../src/composables/useWorkspace').useWorkspace>
beforeAll(async () => { ws = (await import('../src/composables/useWorkspace')).useWorkspace() })

/** A page as the app opens it, checked as the worker checks it. */
const checked = (name: string, ns: string) => {
  ws.openPredicate(name, ns)
  const text = ws.text.value
  const rules = ws.kb.value.allRules()
  const marks: PageMark[] = []
  checkPage({ text, rules }, new KeptProofs(), m => marks.push(m))
  const lines = text.split('\n')
  const at = (line: string) => {
    const i = lines.findIndex(l => l.startsWith(line))
    expect(i, `no line ${line}`).toBeGreaterThanOrEqual(0)
    return marks.find(m => m.line === i)
  }
  return { text, lines, marks, at }
}

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

describe('a book lemma on its page', () => {
  it("chapter 3's parallelogram is proved by the modules its words need, not through chapter 6's similar triangles", () => {
    const { at } = checked('parallelogram', '03-direction')
    const m = at('? eq-lines a b c d: parallelogram a b c d')!
    expect(m.type).toBe('verified')
    const modules = new Set(m.proof!.steps.flatMap(s => s.by.kind === 'rule' && s.by.rule.module ? [s.by.rule.module] : []))
    expect([...modules].every(x => ['01-length', '02-angle', '03-direction'].includes(x)), [...modules].join(', ')).toBe(true)
    expect(m.proof!.steps.every(s => s.fact.name !== 'eq-ratio')).toBe(true)
  })

  it('on every page of the book, every lemma is ✓', () => {
    const book = chapters.filter(c => /^\d+-/.test(c.id))
    for (const p of ws.predicates.value.filter(p => book.some(c => c.id === p.namespace))) {
      const { lines, marks } = checked(p.name, p.namespace)
      for (const m of marks) expect(m.type, `${p.namespace} ${p.name}, line ${m.line + 1}: ${lines[m.line]}`).toBe('verified')
    }
  })
}, 600_000)
