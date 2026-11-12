/** Where each element came from: the figure says what made an element, and a mark explains its chain. */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase, type GroundPredicate } from '../src/kb/inference'
import { parseSource } from '../src/language/parser'
import { buildRuntimeState } from '../src/kb/runtime'
import { extract } from '../src/geometry/extraction'
import { drawFigure } from '../src/geometry/figure'
import { provenance } from '../src/geometry/provenance'
import { bookRules, bookLemmas } from './book'

const kb = new KnowledgeBase(bookRules)

function page(text: string) {
  const items = parseSource(text)
  const rt = buildRuntimeState(kb, items)
  const written = rt.configuration.allFacts()
  const figure = drawFigure(rt.kb, extract(rt.kb, written), bookLemmas)!
  const lineOf = (f: GroundPredicate) => {
    const item = items.find(i => i.kind === 'goal' && i.pred.name === f.name && i.pred.args.join() === f.args.join())
    return item?.sourceRef?.startLine ?? null
  }
  return { figure, say: (el: Parameters<typeof provenance>[1]) => provenance(figure, el, written, lineOf) }
}

describe('provenance', () => {
  it('says which written fact a circle came from, and how deep', () => {
    const { figure, say } = page('circle o a b\neq-triangle a b c')
    const deep = figure.circles.find(c => c.depth === 1)!
    expect(say({ facts: deep.facts, mark: null })).toEqual({ text: expect.stringMatching(/^circle [ab] [ab] c, in eq-triangle a b c \(line 2\), one level down/), origins: [1] })
    const top = figure.circles.find(c => c.center === 'o')!
    expect(say({ facts: top.facts, mark: null }).text).toBe('circle o a b (line 1)')
  })

  it('explains a mark as its chain: stated and proven equalities', () => {
    const { figure, say } = page('eq-triangle a b c\neq-lines a b p q')
    const ci = figure.marks.findIndex(m => m.k === 2)
    const cls = figure.marks[ci]
    const pq = cls.members.findIndex(m => m.points.join('') === 'pq')
    const { text, origins } = say({ facts: [], mark: { mark: ci, member: pq } })
    expect(text).toMatch(/^pq = ab \(stated: eq-lines a b p q \(line 2\)\) = /)
    expect(text).toContain('(proven, of eq-triangle a b c (line 1))')
    expect(origins.sort()).toEqual([0, 1])
  })
})
