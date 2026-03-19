import { describe, it, expect } from 'vitest'
import { Configuration, makeProofState } from '../src/kb/configuration'
import { Universe } from '../src/kb/universe'
import { groundKey, type GroundPredicate } from '../src/kb/inference'

describe('Universe', () => {
  it('tracks introduced objects uniquely', () => {
    const u = new Universe()
    u.introduce(['a', 'b', 'a'])
    expect(u.has('a')).toBe(true)
    expect(u.has('b')).toBe(true)
    expect(u.has('c')).toBe(false)
    expect([...u.all()]).toEqual(['a', 'b'])
  })

  it('notifies listeners only about fresh objects', () => {
    const u = new Universe()
    const seen: string[][] = []
    u.onIntroduce(xs => seen.push(xs))
    u.introduce(['a', 'b'])
    u.introduce(['b', 'c'])
    u.introduce([])
    expect(seen).toEqual([['a', 'b'], ['c']])
  })
})

describe('Configuration', () => {
  const fact1: GroundPredicate = { name: 'circle', args: ['o', 'a', 'p'] }
  const fact2: GroundPredicate = { name: 'between', args: ['a', 'm', 'b'] }

  it('stores facts and introduces their objects into the universe', () => {
    const cfg = new Configuration()
    cfg.addFact(fact1)
    cfg.addFact(fact2)

    expect(cfg.hasFact(groundKey(fact1))).toBe(true)
    expect(cfg.hasFact(groundKey(fact2))).toBe(true)
    expect(cfg.universe.has('o')).toBe(true)
    expect(cfg.universe.has('m')).toBe(true)
    expect(cfg.universe.has('b')).toBe(true)
  })

  it('deduplicates repeated facts', () => {
    const cfg = new Configuration()
    cfg.addFact(fact1)
    cfg.addFact(fact1)
    expect(cfg.allFacts()).toHaveLength(1)
    expect(cfg.factsForPredicate('circle')).toHaveLength(1)
  })

  it('indexes facts by predicate name', () => {
    const cfg = new Configuration()
    cfg.addFacts([fact1, fact2])
    expect(cfg.factsForPredicate('circle')).toEqual([fact1])
    expect(cfg.factsForPredicate('between')).toEqual([fact2])
    expect(cfg.factsForPredicate('eq-lines')).toEqual([])
  })
})

describe('makeProofState', () => {
  it('creates a temporary proof state from seed predicates', () => {
    const seeds: GroundPredicate[] = [
      { name: 'circle', args: ['o', 'a', 'p'] },
      { name: 'circle', args: ['o', 'a', 'q'] },
    ]
    const state = makeProofState(seeds)
    expect(state.facts).toEqual(seeds)
    expect([...state.universe.all()]).toEqual(['o', 'a', 'p', 'q'])
  })
})
