import { describe, it, expect } from 'vitest'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase, forwardClosure, groundKey, type GroundPredicate } from '../src/kb/inference'
import { analyseStructure } from '../src/kb/structure'
import { prepare, saturate } from '../src/kb/saturate'
import { showRule } from '../src/kb/rules'
import { chapterSource } from './book'

const core = parseRules(chapterSource('01-length.geo'))
const g = (s: string): GroundPredicate => { const [name, ...args] = s.split(' '); return { name, args } }

describe('structure recognised by proof in chapter 1', () => {
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

  it('treats distinct like any other relation: symmetric, and equals substitute into it', () => {
    expect(st.symmetries.get('distinct')).toHaveLength(2)
    expect(st.congruent.get('distinct')).toEqual([true, true])
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

describe('flips: an equivalence with one side reversed, recognised by proof (November 2026)', () => {
  // Two-colouring the edges of a graph: an edge a-b has the same colour as c-d, or the other one. Same
  // colour is an equivalence on edges (blocks of two points), other colour its flip. Nothing geometric.
  // (On single points, same colour would be the knowledge base's equality, whose classes are of points.)
  const colours = parseRules(`
same a b a b: -
same c d a b: same a b c d
same a b e f: same a b c d, same c d e f
other c d a b: other a b c d
other a b e f: other a b c d, same c d e f
same c d e f: other a b c d, other a b e f
`)
  const st = analyseStructure(colours)

  it('finds other as same with one side reversed, and its rules implied', () => {
    expect(st.flips.get('other')).toEqual({ of: 'same' })
    const redundant = prepare(new KnowledgeBase(colours)).redundant.map(showRule)
    expect(redundant).toEqual(expect.arrayContaining(['other c d a b: other a b c d', 'other a b e f: other a b c d, same c d e f', 'same c d e f: other a b c d, other a b e f']))
  })

  it('needs all three: without two others making a same, there is no flip', () => {
    const fewer = colours.filter(r => !(r.head.name === 'same' && r.body.length === 2 && r.body.every(b => b.name === 'other')))
    expect(analyseStructure(fewer).flips.has('other')).toBe(false)
  })

  it('computes the closure the rules give: signs along a path, and an odd cycle makes every two both', () => {
    const kb = new KnowledgeBase(colours)
    const path = ['other a b b c', 'other b c c d', 'same c d d a'].map(g)
    const odd = [...path, g('other d a a b')]
    const edges = ['a b', 'b c', 'c d', 'd a']
    for (const seeds of [path, odd]) {
      const sat = saturate(kb, seeds)
      const ref = new Set(forwardClosure(kb, seeds, 200_000).map(groundKey))
      for (const p of ['same', 'other']) for (const x of edges) for (const y of edges) {
        const f = g(`${p} ${x} ${y}`)
        expect(sat.holds(f), `${p} ${x} ${y}`).toBe(ref.has(groundKey(f)))
      }
    }
    expect(saturate(kb, odd).holds(g('same a b b c'))).toBe(true)
    expect(saturate(kb, path).holds(g('same a b b c'))).toBe(false)
  })

  it('finds supplements as the flip of equal angles in the book', () => {
    expect(analyseStructure(parseRules(chapterSource('01-length.geo') + '\n' + chapterSource('02-angle.geo'))).flips.get('supp')).toEqual({ of: 'eq-angle' })
  })
})
