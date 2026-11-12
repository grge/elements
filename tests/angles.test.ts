/**
 * Angles and spreads as relations the engine recognises (tests/fixtures/angles.geo, an engine test,
 * not book content): structure recognition on blocks of three and four points, and lemmas about both,
 * checked in reasonable time.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma } from '../src/kb/checker'
import { analyseStructure } from '../src/kb/structure'
import { parseLemmas, parseRules } from '../src/language/parser'
import { holds } from '../src/geometry/evidence'
import { angle, spread } from '../src/geometry/measure'
import { bookRules } from './book'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./fixtures/angles.geo', import.meta.url), 'utf8')
const rules = [...bookRules, ...parseRules(src)]
const kb = new KnowledgeBase(rules)

describe('structure', () => {
  const st = analyseStructure(rules)
  it('recognises equal angles as an equivalence on triples, read either way', () => {
    expect(st.equivalences.get('eq-angle')).toMatchObject({ k: 3 })
    expect(st.equivalences.get('eq-angle')!.blockGroup).toHaveLength(2)
  })
  it('recognises equal spreads as an equivalence on pairs of lines, in all eight orders', () => {
    expect(st.equivalences.get('eq-spread')).toMatchObject({ k: 4 })
    expect(st.equivalences.get('eq-spread')!.blockGroup).toHaveLength(8)
  })
  it('substitutes equal points into both', () => {
    expect(st.congruent.get('eq-angle')).toEqual(Array(6).fill(true))
    expect(st.congruent.get('eq-spread')).toEqual(Array(8).fill(true))
  })
})

describe('lemmas', () => {
  const lemmas = parseLemmas(src)
  const unprovable = 'eq-angle a b c d e f'
  for (const l of lemmas) {
    const name = `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`
    const expected = `${l.head.name} ${l.head.args.join(' ')}` === unprovable ? 'not-provable' : 'verified'
    it(`${expected === 'verified' ? '✓' : '✗'} ? ${name}`, () => {
      const t = performance.now()
      expect(checkLemma(l, kb).result).toBe(expected)
      expect(performance.now() - t).toBeLessThan(5000)
    }, 20000)
  }
})

describe('measures', () => {
  const at = new Map<string, [number, number]>([['a', [1, 0]], ['b', [0, 0]], ['c', [0, 1]], ['d', [-1, 0]], ['e', [1, 1]]])
  it('measures angles unsigned, and spreads as sin² between lines', () => {
    expect(angle(at.get('a')!, at.get('b')!, at.get('c')!)).toBeCloseTo(Math.PI / 2)
    expect(spread(at.get('b')!, at.get('a')!, at.get('b')!, at.get('e')!)).toBeCloseTo(0.5)
  })
  it('a spread does not tell an angle from its supplement; an angle does', () => {
    expect(holds({ name: 'eq-spread', args: ['b', 'a', 'b', 'e', 'b', 'd', 'b', 'e'] }, at)).toBe(true)
    expect(holds({ name: 'eq-angle', args: ['a', 'b', 'e', 'd', 'b', 'e'] }, at)).toBe(false)
  })
})
