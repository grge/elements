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
