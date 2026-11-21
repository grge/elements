/**
 * The words' dependency graph (wordGraphLayout.ts): each defined word points to the words its
 * definition uses, in columns by depth and lanes by chapter.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { vocabulary } from '../src/geometry/vocabulary'
import { layoutWordGraph, SIZES } from '../src/components/wordGraphLayout'
import { bookRules } from './book'

const rows = vocabulary(new KnowledgeBase(bookRules))
const lane = (name: string) => ['eq-point', 'eq-lines', 'between', 'collinear', 'distinct', 'circle', 'vesica', 'eq-triangle'].includes(name) ? 'one' : 'two'
const layout = layoutWordGraph(rows.map((r, i) => ({ id: r.name, lane: lane(r.name), order: i, dependsOn: r.dependsOn })), ['one', 'two'])

describe('the word graph', () => {
  it('reads dependencies from definitions: open words rest on nothing', () => {
    const row = (n: string) => rows.find(r => r.name === n)!
    expect(row('eq-lines').dependsOn).toEqual([])
    expect(row('vesica').dependsOn).toEqual(['eq-triangle'])
    expect(new Set(row('right').dependsOn)).toEqual(new Set(['between', 'distinct', 'eq-angle']))
  })

  it('puts open words in the first column and every arrow pointing left', () => {
    for (const r of rows) if (!r.dependsOn.length) expect(layout.nodes.get(r.name)!.column).toBe(0)
    for (const e of layout.edges) expect(layout.nodes.get(e.from)!.column).toBeGreaterThan(layout.nodes.get(e.to)!.column)
    expect(layout.edges).toHaveLength(rows.reduce((n, r) => n + r.dependsOn.length, 0))
  })

  it('keeps words apart and inside their lanes', () => {
    const placed = [...layout.nodes.values()]
    for (const a of placed) for (const b of placed) {
      if (a === b || a.column !== b.column) continue
      expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(SIZES.nodeHeight)
    }
    const [one, two] = layout.lanes
    expect(one.y + one.height).toBeLessThanOrEqual(two.y)
    for (const r of rows) {
      const l = lane(r.name) === 'one' ? one : two
      const y = layout.nodes.get(r.name)!.y
      expect(y).toBeGreaterThanOrEqual(l.y)
      expect(y + SIZES.nodeHeight).toBeLessThanOrEqual(l.y + l.height)
    }
  })
})
