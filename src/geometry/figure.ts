/**
 * What the figure draws, read from the depicted facts (extraction.ts): lines, circles, segments
 * stated equal and angles stated equal, each with its depth (how many definitions were unfolded to
 * reach it; the figure draws deeper elements fainter). Where the points go is the construction's
 * business (construction.ts), or the solver's; this is only what to draw through them.
 */

import type { GroundPredicate } from '../kb/inference'
import { relationOf } from './relations'
import { UnionFind, mergeLines, segmentKey } from './classes'

export interface Figure {
  /** Every point a depicted fact mentions. */
  points: string[]
  /** Collinear groups, merged where they share two points, with the shallowest depth merged. */
  lines: { points: string[]; depth: number }[]
  /** Circles about a centre through their points; circles with the same centre and radius are one. */
  circles: { center: string; points: string[]; depth: number }[]
  /** Segments stated equal (`eq-lines`). */
  equal: { pair1: [string, string]; pair2: [string, string]; depth: number }[]
  /** Angles stated equal (`eq-angle a b c d e f`). */
  angles: { args: string[]; depth: number }[]
}

/** The figure of the depicted facts; null when nothing is drawn. */
export function figureOf(depicted: readonly (GroundPredicate & { depth?: number })[]): Figure | null {
  const facts = depicted.filter(f => relationOf(f)?.depicted)
  if (!facts.length) return null
  const points: string[] = []
  for (const f of facts) for (const p of f.args) if (!points.includes(p)) points.push(p)
  const depthOf = (f: { depth?: number }) => f.depth ?? 0

  const groups: { points: Set<string>; depth: number }[] = []
  const equal: Figure['equal'] = []
  const angles: Figure['angles'] = []
  const onCircles: { center: string; radius: string; target: string; depth: number }[] = []
  for (const f of facts) {
    const [a, b, c, d] = f.args
    switch (f.name) {
      case 'collinear': case 'between': groups.push({ points: new Set(f.args), depth: depthOf(f) }); break
      case 'circle': onCircles.push({ center: a, radius: b, target: c, depth: depthOf(f) }); break
      case 'eq-lines': equal.push({ pair1: [a, b], pair2: [c, d], depth: depthOf(f) }); break
      case 'eq-angle': angles.push({ args: [...f.args], depth: depthOf(f) }); break
    }
  }

  const lines = mergeLines(groups).filter(l => l.points.size >= 2).map(l => ({ points: [...l.points], depth: l.depth }))

  // A circle is its centre and its radius; radii stated equal make one radius.
  const radii = new UnionFind()
  for (const e of equal) radii.union(segmentKey(...e.pair1), segmentKey(...e.pair2))
  const byKey = new Map<string, Figure['circles'][number]>()
  for (const c of onCircles) {
    const key = `${c.center}\u0002${radii.find(segmentKey(c.center, c.radius))}`
    const circle = byKey.get(key) ?? { center: c.center, points: [], depth: c.depth }
    for (const p of [c.radius, c.target]) if (!circle.points.includes(p)) circle.points.push(p)
    circle.depth = Math.min(circle.depth, c.depth)
    byKey.set(key, circle)
  }

  return { points, lines, circles: [...byKey.values()], equal, angles }
}
