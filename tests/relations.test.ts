/**
 * The relation table (relations.ts): the one place that says what a relation is to the figure.
 * Extraction, the construction model, the checks a drawing is held to and numeric evidence all read it.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { extract, CONSTRAINT_RELATIONS, DEPICTED_RELATIONS } from '../src/geometry/extraction'
import { buildModel, plan, execute } from '../src/geometry/construction'
import { RELATIONS, relationOf, holds, type Point } from '../src/geometry/relations'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)

describe('the relation table', () => {
  it('is where extraction learns which relations are constraints and which are drawn', () => {
    expect([...CONSTRAINT_RELATIONS].sort()).toEqual(['between', 'circle', 'collinear', 'distinct', 'eq-angle', 'eq-lines', 'eq-spread', 'supp'])
    expect(DEPICTED_RELATIONS.has('circle')).toBe(true)
    expect(DEPICTED_RELATIONS.has('right')).toBe(true)     // drawn as itself, read through its definition
    expect(CONSTRAINT_RELATIONS.has('right')).toBe(false)
    expect(CONSTRAINT_RELATIONS.has('eq-point')).toBe(false)
  })

  it('knows each relation\'s number of points: a fact with the wrong number is unread, not drawn', () => {
    expect(relationOf({ name: 'circle', args: ['a', 'b'] })).toBeUndefined()
    expect(relationOf({ name: 'collinear', args: ['a', 'b', 'c', 'd'] })).toBe(RELATIONS.get('collinear'))
    const x = extract(kb, [{ name: 'circle', args: ['a', 'b'] }])
    expect(x.depicted).toEqual([])
    expect(x.unread.map(f => f.name)).toEqual(['circle'])
  })

  it('reads an open circle (no definition in the knowledge base) as equal radii', () => {
    const x = extract(new KnowledgeBase([]), [{ name: 'circle', args: ['o', 'a', 'b'] }])
    expect(x.constraints.map(f => f.name)).toEqual(['circle'])
    expect(buildModel(x.constraints).lengths).toEqual([[['a', 'o'], ['b', 'o']]])
  })

  it('evaluates every relation, with tolerance on the figure\'s scale', () => {
    const at = new Map<string, Point>([['a', [0, 0]], ['b', [2, 0]], ['c', [1, 0]], ['d', [0, 2]], ['e', [1e-9, 0]]])
    expect(holds({ name: 'between', args: ['a', 'c', 'b'] }, at)).toBe(true)
    expect(holds({ name: 'between', args: ['a', 'b', 'c'] }, at)).toBe(false)
    expect(holds({ name: 'collinear', args: ['a', 'b', 'c'] }, at)).toBe(true)
    expect(holds({ name: 'circle', args: ['a', 'b', 'd'] }, at)).toBe(true)
    expect(holds({ name: 'eq-lines', args: ['a', 'c', 'c', 'b'] }, at)).toBe(true)
    // e is within tolerance of a: the same point, as far as the figure can tell.
    expect(holds({ name: 'eq-point', args: ['a', 'e'] }, at)).toBe(true)
    expect(holds({ name: 'distinct', args: ['a', 'e'] }, at)).toBe(false)
    expect(holds({ name: 'distinct', args: ['a', 'c'] }, at)).toBe(true)
    expect(holds({ name: 'supp', args: ['d', 'a', 'b', 'd', 'a', 'b'] }, at)).toBe(true)     // two right angles
    expect(holds({ name: 'triangle', args: ['a', 'b', 'd'] }, at)).toBe(true)               // nothing to measure
  })
})

describe('the plan checks every fact it read', () => {
  it('a fact the construction does not imply is reported as the fact, when it fails', () => {
    // An equilateral triangle a b c, and d the other apex: c-d is not equal to a-b.
    const facts = [['a', 'b', 'a', 'c'], ['a', 'b', 'b', 'c'], ['a', 'b', 'a', 'd'], ['a', 'b', 'b', 'd'], ['c', 'd', 'a', 'b']]
      .map(args => ({ name: 'eq-lines', args }))
    const cp = plan(buildModel(facts))
    expect(cp.checks.map(c => `${c.fact.args.join('')}@${c.step}`)).toEqual(['abac@2', 'abbc@2', 'abad@3', 'abbd@3', 'cdab@3'])
    const d = execute(cp, [0, 0, 1, 0])
    expect(d.failure).toBeUndefined()
    expect(d.violations.map(v => v.what)).toEqual(['eq-lines c d a b'])
  })
})
