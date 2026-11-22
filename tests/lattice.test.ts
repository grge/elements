/**
 * The solver for differences (lattice.ts): an equation follows when it is an integer combination of
 * those known. Sound round a half turn, where dividing is not.
 */

import { describe, it, expect } from 'vitest'
import { Lattice, type Vector } from '../src/kb/lattice'

const v = (entries: Record<number, number>): Vector => new Map(Object.entries(entries).map(([k, c]) => [Number(k), c]))

describe('integer combinations of equations', () => {
  it('adds and subtracts: x - y = 0 and y - z = 0 give x - z = 0', () => {
    const l = new Lattice()
    l.add(v({ 0: 1, 1: -1 }))
    l.add(v({ 1: 1, 2: -1 }))
    expect(l.contains(v({ 0: 1, 2: -1 }))).toBe(true)
    expect(l.contains(v({ 0: 1 }))).toBe(false)
  })

  it('never divides: twice x being nothing does not make x nothing (a quarter turn is its own reverse)', () => {
    const l = new Lattice()
    l.add(v({ 0: 2 }))
    expect(l.contains(v({ 0: 2 }))).toBe(true)
    expect(l.contains(v({ 0: 4 }))).toBe(true)
    expect(l.contains(v({ 0: 1 }))).toBe(false)
  })

  it('finds what a greatest common divisor reaches: 2x and 3x give x', () => {
    const l = new Lattice()
    l.add(v({ 0: 2, 1: 1 }))
    l.add(v({ 0: 3, 1: 1 }))
    expect(l.contains(v({ 0: 1 }))).toBe(true)
    expect(l.contains(v({ 1: 1 }))).toBe(true)
  })

  it('III.31 in directions: 2ab = l + bo and 2bc = l + bo give 2ab = 2bc, not ab = bc', () => {
    // unknowns: 0 ab, 1 bc, 2 l (the diameter), 3 bo
    const l = new Lattice()
    l.add(v({ 0: 2, 2: -1, 3: -1 }))
    l.add(v({ 1: 2, 2: -1, 3: -1 }))
    expect(l.contains(v({ 0: 2, 1: -2 }))).toBe(true)
    expect(l.contains(v({ 0: 1, 1: -1 }))).toBe(false)
  })
})

describe('certificates', () => {
  it('say which added equations, with which integer coefficients, give one that follows', () => {
    const l = new Lattice()
    const v = (o: Record<number, number>) => new Map(Object.entries(o).map(([k, c]) => [Number(k), c]))
    l.add(v({ 0: 1, 1: -1 }))      // equation 0: x0 - x1
    l.add(v({ 1: 1, 2: -1 }))      // equation 1: x1 - x2
    l.add(v({ 3: 2 }))             // equation 2: 2·x3
    const asked = v({ 0: 1, 2: -1 })
    const cert = l.certificate(asked)!
    // the combination, summed, is the equation asked
    const sum = new Map<number, number>()
    const eqs = [v({ 0: 1, 1: -1 }), v({ 1: 1, 2: -1 }), v({ 3: 2 })]
    for (const [i, c] of cert) for (const [k, x] of eqs[i]) sum.set(k, (sum.get(k) ?? 0) + c * x)
    for (const [k, x] of asked) expect(sum.get(k)).toBe(x)
    expect([...sum].filter(([k, x]) => x !== 0 && !asked.has(k))).toEqual([])
    expect(l.certificate(v({ 3: 1 }))).toBeNull()   // x3 alone does not follow: halving is not allowed
  })
})
