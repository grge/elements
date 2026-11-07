/**
 * A figure in screen coordinates: what both the interactive diagram and the contents thumbnails draw.
 */

import type { GeometryProblem } from './constraints'
import type { RenderTransform } from './view'

type Point = [number, number]

export interface Scene {
  /** Lines through their points, extended across the viewport: [x1, y1, x2, y2]. */
  lines: number[][]
  /** Circles: [cx, cy, r]. */
  circles: number[][]
  /** Segments known to be equal, from eq-lines facts and from circles' radii: [x1, y1, x2, y2]. */
  segments: number[][]
  /** Tick marks across those segments, one per stroke; equal segments share a number of ticks. */
  ticks: number[][]
  points: { name: string; x: number; y: number }[]
}

export function buildScene(
  problem: GeometryProblem,
  coords: Map<string, Point>,
  t: RenderTransform,
  width: number,
  height: number,
  tick = 7,
): Scene {
  const tx = (x: number) => t.offsetX + (x - t.minX) * t.scale
  const ty = (y: number) => t.offsetY + (y - t.minY) * t.scale
  const at = (p: string): Point | null => { const c = coords.get(p); return c ? [tx(c[0]), ty(c[1])] : null }
  const reach = width + height

  const lines: number[][] = []
  for (const line of problem.lines) {
    const pts = [...line.points].map(at).filter((p): p is Point => !!p)
    if (pts.length < 2) continue
    const [[ax, ay], [bx, by]] = pts
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1e-9) continue
    const [ux, uy] = [(bx - ax) / len, (by - ay) / len]
    lines.push([ax - ux * reach, ay - uy * reach, ax + ux * reach, ay + uy * reach])
  }

  const circles: number[][] = []
  for (const circle of problem.circles) {
    const c = coords.get(circle.center)
    const pts = [...circle.points].map(p => coords.get(p)).filter((p): p is Point => !!p)
    if (!c || !pts.length) continue
    const r = pts.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / pts.length
    circles.push([tx(c[0]), ty(c[1]), r * t.scale])
  }

  // Equal segments: group them into classes, the first class gets one tick, the next two, and so on.
  // A circle's radii are equal too, so they are drawn and ticked like any other equal segments, as
  // Byrne would: the equilateral triangle's two circles give its three sides one tick each.
  const parent = new Map<string, string>()
  const find = (k: string): string => { while (parent.get(k) !== k) k = parent.get(k)!; return k }
  const key = ([a, b]: readonly string[]) => a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`
  const equate = (k1: string, k2: string) => {
    for (const k of [k1, k2]) if (!parent.has(k)) parent.set(k, k)
    parent.set(find(k1), find(k2))
  }
  for (const c of problem.constraints) {
    if (c.kind === 'eq-dist') equate(key(c.pair1), key(c.pair2))
  }
  for (const circle of problem.circles) {
    const radii = [...circle.points].filter(p => p !== circle.center).map(p => key([circle.center, p]))
    if (radii.length >= 2) for (const r of radii) equate(radii[0], r)  // one radius equals nothing
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
    segments.push([p[0], p[1], q[0], q[1]])
    const [ux, uy] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len]
    const [mx, my] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * tick * 0.6
      const [cx, cy] = [mx + ux * off, my + uy * off]
      ticks.push([cx - uy * tick / 2, cy + ux * tick / 2, cx + uy * tick / 2, cy - ux * tick / 2])
    }
  }

  const points = [...coords].map(([name, [x, y]]) => ({ name, x: tx(x), y: ty(y) }))
  return { lines, circles, segments, ticks, points }
}
