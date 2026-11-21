/**
 * The vocabulary (vocabulary.ts): every word the knowledge base mentions, with where each of its
 * capabilities comes from: the relation table, its definition, or its rules.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { vocabulary } from '../src/geometry/vocabulary'
import { RELATIONS } from '../src/geometry/relations'
import { parseRules } from '../src/language/parser'
import { bookRules } from './book'

const rows = vocabulary(new KnowledgeBase(bookRules))
const row = (name: string) => rows.find(r => r.name === name)!

describe('the vocabulary', () => {
  it('has every word the book mentions, and every word of the plane', () => {
    const mentioned = new Set(bookRules.flatMap(r => [r.head.name, ...r.body.map(b => b.name)]).filter(n => n !== 'false'))
    expect(new Set(rows.map(r => r.name))).toEqual(new Set([...mentioned, ...RELATIONS.keys()]))
    expect(rows.filter(r => r.plane)).toHaveLength(RELATIONS.size)
  })

  it('says where each capability comes from', () => {
    expect(row('eq-lines')).toMatchObject({ plane: true, defined: false, constructs: { source: 'itself' }, marks: { source: 'itself', detail: ['ticks'] }, discovered: ['equivalence'] })
    expect(row('eq-point').discovered).toEqual(['the equality'])
    expect(row('distinct').convention).toBe(true)
    // right is drawn and measured itself, but the planner reads its definition
    expect(row('right')).toMatchObject({ defined: true, draws: { source: 'itself' }, measured: { source: 'itself' } })
    expect(row('right').constructs).toMatchObject({ source: 'definition' })
    expect(row('right').constructs.detail).toContain('eq-angle')
    // a vesica has nothing of its own: it is drawn as circles, the planner reads equal lengths
    expect(row('vesica')).toMatchObject({ plane: false, defined: true, draws: { source: 'definition', detail: ['circle'] }, constructs: { source: 'definition', detail: ['eq-lines'] } })
  })

  it('measures a claim as numeric evidence does', () => {
    expect(row('vesica').measured.source).toBe('definition')
    // a square's right angles bring in points of their own: measurable only as a hypothesis
    expect(row('square').measured.source).toBe('hypothesis')
    // a word with no definition and no reading cannot be measured
    const user = vocabulary(new KnowledgeBase([...bookRules, ...parseRules('tall a b: eq-lines a b a b\nnice a: tall a a')]))
    expect(user.find(r => r.name === 'tall')!.measured.source).toBe('definition')
    const open = vocabulary(new KnowledgeBase([...bookRules, ...parseRules('shiny a b: glows a\nshiny a b: hums b')]))
    expect(open.find(r => r.name === 'glows')!.measured).toEqual({ source: 'none', detail: ['glows'] })
  })
})
