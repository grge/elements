/**
 * Extraction: unfolding as the logic does, then reading constraints, drawing and the unreadable off
 * the tree. The planner must not notice that circles now arrive as their definition.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { extract } from '../src/geometry/extraction'
import { buildModel, plan } from '../src/geometry/construction'
import { bookRules } from './book'
import { parseRules } from '../src/language/parser'

const kb = new KnowledgeBase(bookRules)
const keys = (fs: { name: string; args: readonly string[]; depth?: number }[]) =>
  fs.map(f => `${f.name} ${f.args.join(' ')}${f.depth === undefined ? '' : ` @${f.depth}`}`).sort()

describe('extraction', () => {
  it('draws a circle as a circle, and constrains with what it means: equal radii', () => {
    const x = extract(kb, [{ name: 'eq-triangle', args: ['a', 'b', 'c'] }])
    expect(keys(x.depicted)).toEqual(['circle a b c @1', 'circle b a c @1'])
    expect(keys(x.constraints)).toEqual(['eq-lines a b a c @2', 'eq-lines b a b c @2'])
    expect(x.unread).toEqual([])
  })

  it('reports open predicates the figure cannot read instead of dropping them', () => {
    const x = extract(kb, [{ name: 'triangle', args: ['a', 'b', 'c'] }, { name: 'eq-point', args: ['a', 'd'] }])
    expect(keys(x.unread)).toEqual(['eq-point a d @0', 'triangle a b c @0'])
  })

  it('draws the first drawn node on each path: a circle, not its radii again', () => {
    const x = extract(kb, [{ name: 'circle', args: ['o', 'a', 'b'] }])
    expect(keys(x.depicted)).toEqual(['circle o a b @0'])
    expect(keys(x.constraints)).toEqual(['eq-lines o a o b @1'])
  })

  it('a user predicate is unfolded like any other, through its definition', () => {
    const k = new KnowledgeBase([...bookRules, ...parseRules('kite a b c d: circle a b d, circle c b d')])
    const x = extract(k, [{ name: 'kite', args: ['a', 'b', 'c', 'd'] }])
    expect(keys(x.depicted)).toEqual(['circle a b d @1', 'circle c b d @1'])
  })
})

describe('the planner does not notice', () => {
  // Every predicate in the book, drawn from its signature: planning from the constraints (circles as
  // equal radii) gives the same plan as planning from the drawn facts (circles as circles).
  const names = [...new Set(bookRules.map(r => r.head.name))]
  for (const name of names) {
    const def = kb.definitionOf(name)
    if (!def) continue
    it(name, () => {
      const x = extract(kb, [{ name, args: def.head.args }])
      if (!x.depicted.length) return
      const fromConstraints = plan(buildModel(x.constraints))
      const fromDepicted = plan(buildModel(x.depicted))
      expect(fromConstraints.steps).toEqual(fromDepicted.steps)
      expect(fromConstraints.dof).toBe(fromDepicted.dof)
    })
  }
})
