import { describe, it, expect } from 'vitest'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase, unfold, groundKey, type GroundPredicate } from '../src/kb/inference'

function keys(preds: GroundPredicate[]): string[] {
  return preds.map(groundKey).sort()
}

describe('unfold', () => {
  it('fully unfolds through a unique definitional chain', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar a
      bar a: baz a, qux a
    `))
    const result = unfold({ name: 'foo', args: ['x'] }, kb)
    expect(keys(result.frontier)).toEqual(['baz(x)', 'qux(x)'])
    expect(result.expanded).toBe(true)
  })

  it('supports an extra stopPred without relaxing structural stops', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar a
      bar a: baz a, qux a
    `))
    const result = unfold({ name: 'foo', args: ['x'] }, kb, new Set(), { stopPred: p => p.name === 'bar' })
    expect(keys(result.frontier)).toEqual(['bar(x)'])
    expect(result.expanded).toBe(true)
  })

  it('stops at a branch when multiple rules match', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar a
      foo a: baz a
    `))
    const goal = { name: 'foo', args: ['x'] }
    const result = unfold(goal, kb)
    expect(keys(result.frontier)).toEqual(['foo(x)'])
    expect(result.expanded).toBe(false)
  })

  it('stops when there is no matching rule', () => {
    const kb = new KnowledgeBase(parseRules(`foo a: bar a`))
    const goal = { name: 'unknown', args: ['x'] }
    const result = unfold(goal, kb)
    expect(keys(result.frontier)).toEqual(['unknown(x)'])
    expect(result.expanded).toBe(false)
  })

  it('stops at axioms instead of expanding through them', () => {
    const kb = new KnowledgeBase(parseRules(`eq-point a a: -`))
    const goal = { name: 'eq-point', args: ['x', 'x'] }
    const result = unfold(goal, kb)
    expect(keys(result.frontier)).toEqual(['eq-point(x,x)'])
    expect(result.expanded).toBe(false)
  })

  it('stops at non-constructive rules', () => {
    const kb = new KnowledgeBase(parseRules(`foo a: bar b`))
    const goal = { name: 'foo', args: ['x'] }
    const result = unfold(goal, kb)
    expect(keys(result.frontier)).toEqual(['foo(x)'])
    expect(result.expanded).toBe(false)
  })

  it('stops on cycles', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar a
      bar a: foo a
    `))
    const result = unfold({ name: 'foo', args: ['x'] }, kb)
    expect(keys(result.frontier)).toEqual(['foo(x)'])
    expect(result.expanded).toBe(true)
  })

  it('substitutes arguments correctly across multiple layers', () => {
    const kb = new KnowledgeBase(parseRules(`
      triangle a b c: side a b, side b c, side a c
      side a b: segment a b
    `))
    const result = unfold({ name: 'triangle', args: ['p', 'q', 'r'] }, kb)
    expect(keys(result.frontier)).toEqual([
      'segment(p,q)',
      'segment(p,r)',
      'segment(q,r)',
    ])
  })
})
