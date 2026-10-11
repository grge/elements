import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase, forwardClosure, groundKey, type GroundPredicate } from '../src/kb/inference'
import { analyseStructure } from '../src/kb/structure'
import { prepare, saturate } from '../src/kb/saturate'
import { showRule } from '../src/kb/rules'

const read = (f: string) => readFileSync(resolve(__dirname, '../src/language', f), 'utf8')
const core = parseRules(read('core.geo'))
const g = (s: string): GroundPredicate => { const [name, ...args] = s.split(' '); return { name, args } }

describe('structure recognised by proof in core.geo', () => {
  const st = analyseStructure(core)

  it('finds eq-point as the equality, substitutable into the other primitives', () => {
    expect(st.equality).toBe('eq-point')
    for (const p of ['eq-lines', 'between', 'collinear']) expect(st.congruent.get(p)!.every(Boolean)).toBe(true)
  })

  it('finds eq-lines as an equivalence on unordered pairs', () => {
    const e = st.equivalences.get('eq-lines')!
    expect(e.k).toBe(2)
    expect(e.blockGroup).toHaveLength(2)
  })

  it('finds exactly the symmetries the rules give', () => {
    expect(st.symmetries.get('between')!.map(p => p.join(''))).toEqual(expect.arrayContaining(['012', '210']))
    expect(st.symmetries.get('between')).toHaveLength(2)
    expect(st.symmetries.get('collinear')).toHaveLength(6)
  })

  it('skips only rules the structure implies', () => {
    const redundant = new Set(prepare(new KnowledgeBase(core)).redundant.map(showRule))
    expect(redundant).toContain('eq-point a c: eq-point a b, eq-point b c')
    expect(redundant).toContain('eq-lines a b c d: eq-lines b a c d')
    expect(redundant).toContain('between x b c: between a b c, eq-point x a')
    // Real content is still fired as rules.
    expect(redundant).not.toContain('eq-point a b: eq-lines a b c c')
    expect(redundant).not.toContain('collinear a b c: between a b c')
    expect(redundant).not.toContain('between a a b: -')
  })
})

describe('structure in a knowledge base that is not geometry', () => {
  // Colouring a map: same-colour is an equivalence; adjacent is symmetric; clash is derived.
  const rules = parseRules(`
    same x x: -
    same y x: same x y
    same x z: same x y, same y z
    adjacent y x: adjacent x y
    adjacent x2 y: adjacent x y, same x2 x
    clash x y: adjacent x y, same x y
  `)

  it('recognises the equivalence and the symmetry without knowing any names', () => {
    const st = analyseStructure(rules)
    expect(st.equality).toBe('same')
    expect(st.symmetries.get('adjacent')).toHaveLength(2)
  })

  it('computes the same closure as the reference engine', () => {
    const kb = new KnowledgeBase(rules)
    const seeds = ['adjacent a b', 'adjacent b c', 'same a c', 'same c d'].map(g)
    const ref = new Set(forwardClosure(kb, seeds, 10_000).map(groundKey))
    const sat = saturate(kb, seeds)
    for (const goal of ['clash a b', 'clash b a', 'clash d b', 'adjacent b d', 'same d a'].map(g)) {
      expect(sat.holds(goal)).toBe(ref.has(groundKey(goal)))
    }
    expect(sat.holds(g('clash a c'))).toBe(false)
  })
})
