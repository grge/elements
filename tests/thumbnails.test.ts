import { describe, it, expect } from 'vitest'
import { KnowledgeBase } from '../src/kb/inference'
import { computeThumbnail } from '../src/composables/useThumbnails'
import { buildScene } from '../src/geometry/scene'
import { computeRenderTransform } from '../src/geometry/view'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)

describe('contents thumbnails', () => {
  it('draws every construction in chapter 1', () => {
    for (const [name, args] of [
      ['eq-triangle', 'a b c'], ['vesica', 'a b c d'], ['midpoint', 'm a b'], ['double', 'a b c'],
      ['march', 'a b c d e'], ['hexagon', 'o a b c d e f'], ['circle', 'a b c'], ['between', 'a b c'],
    ] as const) {
      const th = computeThumbnail(kb, name, args.split(' '))
      expect(th, name).not.toBeNull()
      expect(th!.coords.size, name).toBe(new Set(args.split(' ')).size)
    }
  })

  it('has nothing to draw for a relation the drawing layer does not know', () => {
    expect(computeThumbnail(kb, 'eq-point', ['a', 'b'])).toBeNull()
  })

  it('is stable: the same figure every time', () => {
    const one = computeThumbnail(kb, 'vesica', ['a', 'b', 'c', 'd'])!
    const two = computeThumbnail(kb, 'vesica', ['a', 'b', 'c', 'd'])!
    for (const [p, xy] of one.coords) expect(two.coords.get(p)).toEqual(xy)
  })
})

describe('scene', () => {
  it('marks equal segments with ticks, a different number per class', () => {
    const th = computeThumbnail(kb, 'eq-lines', ['a', 'b', 'c', 'd'])!
    const t = computeRenderTransform({ coords: th.coords, energy: 0 }, 160, 112, 14, th.problem)!
    const scene = buildScene(th.problem, th.coords, t, 160, 112)
    expect(scene.segments).toHaveLength(2)
    expect(scene.ticks).toHaveLength(2)   // one class, one tick on each segment
  })
})
