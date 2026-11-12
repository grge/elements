import { describe, it, expect } from 'vitest'
import { Configuration } from '../src/kb/configuration'
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
  })
})
