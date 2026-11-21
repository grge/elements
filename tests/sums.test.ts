/**
 * Sums (structure.ts `Sum`, saturate.ts): a relation of three pairs the engine proves, from its own
 * rules, to be a sum of the pairs' values; a solver adds and takes away, and gives equal values back.
 * The book's case is quadrance (chapter 4): squared lengths, added by Pythagoras.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { analyseStructure } from '../src/kb/structure'
import { checkLemma } from '../src/kb/checker'
import { parseLemmas } from '../src/language/parser'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const check = (text: string) => checkLemma(parseLemmas(text)[0], kb, 2_000_000, { distinctNames: true }).result

describe('quadrance is recognised as a sum', () => {
  it('from its own rules, over equal lengths; nothing named', () => {
    expect(analyseStructure(kb.allRules()).sums.get('quad-sum')).toEqual({ values: 'eq-lines' })
  })

  it('stays an open word: its bridge is not its definition', () => {
    // A lone clause would be read as a definition, its facts never stored: the trap a prototype fell in.
    expect(kb.definitions().get('quad-sum')?.kind).toBe('open')
  })
})

describe('equal lengths by adding and taking away quadrances', () => {
  it('equal tangents from a point (hypotenuse-leg)', () => {
    expect(check('? eq-lines p a p b: circle o a b, right o a p, right o b p')).toBe('verified')
  })

  it('but not from one tangent alone', () => {
    expect(check('? eq-lines p a p b: circle o a b, right o a p')).not.toBe('verified')
  })

  it('nor hypotenuse-leg with the legs crossed', () => {
    expect(check('? eq-lines b c e f: right a b c, right d e f, eq-lines a c d f, eq-lines a b e f')).not.toBe('verified')
  })
}, 120_000)
