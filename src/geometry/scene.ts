/**
 * A figure in screen coordinates: what both the interactive diagram and the contents thumbnails draw.
 */

import type { Figure } from './figure'
import { segmentKey } from './classes'
import type { RenderTransform } from './view'
import type { GroundPredicate } from '../kb/inference'

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
  /** Segments marked equal, and the arms of angles marked equal: [x1, y1, x2, y2, level]. */
  segments: number[][]
  /** Tick marks across those segments, one per stroke; equal segments share a number of ticks. */
  ticks: number[][]
  points: { name: string; x: number; y: number }[]
  /**
   * Arcs marking equal angles at their vertices, as Byrne marks them: equal angles share a number of
   * concentric arcs. SVG path data, with the level, and the mark class and member (figure.marks).
   */
  arcs: { d: string; level: number; mark: number; member: number }[]
  /** The loci that placed the touched point, if any (see Helper), in screen coordinates. */
  route: ({ kind: 'line'; x1: number; y1: number; x2: number; y2: number } | { kind: 'circle'; cx: number; cy: number; r: number })[]
  /** Which points each element is drawn through, parallel to the arrays above (for emphasis). */
  meta: {
    /** The named points on each line (none for a construction's helper line). */
    lines: string[][]
    /** Each circle's centre and the points on it (none for a helper circle). */
    circles: { center: string; points: string[] }[]
    segments: [string, string][]
    /** The segment each tick is on. */
    ticks: number[]
    /** For each segment, the mark class and member it is (figure.marks), or null for an angle's arm. */
    segmentMarks: ({ mark: number; member: number } | null)[]
  }
}

/**
 * A locus the construction used to place `point` (in world coordinates): the compass carrying a
 * length, a bisector, a ray at a copied angle (`ray`: only the half from p along d).
 */
export type Helper =
  | { point: string; kind: 'line'; p: Point; d: Point; ray?: boolean }
  | { point: string; kind: 'circle'; c: Point; r: number }

export function buildScene(
  figure: Figure,
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

  // Depths: the shallowest element is level 0.
  const depthOf = (d: number | undefined) => d ?? 0
  const top = Math.min(
    ...figure.lines.map(l => depthOf(l.depth)), ...figure.circles.map(c => depthOf(c.depth)),
    ...figure.marks.flatMap(m => m.members.map(x => x.depth)), Infinity)
  const base = Number.isFinite(top) ? top : 0
  const level = (d: number | undefined) => Math.max(0, depthOf(d) - base)

  const meta: Scene['meta'] = { lines: [], circles: [], segments: [], ticks: [], segmentMarks: [] }
  const lines: number[][] = []
  const lineThrough = (ax: number, ay: number, ux: number, uy: number, lv: number) =>
    lines.push([ax - ux * reach, ay - uy * reach, ax + ux * reach, ay + uy * reach, lv])
  for (const line of figure.lines) {
    const pts = [...line.points].map(at).filter((p): p is Point => !!p)
    if (pts.length < 2) continue
    const [[ax, ay], [bx, by]] = pts
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1e-9) continue
    lineThrough(ax, ay, (bx - ax) / len, (by - ay) / len, level(line.depth))
    meta.lines.push([...line.points])
  }

  const circles: number[][] = []
  for (const circle of figure.circles) {
    const c = coords.get(circle.center)
    const pts = [...circle.points].map(p => coords.get(p)).filter((p): p is Point => !!p)
    if (!c || !pts.length) continue
    const r = pts.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / pts.length
    circles.push([tx(c[0]), ty(c[1]), r * t.scale, level(circle.depth)])
    meta.circles.push({ center: circle.center, points: [...circle.points] })
  }

  // The route: loci the construction used to place the touched point. Not part of the figure; drawn
  // apart, only while a point is touched (design.md, "The planner's route: shown on touch").
  const route: Scene['route'] = []
  for (const h of helpers) {
    if (h.kind === 'circle') {
      const r = h.r * t.scale
      if (r >= 1) route.push({ kind: 'circle', cx: tx(h.c[0]), cy: ty(h.c[1]), r })
      continue
    }
    const len = Math.hypot(h.d[0], h.d[1])
    if (len < 1e-12) continue
    const [ax, ay] = [tx(h.p[0]), ty(h.p[1])]
    const [ux, uy] = [h.d[0] / len, h.d[1] / len]
    route.push({ kind: 'line', x1: h.ray ? ax : ax - ux * reach, y1: h.ray ? ay : ay - uy * reach, x2: ax + ux * reach, y2: ay + uy * reach })
  }

  // Marks (marks.ts): each class of equal blocks with at least two members on screen (a mark must have
  // something to be equal to). Classes of segments get ticks, one more stroke for each class, and
  // classes of angles get concentric arcs, one more for each class, with their arms drawn as Byrne
  // draws them. Each is as deep as the fact that made it known.
  const segments: number[][] = []
  const ticks: number[][] = []
  const arcs: Scene['arcs'] = []
  const segmentAt = new Map<string, number>()
  const addSegment = (a: string, b: string, lv: number): number | null => {
    const k = segmentKey(a, b)
    if (segmentAt.has(k)) return segmentAt.get(k)!
    const [p, q] = [at(a), at(b)]
    if (!p || !q || Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) return null
    segments.push([p[0], p[1], q[0], q[1], lv])
    meta.segments.push([a, b])
    meta.segmentMarks.push(null)
    segmentAt.set(k, segments.length - 1)
    return segments.length - 1
  }
  const visible = (m: { points: string[] }) => m.points.every(p => coords.has(p))
  let segmentClasses = 0, angleClasses = 0
  figure.marks.forEach((cls, ci) => {
    const shown = cls.members.map((_, i) => i).filter(i => visible(cls.members[i]))
    if (shown.length < 2 || (cls.k !== 2 && cls.k !== 3)) return
    const n = cls.k === 2 ? ++segmentClasses : ++angleClasses
    for (const mi of shown) {
      const member = cls.members[mi]
      const lv = level(member.depth)
      if (cls.k === 2) {
        const [a, b] = member.points
        const si = addSegment(a, b, lv)
        if (si === null) continue
        meta.segmentMarks[si] = { mark: ci, member: mi }
        const [x1, y1, x2, y2] = segments[si]
        const len = Math.hypot(x2 - x1, y2 - y1)
        const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len]
        const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * tick * 0.6
          const [cx, cy] = [mx + ux * off, my + uy * off]
          ticks.push([cx - uy * tick / 2, cy + ux * tick / 2, cx + uy * tick / 2, cy - ux * tick / 2, lv])
          meta.ticks.push(si)
        }
        continue
      }
      // An angle: arms from the vertex, and n arcs.
      const [na, nb, nc] = member.points
      const [a, b, c] = [at(na), at(nb), at(nc)]
      if (!a || !b || !c) continue
      addSegment(nb, na, lv); addSegment(nb, nc, lv)
      const [ua, uc] = [Math.atan2(a[1] - b[1], a[0] - b[0]), Math.atan2(c[1] - b[1], c[0] - b[0])]
      let sweep = uc - ua
      while (sweep <= -Math.PI) sweep += 2 * Math.PI
      while (sweep > Math.PI) sweep -= 2 * Math.PI
      const reachA = Math.hypot(a[0] - b[0], a[1] - b[1]), reachC = Math.hypot(c[0] - b[0], c[1] - b[1])
      for (let i = 0; i < n; i++) {
        const r = Math.min(tick * 2.2 + i * tick * 0.75, 0.45 * Math.min(reachA, reachC))
        if (r < 2) continue
        const p0 = [b[0] + r * Math.cos(ua), b[1] + r * Math.sin(ua)]
        const p1 = [b[0] + r * Math.cos(ua + sweep), b[1] + r * Math.sin(ua + sweep)]
        arcs.push({ d: `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 ${sweep > 0 ? 1 : 0} ${p1[0]} ${p1[1]}`, level: lv, mark: ci, member: mi })
      }
    }
  })

  const points = [...coords].map(([name, [x, y]]) => ({ name, x: tx(x), y: ty(y) }))
  return { lines, circles, segments, ticks, points, arcs, route, meta }
}

/** Which elements of a scene to bring forward: those that the given drawable facts draw. */
export interface Emphasis { lines: Set<number>; circles: Set<number>; segments: Set<number>; points: Set<string> }

export function emphasise(scene: Scene, facts: readonly GroundPredicate[], points: Iterable<string>): Emphasis {
  const out: Emphasis = { lines: new Set(), circles: new Set(), segments: new Set(), points: new Set(points) }
  const same = (s: [string, string], a: string, b: string) => (s[0] === a && s[1] === b) || (s[0] === b && s[1] === a)
  for (const f of facts) {
    const [a, b, c, d] = f.args
    switch (f.name) {
      case 'circle':
        scene.meta.circles.forEach((m, i) => { if (m.center === a && (m.points.includes(b) || m.points.includes(c))) out.circles.add(i) })
        scene.meta.segments.forEach((s, i) => { if (same(s, a, b) || same(s, a, c)) out.segments.add(i) })
        break
      case 'collinear': case 'between':
        scene.meta.lines.forEach((pts, i) => { if (f.args.filter(p => pts.includes(p)).length >= 2) out.lines.add(i) })
        break
      case 'eq-lines':
        scene.meta.segments.forEach((s, i) => { if (same(s, a, b) || same(s, c, d)) out.segments.add(i) })
        break
    }
    if (f.name !== 'distinct') f.args.forEach(p => out.points.add(p))
  }
  return out
}
