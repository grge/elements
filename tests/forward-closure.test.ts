import { describe, it, expect } from 'vitest'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase, forwardClosure, groundKey, type GroundPredicate } from '../src/kb/inference'

function factSet(facts: GroundPredicate[]): Set<string> {
  return new Set(facts.map(groundKey))
}

describe('forwardClosure with invariants', () => {
  it('applies unary reflexive axioms to introduced objects', () => {
    const kb = new KnowledgeBase(parseRules(`
      eq-point a a: -
    `))
    const seeds: GroundPredicate[] = [
      { name: 'circle', args: ['o', 'a', 'p'] },
    ]
    const facts = factSet(forwardClosure(kb, seeds, 500))
    expect(facts.has('eq-point(o,o)')).toBe(true)
    expect(facts.has('eq-point(a,a)')).toBe(true)
    expect(facts.has('eq-point(p,p)')).toBe(true)
  })

  it('applies multi-variable axioms over the current universe', () => {
    const kb = new KnowledgeBase(parseRules(`
      pair a b: -
    `))
    const seeds: GroundPredicate[] = [
      { name: 'seed', args: ['x'] },
      { name: 'seed', args: ['y'] },
    ]
    const facts = factSet(forwardClosure(kb, seeds, 500))
    expect(facts.has('pair(x,x)')).toBe(true)
    expect(facts.has('pair(x,y)')).toBe(true)
    expect(facts.has('pair(y,x)')).toBe(true)
    expect(facts.has('pair(y,y)')).toBe(true)
  })

  it('derives ordinary forward consequences from seeded facts', () => {
    const kb = new KnowledgeBase(parseRules(`
      collinear a b c: between a b c
    `))
    const seeds: GroundPredicate[] = [
      { name: 'between', args: ['a', 'b', 'c'] },
    ]
    const facts = factSet(forwardClosure(kb, seeds, 500))
    expect(facts.has('collinear(a,b,c)')).toBe(true)
  })

  it('treats head-only variables as triggered invariants over the universe', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar b
    `))
    const seeds: GroundPredicate[] = [
      { name: 'seed', args: ['x'] },
      { name: 'seed', args: ['y'] },
      { name: 'bar', args: ['y'] },
    ]
    const facts = factSet(forwardClosure(kb, seeds, 500))
    expect(facts.has('foo(x)')).toBe(true)
    expect(facts.has('foo(y)')).toBe(true)
  })

  it('re-applies triggered invariants when new objects are introduced later', () => {
    const kb = new KnowledgeBase(parseRules(`
      foo a: bar b
      seed z: foo z
    `))
    const seeds: GroundPredicate[] = [
      { name: 'bar', args: ['x'] },
    ]
    const facts = factSet(forwardClosure(kb, seeds, 500))
    expect(facts.has('foo(x)')).toBe(true)
    expect(facts.has('seed(x)')).toBe(true)
  })

  it('supports early exit when the goal is derived by an invariant', () => {
    const kb = new KnowledgeBase(parseRules(`
      eq-point a a: -
    `))
    const seeds: GroundPredicate[] = [
      { name: 'seed', args: ['x'] },
    ]
    const facts = factSet(forwardClosure(kb, seeds, 500, 'eq-point(x,x)'))
    expect(facts.has('eq-point(x,x)')).toBe(true)
  })

  it('respects the maxSteps limit as a safety valve', () => {
    const kb = new KnowledgeBase(parseRules(`
      next a b: edge a b
      edge a c: next a b
    `))
    const seeds: GroundPredicate[] = [
      { name: 'edge', args: ['a', 'b'] },
    ]
    const facts = forwardClosure(kb, seeds, 0)
    expect(facts.map(groundKey)).toEqual(['edge(a,b)'])
  })
})
