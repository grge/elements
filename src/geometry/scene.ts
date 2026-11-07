/**
 * A figure in screen coordinates: what both the interactive diagram and the contents thumbnails draw.
 */

import type { GeometryProblem } from './constraints'
import type { RenderTransform } from './view'

type Point = [number, number]

/**
 * Every element ends with its level: 0 for the shallowest in the figure, one more for each
 * definition nested deeper (see DrawableFact). The diagram draws deeper levels fainter and thinner.
 */
export interface Scene {
  /** Lines through their points, extended across the viewport: [x1, y1, x2, y2, level]. */
  lines: number[][]
  /** Circles: [cx, cy, r, level]. */
  circles: number[][]
  /** Segments known to be equal, from eq-lines facts and from circles' radii: [x1, y1, x2, y2, level]. */
  segments: number[][]
  /** Tick marks across those segments, one per stroke; equal segments share a number of ticks. */
  ticks: number[][]
  points: { name: string; x: number; y: number }[]
}

/**
 * A line or circle the construction used to place `point` (in world coordinates), drawn when the
 * figure does not already show it: the compass carrying a length, a bisector. It is one level
 * deeper than the point it places.
 */
export type Helper =
  | { point: string; kind: 'line'; p: Point; d: Point }
  | { point: string; kind: 'circle'; c: Point; r: number }

export function buildScene(
  problem: GeometryProblem,
  coords: Map<string, Point>,
  t: RenderTransform,
  width: number,
  height: number,
  tick = 7,
  helpers: readonly Helper[] = [],
): Scene {
  const tx = (x: number) => t.offsetX + (x - t.minX) * t.scale
  const ty = (y: number) => t.offsetY + (y - t.minY) * t.scale
  const at = (p: string): Point | null => { const c = coords.get(p); return c ? [tx(c[0]), ty(c[1])] : null }
  const reach = width + height

  // Depths: the shallowest element is level 0. A point is as deep as the shallowest element on it.
  const eqDists = problem.constraints.filter(c => c.kind === 'eq-dist')
  const depthOf = (d: number | undefined) => d ?? 0
  const top = Math.min(
    ...problem.lines.map(l => depthOf(l.depth)), ...problem.circles.map(c => depthOf(c.depth)),
    ...eqDists.map(c => depthOf(c.depth)), Infinity)
  const base = Number.isFinite(top) ? top : 0
  const level = (d: number | undefined) => Math.max(0, depthOf(d) - base)
  const pointDepth = new Map<string, number>()
  const touch = (p: string, d: number | undefined) => pointDepth.set(p, Math.min(depthOf(d), pointDepth.get(p) ?? Infinity))
  for (const l of problem.lines) for (const p of l.points) touch(p, l.depth)
  for (const c of problem.circles) for (const p of [c.center, ...c.points]) touch(p, c.depth)
  for (const c of eqDists) for (const p of [...c.pair1, ...c.pair2]) touch(p, c.depth)

  const lines: number[][] = []
  const lineThrough = (ax: number, ay: number, ux: number, uy: number, lv: number) =>
    lines.push([ax - ux * reach, ay - uy * reach, ax + ux * reach, ay + uy * reach, lv])
  for (const line of problem.lines) {
    const pts = [...line.points].map(at).filter((p): p is Point => !!p)
    if (pts.length < 2) continue
    const [[ax, ay], [bx, by]] = pts
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1e-9) continue
    lineThrough(ax, ay, (bx - ax) / len, (by - ay) / len, level(line.depth))
  }

  const circles: number[][] = []
  for (const circle of problem.circles) {
    const c = coords.get(circle.center)
    const pts = [...circle.points].map(p => coords.get(p)).filter((p): p is Point => !!p)
    if (!c || !pts.length) continue
    const r = pts.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / pts.length
    circles.push([tx(c[0]), ty(c[1]), r * t.scale, level(circle.depth)])
  }

  // The construction actually used: loci the figure does not already show, one level below the
  // point they place.
  for (const h of helpers) {
    const lv = level((pointDepth.get(h.point) ?? base) + 1)
    if (h.kind === 'circle') {
      const [cx, cy, r] = [tx(h.c[0]), ty(h.c[1]), h.r * t.scale]
      if (r < 1 || circles.some(o => Math.hypot(o[0] - cx, o[1] - cy) < 1 && Math.abs(o[2] - r) < 1)) continue
      circles.push([cx, cy, r, lv])
    } else {
      const [ax, ay] = [tx(h.p[0]), ty(h.p[1])]
      const len = Math.hypot(h.d[0], h.d[1])
      if (len < 1e-12) continue
      const [ux, uy] = [h.d[0] / len, h.d[1] / len]
      const shown = lines.some(o => {
        const [ox, oy] = [o[2] - o[0], o[3] - o[1]], ol = Math.hypot(ox, oy)
        return Math.abs(ux * oy - uy * ox) / ol < 1e-3 && Math.abs((ax - o[0]) * oy - (ay - o[1]) * ox) / ol < 1
      })
      if (!shown) lineThrough(ax, ay, ux, uy, lv)
    }
  }

  // Equal segments: group them into classes, the first class gets one tick, the next two, and so on.
  // A circle's radii are equal too, so the figure's own circles (level 0) draw and tick them like any
  // other equal segments, as Byrne would: the equilateral triangle's two circles give its three
  // sides one tick each.
  const parent = new Map<string, string>()
  const find = (k: string): string => { while (parent.get(k) !== k) k = parent.get(k)!; return k }
  const key = ([a, b]: readonly string[]) => a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`
  const equate = (k1: string, k2: string) => {
    for (const k of [k1, k2]) if (!parent.has(k)) parent.set(k, k)
    parent.set(find(k1), find(k2))
  }
  const segDepth = new Map<string, number>()
  const note = (k: string, d: number | undefined) => segDepth.set(k, Math.min(depthOf(d), segDepth.get(k) ?? Infinity))
  for (const c of eqDists) {
    equate(key(c.pair1), key(c.pair2))
    note(key(c.pair1), c.depth); note(key(c.pair2), c.depth)
  }
  for (const circle of problem.circles) {
    const radii = [...circle.points].filter(p => p !== circle.center).map(p => key([circle.center, p]))
    // One radius equals nothing; and only the figure's own circles mark their radii, so the
    // scaffolding of nested constructions stays scaffolding.
    if (radii.length < 2 || level(circle.depth) > 0) continue
    for (const r of radii) { equate(radii[0], r); note(r, circle.depth) }
  }
  const classOf = new Map<string, number>()
  const segments: number[][] = []
  const ticks: number[][] = []
  for (const k of parent.keys()) {
    const [p, q] = k.split('\u0001').map(at)
    if (!p || !q) continue
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len < 1e-6) continue
    const root = find(k)
    if (!classOf.has(root)) classOf.set(root, classOf.size)
    const n = classOf.get(root)! + 1
    const lv = level(segDepth.get(k))
    segments.push([p[0], p[1], q[0], q[1], lv])
    const [ux, uy] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len]
    const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * tick * 0.6
      const [cx, cy] = [mx + ux * off, my + uy * off]
      ticks.push([cx - uy * tick / 2, cy + ux * tick / 2, cx + uy * tick / 2, cy - ux * tick / 2, lv])
    }
  }

  const points = [...coords].map(([name, [x, y]]) => ({ name, x: tx(x), y: ty(y) }))
  return { lines, circles, segments, ticks, points }
}
