/**
 * A figure in screen coordinates: what both the interactive diagram and the contents thumbnails draw.
 * Every element keeps the facts that made it (figure.ts), so the source can bring forward what a
 * fact draws, and the figure can say where an element came from.
 */

import type { Figure } from './figure'
import { segmentKey } from './classes'
import { factKey } from './extraction'
import { RELATIONS } from './relations'
import type { MarkSource } from './marks'
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
  /** Finite straight lines: stated (`between`), an angle's arms, segments marked equal: [x1, y1, x2, y2, level]. */
  segments: number[][]
  /** Tick marks across segments marked equal, one per stroke; equal segments share a number of ticks. */
  ticks: number[][]
  /** Points, each with where its label goes: in the widest gap between what is drawn at it. */
  points: { name: string; x: number; y: number; lx: number; ly: number }[]
  /**
   * Marks drawn as paths: arcs at angles' vertices marking equal angles, as Byrne marks them (equal
   * angles share a number of concentric arcs), arcs of angles drawn as themselves (`supp`), Byrne's
   * square for a right angle, and the arrows along parallel lines (parallels share a number of
   * arrows, all pointing one way). SVG path data, with the level.
   */
  arcs: { d: string; level: number; kind: 'arc' | 'square' | 'arrow' }[]
  /**
   * Triangles marked equal in area, hatched as Byrne colours them: triangles of one area share a
   * hatching (`n`: the first class one way, the second the other, then across and along), so where
   * two areas overlap the hatchings cross. SVG path data, with the level.
   */
  fills: { d: string; n: number; level: number }[]
  /** The loci that placed the touched point, if any (see Helper), in screen coordinates. */
  route: ({ kind: 'line'; x1: number; y1: number; x2: number; y2: number } | { kind: 'circle'; cx: number; cy: number; r: number })[]
  /** Parallel to the arrays above: what made each element, as fact keys (extraction.ts `factKey`). */
  meta: {
    lines: string[][]
    circles: string[][]
    segments: { ends: [string, string]; facts: string[]; mark: { mark: number; member: number } | null }[]
    arcs: { facts: string[]; mark: { mark: number; member: number } | null }[]
    fills: { facts: string[]; mark: { mark: number; member: number } }[]
    /** The segment each tick is on. */
    ticks: number[]
  }
}

/**
 * A locus the construction used to place `point` (in world coordinates): the compass carrying a
 * length, a bisector, a ray at a copied angle (`ray`: only the half from p along d).
 */
export type Helper =
  | { point: string; kind: 'line'; p: Point; d: Point; ray?: boolean }
  | { point: string; kind: 'circle'; c: Point; r: number }

/** The facts behind a known equality: the stated fact, or the facts a lemma matched. */
const factsOf = (s: MarkSource): string[] => s.kind === 'stated' ? [factKey(s.fact)] : s.kind === 'proven' ? s.facts.map(factKey) : []

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
  // Points on screen only: the far end of an arm continued past its vertex, for marking the angle
  // beside an angle (a flipped member of a class of angles, marks.ts).
  const virtual = new Map<string, Point>()
  const at = (p: string): Point | null => { const v = virtual.get(p); if (v) return v; const c = coords.get(p); return c ? [tx(c[0]), ty(c[1])] : null }
  const reach = width + height

  // Depths: the shallowest element is level 0.
  const top = Math.min(
    ...[...figure.lines, ...figure.circles, ...figure.strokes, ...figure.angles].map(e => e.depth),
    ...figure.marks.flatMap(m => m.members.map(x => x.depth)), Infinity)
  const base = Number.isFinite(top) ? top : 0
  const level = (d: number) => Math.max(0, d - base)
  /** How much fainter a line drawn only as the continuation of finite straight lines is. */
  const FAINT = 2

  const meta: Scene['meta'] = { lines: [], circles: [], segments: [], arcs: [], fills: [], ticks: [] }
  const lines: number[][] = []
  for (const line of figure.lines) {
    const pts = line.points.map(at).filter((p): p is Point => !!p)
    if (pts.length < 2) continue
    const [[ax, ay], [bx, by]] = pts
    const len = Math.hypot(bx - ax, by - ay)
    if (len < 1e-9) continue
    const [ux, uy] = [(bx - ax) / len, (by - ay) / len]
    lines.push([ax - ux * reach, ay - uy * reach, ax + ux * reach, ay + uy * reach, level(line.depth) + (line.faint ? FAINT : 0)])
    meta.lines.push(line.facts)
  }

  const circles: number[][] = []
  for (const circle of figure.circles) {
    const c = coords.get(circle.center)
    const pts = circle.points.map(p => coords.get(p)).filter((p): p is Point => !!p)
    if (!c || !pts.length) continue
    const r = pts.reduce((s, p) => s + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / pts.length
    circles.push([tx(c[0]), ty(c[1]), r * t.scale, level(circle.depth)])
    meta.circles.push(circle.facts)
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

  // Finite straight lines, one per pair of points however many things draw it; the shallowest wins.
  const segments: number[][] = []
  const segmentAt = new Map<string, number>()
  const addSegment = (a: string, b: string, lv: number, facts: readonly string[]): number | null => {
    const k = segmentKey(a, b)
    const seen = segmentAt.get(k)
    if (seen !== undefined) {
      segments[seen][4] = Math.min(segments[seen][4], lv)
      for (const f of facts) if (!meta.segments[seen].facts.includes(f)) meta.segments[seen].facts.push(f)
      return seen
    }
    const [p, q] = [at(a), at(b)]
    if (!p || !q || Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) return null
    segments.push([p[0], p[1], q[0], q[1], lv])
    meta.segments.push({ ends: [a, b], facts: [...facts], mark: null })
    segmentAt.set(k, segments.length - 1)
    return segments.length - 1
  }
  for (const s of figure.strokes) addSegment(s.ends[0], s.ends[1], level(s.depth), s.facts)

  const arcs: Scene['arcs'] = []
  /** Arcs at b in angle a-b-c, n concentric ones; or a right angle's square. */
  // Directions (screen angles) taken at each point by what is drawn there, for placing its label.
  const taken = new Map<string, number[]>()
  const claim = (p: string, dir: number) => { let t = taken.get(p); if (!t) taken.set(p, t = []); t.push(dir) }
  const angleAt = (na: string, nb: string, nc: string, n: number, kind: Scene['arcs'][number]['kind'], lv: number, facts: string[], mark: { mark: number; member: number } | null) => {
    const [a, b, c] = [at(na), at(nb), at(nc)]
    if (!a || !b || !c) return
    // An arm continued past the vertex only on screen is drawn after the arcs, just far enough to meet them.
    if (!virtual.has(na)) addSegment(nb, na, lv, facts)
    if (!virtual.has(nc)) addSegment(nb, nc, lv, facts)
    const [ua, uc] = [Math.atan2(a[1] - b[1], a[0] - b[0]), Math.atan2(c[1] - b[1], c[0] - b[0])]
    const reachA = Math.hypot(a[0] - b[0], a[1] - b[1]), reachC = Math.hypot(c[0] - b[0], c[1] - b[1])
    // A mark in the angle claims the direction it points into: a label there would cover it.
    let half = uc - ua
    while (half <= -Math.PI) half += 2 * Math.PI
    while (half > Math.PI) half -= 2 * Math.PI
    claim(nb, ua + half / 2)
    if (kind === 'square') {
      const s = Math.min(tick * 1.6, 0.4 * Math.min(reachA, reachC))
      if (s < 2) return
      const [ex, ey, fx, fy] = [Math.cos(ua) * s, Math.sin(ua) * s, Math.cos(uc) * s, Math.sin(uc) * s]
      arcs.push({ d: `M ${b[0] + ex} ${b[1] + ey} L ${b[0] + ex + fx} ${b[1] + ey + fy} L ${b[0] + fx} ${b[1] + fy}`, level: lv, kind })
      meta.arcs.push({ facts, mark })
      return
    }
    let sweep = uc - ua
    while (sweep <= -Math.PI) sweep += 2 * Math.PI
    while (sweep > Math.PI) sweep -= 2 * Math.PI
    let outer = 0
    for (let i = 0; i < n; i++) {
      const r = Math.min(tick * 2.2 + i * tick * 0.75, 0.45 * Math.min(reachA, reachC))
      if (r < 2) continue
      const p0 = [b[0] + r * Math.cos(ua), b[1] + r * Math.sin(ua)]
      const p1 = [b[0] + r * Math.cos(ua + sweep), b[1] + r * Math.sin(ua + sweep)]
      arcs.push({ d: `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 ${sweep > 0 ? 1 : 0} ${p1[0]} ${p1[1]}`, level: lv, kind })
      meta.arcs.push({ facts, mark })
      outer = r
    }
    // The continued arm, in full ink, from the vertex exactly to the outermost arc.
    for (const [name, u] of [[na, ua], [nc, uc]] as const) {
      if (!virtual.has(name) || outer < 2) continue
      segments.push([b[0], b[1], b[0] + outer * Math.cos(u), b[1] + outer * Math.sin(u), lv])
      meta.segments.push({ ends: [nb, name], facts: [...facts], mark: null })
    }
  }
  // Angles drawn as themselves: a right angle's square.
  for (const a of figure.angles) angleAt(...a.points, 1, a.as, level(a.depth), a.facts, null)

  /**
   * An angle a-b-c as drawn: itself, or (flipped) the angle beside it, between one arm and the other
   * continued past b. Continued along a named point of the figure where there is one (the line is
   * likely drawn there), else past b on screen only, drawn just as far as its arcs. Either arm
   * may be continued: the two angles beside a-b-c are vertical angles, equal.
   */
  const asDrawn = (points: string[], flipped: boolean): [string, string, string] | null => {
    const [na, nb, nc] = points
    if (!flipped) return [na, nb, nc]
    const [a, b, c] = [coords.get(na), coords.get(nb), coords.get(nc)]
    if (!a || !b || !c) return null
    const beyond = (arm: Point): string | null => {
      const u = [arm[0] - b[0], arm[1] - b[1]], len = Math.hypot(u[0], u[1])
      if (len < 1e-12) return null
      for (const [name, p] of coords) {
        if (name === nb) continue
        const v = [p[0] - b[0], p[1] - b[1]], along = (v[0] * u[0] + v[1] * u[1]) / len
        if (along < -1e-6 * len && Math.abs(v[0] * u[1] - v[1] * u[0]) / len < 1e-6 * len) return name
      }
      return null
    }
    const pc = beyond(c)
    if (pc) return [na, nb, pc]
    const pa = beyond(a)
    if (pa) return [pa, nb, nc]
    const far = `\u0002${nc}@${nb}`
    const [sb, sc] = [at(nb)!, at(nc)!]
    virtual.set(far, [2 * sb[0] - sc[0], 2 * sb[1] - sc[1]])
    return [na, nb, far]
  }
  /** An angle on screen up to its arms' order: the same arcs would be drawn twice. */
  const angleKey = ([na, nb, nc]: [string, string, string]) => {
    const [a, b, c] = [at(na)!, at(nb)!, at(nc)!]
    const dir = (p: Point) => Math.round(Math.atan2(p[1] - b[1], p[0] - b[0]) * 1000)
    return `${nb}|${[dir(a), dir(c)].sort((x, y) => x - y).join(',')}`
  }

  // Marks (marks.ts): each class of equal blocks with at least two members on screen (a mark must have
  // something to be equal to), marked as its relation says (relations.ts `classMark`). Classes of
  // equal segments get ticks, one more stroke for each class; classes of equal angles concentric
  // arcs, one more for each class, with their arms drawn as Byrne draws them; classes of parallel
  // lines arrows along their segments, one more for each class; classes of triangles of one area a
  // hatching, a different one for each class, with their sides drawn. Each is as deep as the fact
  // that made it known.
  const visible = (m: { points: string[] }) => m.points.every(p => coords.has(p))
  const ticked: { segment: number; n: number; lv: number }[] = []
  const arrowed: { segment: number; n: number; lv: number; facts: string[]; mark: { mark: number; member: number }; along: Point }[] = []
  const fills: Scene['fills'] = []
  const counts = { ticks: 0, arcs: 0, arrows: 0, hatch: 0 }
  figure.marks.forEach((cls, ci) => {
    const shown = cls.members.map((_, i) => i).filter(i => visible(cls.members[i]))
    // A class the closure knows to be right angles is drawn as squares (its relation's drawing), and
    // then even one member on screen is worth marking.
    const as = cls.as ? RELATIONS.get(cls.as) : undefined
    if (as?.draw) {
      for (const mi of shown) {
        const member = cls.members[mi]
        const facts = [...new Set(cls.edges.filter(e => e.from === mi || e.to === mi).flatMap(e => factsOf(e.source)))]
        as.draw(member.points, {
          angle: (a, b, c, kind) => angleAt(a, b, c, 1, kind, level(member.depth), facts, { mark: ci, member: mi }),
          line: () => {}, segment: () => {}, circle: () => {}, arms: () => {}, sameLength: () => {},
        })
      }
      return
    }
    const kind = RELATIONS.get(cls.name)?.classMark?.as
    if (kind === 'arcs' && cls.k === 3) {
      // Each angle as drawn (a flipped one beside itself), each place once: a class needs two places
      // to be worth marking. Supplements side by side along a line are one place, and need no mark.
      const places = new Map<string, { mi: number; points: [string, string, string] }>()
      for (const mi of shown) {
        const drawn = asDrawn(cls.members[mi].points, !!cls.members[mi].flipped)
        if (!drawn) continue
        const key = angleKey(drawn)
        if (!places.has(key)) places.set(key, { mi, points: drawn })
      }
      if (places.size < 2) return
      const n = ++counts.arcs
      for (const { mi, points } of places.values()) {
        const member = cls.members[mi]
        const facts = [...new Set(cls.edges.filter(e => e.from === mi || e.to === mi).flatMap(e => factsOf(e.source)))]
        angleAt(points[0], points[1], points[2], n, 'arc', level(member.depth), facts, { mark: ci, member: mi })
      }
      return
    }
    if (shown.length < 2 || !kind) return
    if (cls.k !== (kind === 'arcs' || kind === 'hatch' ? 3 : 2)) return
    const n = ++counts[kind]
    // Parallels point one way: the first member's direction on screen, which the others follow.
    let along: Point | null = null
    for (const mi of shown) {
      const member = cls.members[mi]
      const lv = level(member.depth)
      const facts = [...new Set(cls.edges.filter(e => e.from === mi || e.to === mi).flatMap(e => factsOf(e.source)))]
      const mark = { mark: ci, member: mi }
      if (kind === 'arcs') { angleAt(member.points[0], member.points[1], member.points[2], n, 'arc', lv, facts, mark); continue }
      if (kind === 'hatch') {
        const [a, b, c] = member.points
        const ps = [at(a), at(b), at(c)]
        if (ps.some(p => !p)) continue
        addSegment(a, b, lv, facts); addSegment(b, c, lv, facts); addSegment(c, a, lv, facts)
        const [[x1, y1], [x2, y2], [x3, y3]] = ps as Point[]
        fills.push({ d: `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`, n, level: lv })
        meta.fills.push({ facts, mark })
        continue
      }
      const si = addSegment(member.points[0], member.points[1], lv, facts)
      if (si === null) continue
      // A segment says which equal lengths it is one of; its arrows carry their parallels themselves.
      if (kind === 'ticks') { meta.segments[si].mark = mark; ticked.push({ segment: si, n, lv }); continue }
      meta.segments[si].mark ??= mark
      const [x1, y1, x2, y2] = segments[si]
      const len = Math.hypot(x2 - x1, y2 - y1)
      let u: Point = [(x2 - x1) / len, (y2 - y1) / len]
      if (!along) along = u
      else if (u[0] * along[0] + u[1] * along[1] < 0) u = [-u[0], -u[1]]
      arrowed.push({ segment: si, n, lv, facts, mark, along: u })
    }
  })
  const ticks: number[][] = []
  for (const { segment: si, n, lv } of ticked) {
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
  }

  // Arrows: n chevrons along a segment, pointing the class's way, set off its middle (where ticks go)
  // towards where they point, so a side both equal and parallel to another carries both marks clear.
  for (const { segment: si, n, lv, facts, mark, along: [ux, uy] } of arrowed) {
    const [x1, y1, x2, y2] = segments[si]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const size = tick * 0.7, gap = tick * 0.65
    const span = size + (n - 1) * gap
    if (len < span + tick * 3) continue   // too short to carry arrows clear of its ends and ticks
    const shift = Math.min(tick * 1.4 + span / 2, len / 2 - span / 2 - tick * 0.5)
    const [mx, my] = [(x1 + x2) / 2 + ux * shift, (y1 + y2) / 2 + uy * shift]
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap + size / 2
      const [tx2, ty2] = [mx + ux * off, my + uy * off]                     // the tip
      const [bx, by] = [tx2 - ux * size, ty2 - uy * size]                     // back along the line
      const [nx, ny] = [-uy * size * 0.75, ux * size * 0.75]
      arcs.push({ d: `M ${bx + nx} ${by + ny} L ${tx2} ${ty2} L ${bx - nx} ${by - ny}`, level: lv, kind: 'arrow' })
      meta.arcs.push({ facts, mark })
    }
  }

  // Points the figure mentions. A point only the planner's route uses (an auxiliary point inside a
  // definition drawn as itself, such as right's) is not drawn: like the route, it is how, not what.
  const mentioned = new Set([...figure.points, ...figure.marks.flatMap(m => m.members.flatMap(x => x.points))])
  const placed = [...coords].filter(([name]) => mentioned.has(name)).map(([name, [x, y]]) => ({ name, x: tx(x), y: ty(y) }))
  // What passes through each point: segments and lines along it (both ways where it lies partway
  // along), circles along their tangent.
  for (const p of placed) {
    const along = (x1: number, y1: number, x2: number, y2: number, bounded: boolean) => {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy)
      if (L < 1e-9) return
      const t = ((p.x - x1) * dx + (p.y - y1) * dy) / (L * L)
      if (Math.abs((p.x - x1) * dy - (p.y - y1) * dx) / L > 1.5) return
      if (bounded && (t < -0.01 || t > 1.01)) return
      const u = Math.atan2(dy, dx)
      if (!bounded || t > 0.01) claim(p.name, u + Math.PI)
      if (!bounded || t < 0.99) claim(p.name, u)
    }
    for (const sg of segments) along(sg[0], sg[1], sg[2], sg[3], true)
    for (const ln of lines) along(ln[0], ln[1], ln[2], ln[3], false)
    for (const [cx, cy, r] of circles) {
      if (Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) > 1.5) continue
      const n = Math.atan2(p.y - cy, p.x - cx)
      claim(p.name, n + Math.PI / 2); claim(p.name, n - Math.PI / 2)
    }
  }
  const points = placed.map(p => {
    const [ux, uy] = labelDirection(taken.get(p.name) ?? [])
    return { ...p, lx: p.x + LABEL_OFFSET * ux, ly: p.y + LABEL_OFFSET * uy }
  })
  return { lines, circles, segments, ticks, points, arcs, fills, route, meta }
}

/** Which elements of a scene to bring forward: those made by the given facts. */
/** How far a label's centre sits from its point, in pixels. */
const LABEL_OFFSET = 22

/**
 * The direction (a unit vector on screen) for a label: the middle of the widest gap between the
 * directions taken at its point; up and to the right when nothing is drawn there.
 */
function labelDirection(dirs: readonly number[]): [number, number] {
  if (!dirs.length) return [Math.SQRT1_2, -Math.SQRT1_2]
  const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const sorted = dirs.map(norm).sort((a, b) => a - b)
  let best = 0, bestGap = -1
  for (let i = 0; i < sorted.length; i++) {
    const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI
    const gap = next - sorted[i]
    if (gap > bestGap + 1e-9) { bestGap = gap; best = sorted[i] + gap / 2 }
  }
  return [Math.cos(best), Math.sin(best)]
}

export interface Emphasis { lines: Set<number>; circles: Set<number>; segments: Set<number>; arcs: Set<number>; fills: Set<number>; points: Set<string> }

/**
 * What a focus brings forward: elements made by these facts, and marks of these members (keys
 * `class:member`, marks.ts indices: a lemma's marks).
 */
export function emphasise(scene: Scene, facts: readonly GroundPredicate[], points: Iterable<string>, marks: ReadonlySet<string> = new Set()): Emphasis {
  const keys = new Set(facts.map(factKey))
  const hit = (fs: readonly string[]) => fs.some(k => keys.has(k))
  const which = (xs: readonly string[][]) => new Set(xs.flatMap((fs, i) => hit(fs) ? [i] : []))
  const marked = (m: { mark: number; member: number } | null) => !!m && marks.has(`${m.mark}:${m.member}`)
  const either = (xs: readonly { facts: string[]; mark: { mark: number; member: number } | null }[]) =>
    new Set(xs.flatMap((x, i) => hit(x.facts) || marked(x.mark) ? [i] : []))
  return {
    lines: which(scene.meta.lines),
    circles: which(scene.meta.circles),
    segments: either(scene.meta.segments),
    arcs: either(scene.meta.arcs),
    fills: either(scene.meta.fills),
    points: new Set([...points, ...facts.flatMap(f => f.args)]),
  }
}
