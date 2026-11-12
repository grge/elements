/**
 * Ruler-and-compass construction planning, execution and dragging.
 *
 * A figure is given by facts the construction model reads (relations.ts). The planner turns them
 * into a straight-line program: each point is either free (2 parameters), on one locus (1 parameter),
 * or where two loci meet (no parameters, a choice of intersection). Loci are built from points
 * already placed:
 *
 *   line      through two placed points of a collinear group
 *   circle    about a placed centre, with the radius of any placed segment of equal length
 *             (the compass carries a length: Euclid I.2 shows this is no stronger than the collapsing compass)
 *   bisector  perpendicular bisector of two placed points the new point is equidistant from
 *
 * Every fact the figure states is a CHECK, evaluated on every frame by the relation table's `holds`. One
 * used to place a point holds by construction; one not used that keeps holding is a dependency (a
 * theorem), and one that fails is reported.
 * Order facts (between) are not equations: they choose which intersection to take, and restrict where
 * a point may slide on a line (the parameter is measured within the allowed interval).
 *
 * The order of construction is chosen by an exact search (dynamic programming over the set of placed
 * points) that maximises the number of equations used, then prefers named points over auxiliary ones as
 * free inputs, and earlier-mentioned points as inputs. Initial parameters are sampled (seeded, so the
 * figure is stable) and the best-spread valid sample is kept; no numerical solver is involved.
 *
 * Background: constructive constraint solving by loci intersection (e.g. Gao & Chou, "Solving geometric
 * constraint systems I/II", 1998); detecting dependencies on witness configurations (Michelucci &
 * Foufou, 2006); the same "each point defined by at most two loci" diagrams as AlphaGeometry (2024).
 */

import type { GroundPredicate } from '../kb/inference'
import { displayName, isAuxiliary } from '../kb/names'
import { angle as angleAt } from './measure'
import { relationOf, type ModelReader } from './relations'
import { UnionFind, mergeLines, segmentKey, segmentEnds } from './classes'

export type Point = [number, number]

// ───────────────────────────── model ─────────────────────────────

export interface ConstructionModel {
  /** Points in order of first mention. */
  points: string[]
  /** Collinear groups with at least three points (two points carry no equation). */
  lines: string[][]
  /** Classes of segments of equal length, each with at least two segments. */
  lengths: [string, string][][]
  between: [string, string, string][]
  /** Pairs of points that must not coincide. */
  distinct: [string, string][]
  /** Equal angles, supplements and equal spreads: some place a point by an angle locus; all are checked. */
  measures: { name: string; args: string[] }[]
  /** The facts read, each held to by the drawing (relations.ts `holds`). */
  facts: GroundPredicate[]
}

export function buildModel(facts: readonly GroundPredicate[]): ConstructionModel {
  const points: string[] = []
  const see = (p: string) => { if (!points.includes(p)) points.push(p) }
  const groups: { points: Set<string>; depth: number }[] = []
  const segments = new UnionFind()
  const between: [string, string, string][] = []
  const distinct: [string, string][] = []
  const measures: { name: string; args: string[] }[] = []

  const equal = (a: string, b: string, c: string, d: string) => {
    if (a !== b && c !== d) segments.union(segmentKey(a, b), segmentKey(c, d))
  }
  const read: GroundPredicate[] = []
  const reader: ModelReader = {
    collinear: pts => { const set = new Set(pts); if (set.size >= 3) groups.push({ points: set, depth: 0 }) },
    equal,
    between: (a, b, c) => { if (new Set([a, b, c]).size === 3) between.push([a, b, c]) },
    distinct: (a, b) => { if (a !== b) distinct.push([a, b]) },
    measure: (name, args) => measures.push({ name, args: [...args] }),
  }

  for (const f of facts) {
    const relation = relationOf(f)
    if (!relation?.read) continue
    f.args.forEach(see)
    relation.read(f.args, reader)
    read.push({ name: f.name, args: [...f.args] })
  }


  // Named points first, then auxiliary ones, each in order of mention.
  points.sort((x, y) => Number(isAuxiliary(x)) - Number(isAuxiliary(y)))
  const order = (pts: Iterable<string>) => [...pts].sort((x, y) => points.indexOf(x) - points.indexOf(y))
  return {
    points,
    lines: mergeLines(groups).map(g => order(g.points)),
    lengths: segments.classes().filter(c => c.length >= 2).map(c => c.map(segmentEnds)),
    between,
    distinct,
    measures,
    facts: read,
  }
}

// ───────────────────────────── loci and plans ─────────────────────────────

export type Locus =
  | { kind: 'line'; through: [string, string] }
  | { kind: 'circle'; center: string; radius: [string, string] }
  | { kind: 'bisector'; of: [string, string] }
  /** The two rays from `vertex` making the angle `angle` (or its supplement) with the ray to `from`. */
  | { kind: 'angle'; vertex: string; from: string; angle: [string, string, string]; supplement: boolean }
  /** The line through `vertex` bisecting the angle between its arms (or the outer bisector). */
  | { kind: 'angle-bisector'; vertex: string; arms: [string, string]; outer: boolean }

export type Step =
  | { kind: 'free'; point: string }
  | { kind: 'on'; point: string; locus: Locus }
  | { kind: 'meet'; point: string; loci: [Locus, Locus] }

/** A fact the drawing is held to, at the step that places its last point. */
export interface Check { step: number; fact: GroundPredicate }

export interface ConstructionPlan {
  steps: Step[]
  /**
   * Every fact the model read, checked at the step that places its last point; one the construction
   * itself guarantees passes. Two kinds also choose: `between` picks the intersection and bounds a
   * slider, `distinct` rules out "the other intersection".
   */
  checks: Check[]
  dof: number
  /** Number of equations the figure states, and how many the plan uses to place points. */
  equations: number
  used: number
}

/** Loci available to point p once the points in `placed` (in this order) are placed. */
function lociFor(model: ConstructionModel, p: string, placed: readonly string[]): Locus[] {
  const isPlaced = new Set(placed)
  const rank = (q: string) => placed.indexOf(q)
  const out: Locus[] = []
  for (const line of model.lines) {
    if (!line.includes(p)) continue
    const on = line.filter(q => q !== p && isPlaced.has(q)).sort((x, y) => rank(x) - rank(y))
    if (on.length >= 2) out.push({ kind: 'line', through: [on[0], on[1]] })
  }
  // Equal angles and supplements: a ray at a known angle from a placed vertex, or a bisector.
  for (const m of model.measures) {
    if (m.name !== 'eq-angle' && m.name !== 'supp') continue
    if (!m.args.every(q => q === p || isPlaced.has(q))) continue
    const t1 = m.args.slice(0, 3), t2 = m.args.slice(3)
    const occurrences = m.args.filter(q => q === p).length
    if (occurrences === 1) {
      const [mine, other] = t1.includes(p) ? [t1, t2] : [t2, t1]
      if (mine[1] === p) continue   // a vertex to be found is not on a ray
      const from = mine[0] === p ? mine[2] : mine[0]
      if (from === mine[1] || other[0] === other[1] || other[2] === other[1]) continue
      // On a line through the vertex the angle is fixed already: the rays would meet that line only
      // at the vertex.
      if (model.lines.some(l => l.includes(p) && l.includes(mine[1]))) continue
      out.push({ kind: 'angle', vertex: mine[1], from, angle: [other[0], other[1], other[2]], supplement: m.name === 'supp' })
    } else if (occurrences === 2 && t1.includes(p) && t2.includes(p) && t1[1] === t2[1] && t1[1] !== p) {
      const a = t1[0] === p ? t1[2] : t1[0], b = t2[0] === p ? t2[2] : t2[0]
      if (a !== b && a !== t1[1] && b !== t1[1]) out.push({ kind: 'angle-bisector', vertex: t1[1], arms: [a, b], outer: m.name === 'supp' })
    }
  }
  for (const cls of model.lengths) {
    const complete = cls.filter(([a, b]) => isPlaced.has(a) && isPlaced.has(b))
    const others = cls
      .filter(([a, b]) => (a === p) !== (b === p))
      .map(([a, b]) => a === p ? b : a)
      .filter(q => isPlaced.has(q))
      .sort((x, y) => rank(x) - rank(y))
    if (complete.length > 0) {
      for (const c of others) out.push({ kind: 'circle', center: c, radius: complete[0] })
    } else {
      for (let i = 1; i < others.length; i++) out.push({ kind: 'bisector', of: [others[0], others[i]] })
    }
  }
  return out
}

function countEquations(model: ConstructionModel): number {
  return model.lines.reduce((s, l) => s + l.length - 2, 0) + model.lengths.reduce((s, c) => s + c.length - 1, 0)
    + model.measures.filter(m => m.name === 'eq-angle' || m.name === 'supp').length
}

const DP_LIMIT = 18

export interface PlanOptions {
  /** Points that must be free inputs (placed before anything constrains them). */
  free?: string[]
}

/**
 * Choose the order of construction. Cost, compared lexicographically and summed over steps:
 *   1. degrees of freedom (= equations not used; every equation used removes one)
 *   2. degrees of freedom given to auxiliary points (inputs should be named points)
 *   3. text position of points given freedom (earlier-mentioned points are the natural inputs)
 * A point with two loci available is placed at once: delaying it can never use more equations.
 */
export function plan(model: ConstructionModel, options: PlanOptions = {}): ConstructionPlan {
  const pts = model.points
  const n = pts.length
  const forced = (options.free ?? []).filter(p => pts.includes(p))
  const index = new Map(pts.map((p, i) => [p, i]))

  type Cost = [number, number, number]
  const add = (a: Cost, b: Cost): Cost => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const less = (a: Cost, b: Cost) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]
  const stepCost = (p: string, placed: string[]): Cost => {
    const dof = 2 - Math.min(2, lociFor(model, p, placed).length)
    return [dof, isAuxiliary(p) ? dof : 0, dof > 0 ? index.get(p)! : 0]
  }

  const order: string[] = [...forced]
  const rest = pts.filter(p => !forced.includes(p))

  if (n <= DP_LIMIT) {
    const memo = new Map<number, { cost: Cost; next: string | null }>()
    const maskOf = (placed: string[]) => placed.reduce((m, p) => m | (1 << index.get(p)!), 0)
    const best = (placed: string[]): { cost: Cost; next: string | null } => {
      const remaining = rest.filter(p => !placed.includes(p))
      if (remaining.length === 0) return { cost: [0, 0, 0], next: null }
      const mask = maskOf(placed)
      const hit = memo.get(mask)
      if (hit) return hit
      const determined = remaining.find(p => lociFor(model, p, placed).length >= 2)
      const candidates = determined ? [determined] : remaining
      let result = { cost: [Infinity, Infinity, Infinity] as Cost, next: null as string | null }
      for (const p of candidates) {
        const c = add(stepCost(p, placed), best([...placed, p]).cost)
        if (less(c, result.cost)) result = { cost: c, next: p }
      }
      memo.set(mask, result)
      return result
    }
    for (let next = best(order).next; next; next = best(order).next) order.push(next)
  } else {
    // Large figures: greedy with the same preferences.
    while (order.length < n) {
      const remaining = rest.filter(p => !order.includes(p))
      remaining.sort((x, y) => {
        const cx = stepCost(x, order), cy = stepCost(y, order)
        return less(cx, cy) ? -1 : less(cy, cx) ? 1 : 0
      })
      order.push(remaining[0])
    }
  }

  // Build the steps with concrete loci. Loci beyond the two that place a point need no checks of
  // their own: they come from the facts, and every fact is checked.
  const steps: Step[] = []
  order.forEach((p, k) => {
    const loci = lociFor(model, p, order.slice(0, k))
    if (loci.length === 0) steps.push({ kind: 'free', point: p })
    else if (loci.length === 1) steps.push({ kind: 'on', point: p, locus: loci[0] })
    else steps.push({ kind: 'meet', point: p, loci: [loci[0], loci[1]] })
  })
  const stepOf = (p: string) => order.indexOf(p)
  const checks = model.facts.map(fact => ({ step: Math.max(...fact.args.map(stepOf)), fact }))
  const dof = steps.reduce((s, st) => s + (st.kind === 'free' ? 2 : st.kind === 'on' ? 1 : 0), 0)
  const equations = countEquations(model)
  return { steps, checks, dof, equations, used: 2 * n - dof }
}

/** Parameters each step takes. */
export function paramCount(step: Step): number {
  return step.kind === 'free' ? 2 : step.kind === 'on' ? 1 : 0
}

// ───────────────────────────── geometry ─────────────────────────────

/** A line, or with `ray` the half of it from p in the direction d; or a circle. */
export type Curve = { kind: 'line'; p: Point; d: Point; ray?: boolean } | { kind: 'circle'; c: Point; r: number }

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1]
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0]
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** A locus as a curve, given the positions of the points it depends on (null if degenerate). */
/** The curve of a locus that `point` is on (or nearest): of an angle's two rays, the one it took. */
export function curveNear(locus: Locus, at: Map<string, Point>, point: Point): Curve | null {
  const cs = curvesOf(locus, at)
  return cs.length ? cs.reduce((best, c) => residual(point, c) < residual(point, best) ? c : best) : null
}

/** A locus as curves (two rays for an angle, one curve otherwise); empty if degenerate. */
export function curvesOf(locus: Locus, at: Map<string, Point>): Curve[] {
  const g = (q: string) => at.get(q)!
  if (locus.kind === 'angle') {
    const v = g(locus.vertex), y = g(locus.from)
    const [a, b, c] = locus.angle.map(g)
    if (dist(v, y) < 1e-12 || dist(a, b) < 1e-12 || dist(c, b) < 1e-12) return []
    const theta = locus.supplement ? Math.PI - angleAt(a, b, c) : angleAt(a, b, c)
    const d = sub(y, v)
    const rot = (t: number): Point => [d[0] * Math.cos(t) - d[1] * Math.sin(t), d[0] * Math.sin(t) + d[1] * Math.cos(t)]
    return [{ kind: 'line', p: v, d: rot(theta), ray: true }, { kind: 'line', p: v, d: rot(-theta), ray: true }]
  }
  if (locus.kind === 'angle-bisector') {
    const v = g(locus.vertex), [a, b] = locus.arms.map(g)
    if (dist(a, v) < 1e-12 || dist(b, v) < 1e-12) return []
    const ua = sub(a, v), ub = sub(b, v)
    const na = Math.hypot(...ua), nb = Math.hypot(...ub)
    const u: Point = [ua[0] / na, ua[1] / na], w: Point = [ub[0] / nb, ub[1] / nb]
    let d: Point = locus.outer ? [u[0] - w[0], u[1] - w[1]] : [u[0] + w[0], u[1] + w[1]]
    if (Math.hypot(...d) < 1e-9) {
      if (locus.outer) return []        // the arms point the same way: no outer bisector
      d = [-u[1], u[0]]                 // a straight angle: the bisector is the perpendicular
    }
    return [{ kind: 'line', p: v, d }]
  }
  const c = curveOf(locus, at)
  return c ? [c] : []
}

export function curveOf(locus: Locus, at: Map<string, Point>): Curve | null {
  const g = (q: string) => at.get(q)!
  switch (locus.kind) {
    case 'angle': case 'angle-bisector': return curvesOf(locus, at)[0] ?? null
    case 'line': {
      const [a, b] = locus.through.map(g)
      return dist(a, b) < 1e-12 ? null : { kind: 'line', p: a, d: sub(b, a) }
    }
    case 'bisector': {
      const [a, b] = locus.of.map(g)
      if (dist(a, b) < 1e-12) return null
      const d = sub(b, a)
      return { kind: 'line', p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: [-d[1], d[0]] }
    }
    case 'circle': {
      const r = dist(g(locus.radius[0]), g(locus.radius[1]))
      return r < 1e-12 ? null : { kind: 'circle', c: g(locus.center), r }
    }
  }
}

function intersect(u: Curve, v: Curve): Point[] | 'same' {
  if (u.kind === 'circle' && v.kind === 'line') return intersect(v, u)
  if (u.kind === 'line' && v.kind === 'line') {
    const den = cross(u.d, v.d)
    if (Math.abs(den) < 1e-12 * Math.hypot(...u.d) * Math.hypot(...v.d)) {
      return Math.abs(cross(sub(v.p, u.p), u.d)) < 1e-9 * Math.hypot(...u.d) ? 'same' : []
    }
    const t = cross(sub(v.p, u.p), v.d) / den
    return [[u.p[0] + t * u.d[0], u.p[1] + t * u.d[1]]]
  }
  if (u.kind === 'line' && v.kind === 'circle') {
    const f = sub(u.p, v.c)
    const a = dot(u.d, u.d), b = 2 * dot(f, u.d), c = dot(f, f) - v.r * v.r
    const disc = b * b - 4 * a * c
    if (disc < -1e-12 * a * v.r * v.r) return []
    const s = Math.sqrt(Math.max(0, disc))
    return [(-b - s) / (2 * a), (-b + s) / (2 * a)].map(t => [u.p[0] + t * u.d[0], u.p[1] + t * u.d[1]] as Point)
  }
  const [c1, c2] = [u as Extract<Curve, { kind: 'circle' }>, v as Extract<Curve, { kind: 'circle' }>]
  const d = dist(c1.c, c2.c)
  if (d < 1e-12) return Math.abs(c1.r - c2.r) < 1e-12 ? 'same' : []
  if (d > c1.r + c2.r + 1e-12 || d < Math.abs(c1.r - c2.r) - 1e-12) return []
  const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a))
  const e = sub(c2.c, c1.c), m: Point = [c1.c[0] + a * e[0] / d, c1.c[1] + a * e[1] / d]
  return [[m[0] - h * e[1] / d, m[1] + h * e[0] / d], [m[0] + h * e[1] / d, m[1] - h * e[0] / d]]
}

function residual(p: Point, curve: Curve): number {
  if (curve.kind === 'circle') return Math.abs(dist(p, curve.c) - curve.r)
  if (curve.ray && dot(sub(p, curve.p), curve.d) < 0) return dist(p, curve.p)
  return Math.abs(cross(sub(p, curve.p), curve.d)) / Math.hypot(...curve.d)
}

/** Is c on the curve's half, if it is a ray? */
function onRay(c: Point, curve: Curve, tol: number): boolean {
  return curve.kind !== 'line' || !curve.ray || dot(sub(c, curve.p), curve.d) >= -tol * Math.hypot(...curve.d)
}

function isBetween(a: Point, b: Point, c: Point, tol: number): boolean {
  const ac = sub(c, a), L = Math.hypot(...ac)
  if (L < tol) return dist(a, b) < tol
  if (Math.abs(cross(sub(b, a), ac)) / L > tol) return false
  const t = dot(sub(b, a), ac) / (L * L)
  return t >= -tol / L && t <= 1 + tol / L
}

/**
 * Where on a line (as a parameter t, point = p + t d) the order facts allow point `x` to be. Returns the
 * interval and the order facts it accounts for (those whose other two points lie on the line).
 */
function lineDomain(x: string, curve: Extract<Curve, { kind: 'line' }>, orders: Check[], at: Map<string, Point>, tol: number): { domain: [number, number]; applied: Set<Check> } {
  let lo = -Infinity, hi = Infinity
  const applied = new Set<Check>()
  const tOf = (q: Point) => dot(sub(q, curve.p), curve.d) / dot(curve.d, curve.d)
  for (const order of orders) {
    const [a, b, c] = order.fact.args
    const others = [a, b, c].filter(q => q !== x)
    if (others.length !== 2 || others.some(q => !at.has(q))) continue
    if (others.some(q => residual(at.get(q)!, curve) > tol)) continue  // not on this line: a check instead
    const [tA, tB, tC] = [a, b, c].map(q => q === x ? NaN : tOf(at.get(q)!))
    let range: [number, number]
    if (x === b) range = [Math.min(tA, tC), Math.max(tA, tC)]
    else if (x === a) range = tC >= tB ? [-Infinity, tB] : [tB, Infinity]   // a beyond b, away from c
    else range = tA <= tB ? [tB, Infinity] : [-Infinity, tB]                // c beyond b, away from a
    lo = Math.max(lo, range[0]); hi = Math.min(hi, range[1])
    applied.add(order)
  }
  return { domain: [lo, hi], applied }
}

/** Map a slider parameter s to a position t within [lo, hi] (s in [0,1] if bounded, s >= 0 if a ray). */
function tFromS(s: number, [lo, hi]: [number, number]): number {
  if (isFinite(lo) && isFinite(hi)) return lo + Math.min(1, Math.max(0, s)) * (hi - lo)
  if (isFinite(lo)) return lo + Math.max(0, s)
  if (isFinite(hi)) return hi - Math.max(0, s)
  return s
}

function sFromT(t: number, [lo, hi]: [number, number]): number {
  if (isFinite(lo) && isFinite(hi)) return hi > lo ? Math.min(1, Math.max(0, (t - lo) / (hi - lo))) : 0
  if (isFinite(lo)) return Math.max(0, t - lo)
  if (isFinite(hi)) return Math.max(0, hi - t)
  return t
}

// ───────────────────────────── execution ─────────────────────────────

export interface Drawing {
  coords: Map<string, Point>
  /** The construction cannot be carried out from here on (e.g. two circles do not meet). */
  failure?: { step: number; point: string; reason: string }
  /** Facts that do not hold in this drawing. */
  violations: { step: number; what: string }[]
}

/** A locus in words, with points as they are shown (`d₁`). */
export function describeLocus(l: Locus): string {
  const n = (ps: readonly string[]) => ps.map(displayName).join('')
  switch (l.kind) {
    case 'line': return `line ${n(l.through)}`
    case 'circle': return `circle about ${displayName(l.center)} with radius ${n(l.radius)}`
    case 'bisector': return `the perpendicular bisector of ${n(l.of)}`
    case 'angle': return `the arm from ${displayName(l.vertex)} at ${l.supplement ? 'the supplement of ' : ''}angle ${n(l.angle)} to ${n([l.vertex, l.from])}`
    case 'angle-bisector': return `the ${l.outer ? 'outer ' : ''}bisector of angle ${n([l.arms[0], l.vertex, l.arms[1]])}`
  }
}

/** A fact as it is shown: `eq-lines a d₁ b c`. */
export function describeFact(f: GroundPredicate): string {
  return `${f.name} ${f.args.map(displayName).join(' ')}`
}

export interface ExecuteOptions {
  /** Previous positions: where the order facts leave a choice of intersection, take the nearest. */
  previous?: Map<string, Point>
  /** Desired positions: choose parameters that put each point as near as possible to these. */
  targets?: Map<string, Point>
  /** Called with the parameters actually used (useful together with `targets`). */
  onParams?: (params: number[]) => void
}

export function execute(cp: ConstructionPlan, params: readonly number[], options: ExecuteOptions = {}): Drawing {
  const at = new Map<string, Point>()
  const violations: Drawing['violations'] = []
  const used: number[] = []
  let pi = 0
  let scale = 1e-9
  const tol = () => 1e-7 * Math.max(1, scale)

  for (let k = 0; k < cp.steps.length; k++) {
    const step = cp.steps[k]
    const x = step.point
    const here = cp.checks.filter(c => c.step === k)
    const orders = here.filter(c => c.fact.name === 'between' && new Set(c.fact.args).size === 3)
    const target = options.targets?.get(x)
    let pos: Point | null = null
    let decided = new Set<Check>()   // order facts the construction itself guarantees
    const fail = (reason: string): Drawing => {
      options.onParams?.(used)
      return { coords: at, failure: { step: k, point: x, reason }, violations }
    }

    if (step.kind === 'free') {
      pos = target ? [...target] : [params[pi], params[pi + 1]]
      used.push(pos[0], pos[1]); pi += 2
    } else if (step.kind === 'on') {
      // A locus of two rays (an angle) takes the one nearest where the point is wanted or was; a fresh
      // figure takes the first.
      const curves = curvesOf(step.locus, at)
      if (!curves.length) return fail(`${describeLocus(step.locus)} is degenerate`)
      const near = target ?? options.previous?.get(x)
      const curve = near && curves.length > 1
        ? curves.reduce((best, c) => residual(near, c) < residual(near, best) ? c : best)
        : curves[0]
      if (curve.kind === 'line') {
        const found = lineDomain(x, curve, orders, at, tol())
        const domain: [number, number] = curve.ray ? [Math.max(0, found.domain[0]), found.domain[1]] : found.domain
        const applied = found.applied
        if (domain[0] > domain[1] + 1e-12) return fail(`no point of ${describeLocus(step.locus)} satisfies its order`)
        decided = applied
        const s = target ? sFromT(dot(sub(target, curve.p), curve.d) / dot(curve.d, curve.d), domain) : params[pi]
        const t = tFromS(s, domain)
        pos = [curve.p[0] + t * curve.d[0], curve.p[1] + t * curve.d[1]]
        used.push(s)
      } else {
        const theta = target ? Math.atan2(target[1] - curve.c[1], target[0] - curve.c[0]) : params[pi]
        pos = [curve.c[0] + curve.r * Math.cos(theta), curve.c[1] + curve.r * Math.sin(theta)]
        used.push(theta)
      }
      pi += 1
    } else {
      const [us, vs] = step.loci.map(l => curvesOf(l, at))
      if (!us.length || !vs.length) return fail(`a locus of ${displayName(x)} is degenerate`)
      // Every pair of curves (an angle's locus is two rays); a point on a ray must be on its half.
      const found: Point[] = []
      let same = 0
      for (const u of us) for (const v of vs) {
        const f = intersect(u, v)
        if (f === 'same') { same++; continue }
        found.push(...f.filter(c => onRay(c, u, tol()) && onRay(c, v, tol())))
      }
      if (same === us.length * vs.length) return fail(`${step.loci.map(describeLocus).join(' and ')} coincide`)
      if (found.length === 0) return fail(`${step.loci.map(describeLocus).join(' and ')} do not meet`)
      const ok = found.filter(c => {
        at.set(x, c)
        const good = orders.every(({ fact: { args: [a, b, d] } }) => isBetween(at.get(a)!, at.get(b)!, at.get(d)!, tol()))
        at.delete(x)
        return good
      })
      if (ok.length === 0) return fail(`neither meeting point of ${step.loci.map(describeLocus).join(' and ')} satisfies ${orders.map(o => describeFact(o.fact)).join(', ')}`)
      decided = new Set(orders)
      // "The other intersection": a meeting point on a point x must differ from is ruled out.
      const coincides = (c: Point, q: string) => dist(c, at.get(q)!) <= tol()
      const apart = here.filter(c => c.fact.name === 'distinct' && c.fact.args.includes(x))
        .map(({ fact: { args: [p, q] } }) => p === x ? q : p).filter(q => q !== x)
      const allowed = ok.filter(c => apart.every(q => !coincides(c, q)))
      if (allowed.length === 0) return fail(`where ${step.loci.map(describeLocus).join(' and ')} meet is ${apart.map(displayName).join(', ')}, which ${displayName(x)} must differ from`)
      // The drawing takes distinct names for distinct points: prefer a meeting point not already used.
      const unused = allowed.filter(c => ![...at.keys()].some(q => coincides(c, q)))
      const choices = unused.length ? unused : allowed
      const near = target ?? options.previous?.get(x)
      pos = near ? choices.reduce((best, c) => dist(c, near) < dist(best, near) ? c : best) : choices[0]
    }

    at.set(x, pos)
    scale = Math.max(scale, Math.abs(pos[0]), Math.abs(pos[1]))

    // Every fact whose last point is now placed, except the orders the construction decided.
    for (const c of here) {
      if (decided.has(c)) continue
      if (!relationOf(c.fact)!.holds(c.fact.args.map(p => at.get(p)!), tol())) violations.push({ step: k, what: describeFact(c.fact) })
    }
  }
  options.onParams?.(used)
  return { coords: at, violations }
}

// ───────────────────────────── initial parameters ─────────────────────────────

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Below this spread, distinct points look like one. */
const MIN_SPREAD = 0.02

/** How well spread a drawing is: smallest distance between points relative to its size. */
function spread(coords: Map<string, Point>): number {
  const ps = [...coords.values()]
  if (ps.length < 2) return 1
  let min = Infinity, diam = 0
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const d = dist(ps[i], ps[j]); min = Math.min(min, d); diam = Math.max(diam, d)
  }
  return diam > 0 ? min / diam : 0
}

export interface Realisation {
  params: number[]
  drawing: Drawing
  /** False if no sample satisfied every fact: the figure may not be constructible this way. */
  valid: boolean
}

/**
 * Find parameters for a plan: first try to keep `previous` positions (so edits do not scramble the
 * figure), otherwise sample (seeded by the plan, so the result is stable) and keep the best-spread
 * sample that satisfies every fact.
 */
/** Random parameters for a plan, from a seeded generator (so a figure is stable). */
function sampler(cp: ConstructionPlan, seed = 0): () => number[] {
  const random = rng(hash(JSON.stringify(cp.steps)) + seed)
  return () => {
    const out: number[] = []
    for (const step of cp.steps) {
      if (step.kind === 'free') {
        const r = Math.sqrt(random()), a = 2 * Math.PI * random()
        out.push(r * Math.cos(a), r * Math.sin(a))
      } else if (step.kind === 'on') {
        // Slider values: inside an interval, a little way along a ray, or near the defining points.
        out.push(step.locus.kind === 'circle' ? 2 * Math.PI * random() : 0.2 + 0.6 * random())
      }
    }
    return out
  }
}

const good = (d: Drawing) => !d.failure && d.violations.length === 0

/**
 * Up to `n` different configurations of a plan that satisfy every fact and are well spread (no two
 * points nearly coincide): the figures on which a claim is tested numerically.
 */
export function configurations(cp: ConstructionPlan, n: number, attempts = 40 * n): Map<string, Point>[] {
  const sample = sampler(cp, 1)
  const out: Map<string, Point>[] = []
  for (let i = 0; i < attempts && out.length < n; i++) {
    const d = execute(cp, sample())
    if (good(d) && spread(d.coords) >= MIN_SPREAD) out.push(d.coords)
  }
  return out
}

export function realise(cp: ConstructionPlan, options: { previous?: Map<string, Point>; attempts?: number } = {}): Realisation {
  const counts = cp.steps.map(paramCount)
  const total = counts.reduce((a, b) => a + b, 0)
  const sample = sampler(cp)

  if (options.previous && options.previous.size > 0) {
    let params: number[] = []
    const fill = sample()
    const d = execute(cp, fill, { targets: options.previous, onParams: p => { params = p } })
    // Old positions can make new points coincide (e.g. an old point where a new auxiliary point lands).
    if (good(d) && params.length === total && spread(d.coords) >= MIN_SPREAD) return { params, drawing: d, valid: true }
  }

  let best: Realisation | null = null
  let bestScore = -Infinity, found = 0
  for (let i = 0; i < (options.attempts ?? 400) && found < 30; i++) {
    const params = sample()
    const drawing = execute(cp, params)
    if (!good(drawing)) {
      if (!best) best = { params, drawing, valid: false }
      continue
    }
    found++
    const score = spread(drawing.coords)
    if (score > bestScore) { bestScore = score; best = { params, drawing, valid: true } }
  }
  if (best) return best
  const params = sample()
  return { params, drawing: execute(cp, params), valid: false }
}

// ───────────────────────────── dragging ─────────────────────────────

export function draggable(cp: ConstructionPlan, point: string): boolean {
  const step = cp.steps.find(s => s.point === point)
  return !!step && step.kind !== 'meet'
}

/** New parameters after dragging `point` towards `world` (other parameters unchanged). */
export function drag(cp: ConstructionPlan, params: readonly number[], point: string, world: Point): number[] {
  const k = cp.steps.findIndex(s => s.point === point)
  if (k < 0 || cp.steps[k].kind === 'meet') return [...params]
  // Re-run the construction with the dragged point aimed at `world`; everything placed before it is
  // unchanged, so its parameter is the projection of `world` onto its locus within its allowed range.
  let next: number[] = []
  const targets = new Map<string, Point>([[point, world]])
  const offset = cp.steps.slice(0, k).reduce((s, st) => s + paramCount(st), 0)
  execute(cp, params, { targets, onParams: p => { next = p } })
  const out = [...params]
  for (let i = 0; i < paramCount(cp.steps[k]); i++) if (next[offset + i] !== undefined) out[offset + i] = next[offset + i]
  return out
}
