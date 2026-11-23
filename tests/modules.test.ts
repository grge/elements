/**
 * Modules (src/kb/modules.ts): which module owns each word, which modules use which, and the rules
 * that cross; and strata, the search's levels, worked out from them (saturate.ts).
 */

import { describe, it, expect } from 'vitest'
import { parseRules, parseLemmas } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { analyseModules, inModule, needs, showProblem } from '../src/kb/modules'
import { modulesOf, saturate } from '../src/kb/saturate'
import { checkLemma } from '../src/kb/checker'
import { unfold } from '../src/kb/inference'
import { FreshNames } from '../src/kb/names'
import { bookRules, chapterFiles } from './book'

const logic = new Set(['false', 'eq-point'])
const analyse = (files: Record<string, string>, defined: string[] = []) =>
  analyseModules(Object.entries(files).flatMap(([m, src]) => inModule(parseRules(src), m)), { defined: new Set(defined), logic })

describe('module analysis', () => {
  const files = {
    length: `
      eq-lines c d a b: eq-lines a b c d
      eq-lines a b c d: between a b c, eq-lines a c c d
      between c b a: between a b c`,
    ratio: `
      eq-ratio e f g h a b c d: eq-ratio a b c d e f g h
      eq-ratio a b c d a b a b: eq-lines a b c d
      eq-lines a b c d: eq-ratio a b c d a b a b`,
  }

  it('gives each word the module holding its own rules', () => {
    const a = analyse(files)
    expect(Object.fromEntries(a.owner)).toEqual({ 'eq-lines': 'length', between: 'length', 'eq-ratio': 'ratio' })
    expect(a.problems).toEqual([])
  })

  it('orders modules by what their rule bodies mention, not by what they conclude', () => {
    const a = analyse(files)
    expect([...a.uses.get('ratio')!]).toEqual(['length'])
    expect([...a.uses.get('length')!]).toEqual([])
    expect(a.modules).toEqual(['length', 'ratio'])
    expect(a.crossings.map(c => `${c.module} → ${c.word} (${c.owner})`)).toEqual(['ratio → eq-lines (length)'])
  })

  it('reports a word with two homes, or none, and a cycle', () => {
    const twoHomes = analyse({ a: 'p y x: p x y', b: 'p x x: -' })
    expect(twoHomes.problems.map(showProblem)).toEqual(['p: two homes (a, b)'])
    const noHome = analyse({ a: 'p x y: q x y', b: 'q y x: q x y' })
    expect(noHome.problems.map(showProblem)).toEqual(['p: no home (a)'])
    const cycle = analyse({ a: 'p y x: p x y\np x y: q x y', b: 'q y x: q x y\nq x y: p x y' })
    expect(cycle.problems.map(showProblem)).toEqual(['a cycle among a, b'])
  })

  it('gives a defined word to the module holding its definition', () => {
    const a = analyse({ length: files.length, shapes: 'midpoint m a b: between a m b, eq-lines a m m b' }, ['midpoint'])
    expect(a.owner.get('midpoint')).toBe('shapes')
    expect([...needs(a, ['midpoint'])].sort()).toEqual(['length', 'shapes'])
  })
})

describe('the book as modules', () => {
  const analysis = modulesOf(new KnowledgeBase(bookRules))
  const files = chapterFiles.map(f => f.replace(/\.geo$/, ''))

  it('has every word in one home, and no cycle', () => {
    expect(analysis.problems.map(showProblem)).toEqual([])
  })

  it('reads in an order its logic allows: every module uses only earlier files', () => {
    for (const [m, uses] of analysis.uses) {
      for (const u of uses) expect(files.indexOf(u), `${m} uses ${u}`).toBeLessThan(files.indexOf(m))
    }
  })
})

describe('strata', () => {
  const kb = new KnowledgeBase(bookRules)
  const lemmaOf = (text: string) => parseLemmas(`? ${text}`)[0]
  const searchFor = (text: string) => {
    const lemma = lemmaOf(text)
    const fresh = new FreshNames()
    const frontier = lemma.hypotheses.flatMap(h => unfold({ name: h.name, args: h.args }, kb, new Set(), { fresh }).frontier)
    return saturate(kb, frontier, { goal: { name: lemma.head.name, args: lemma.head.args } })
  }

  it('finds the windmill among the modules its words need: ratio never runs', () => {
    const s = searchFor('eq-area a b d f b c: windmill a b c f g d e l x y')
    expect(s.holds({ name: 'eq-area', args: ['a', 'b', 'd', 'f', 'b', 'c'] })).toBe(true)
    expect(s.level).toBe(0)
  })

  it('goes on to the rest of the book when those modules fall short', () => {
    // Chapter 2's midpoint: its proof, with the whole book, uses a rule of a later module.
    const s = searchFor('midpoint m a b: bisect a b m')
    expect(s.level).toBe(1)
    expect(checkLemma(lemmaOf('midpoint m a b: bisect a b m'), kb).result).toBe('verified')
  })
})
