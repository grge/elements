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
 * and from angles, parallels and areas (architecture.md, *From facts to a figure*), among them a right
 * angle's: the perpendicular at its vertex, and the circle on its arms (Thales).
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
 * figure is stable), the valid sample that reads best (`legibility`) is kept and then improved by a
 * short local search; no numerical solver is involved.
 *
 * Background: constructive constraint solving by loci intersection (e.g. Gao & Chou, "Solving geometric
 * constraint systems I/II", 1998); detecting dependencies on witness configurations (Michelucci &
 * Foufou, 2006); the same "each point defined by at most two loci" diagrams as AlphaGeometry (2024).
 */

import type { GroundPredicate } from '../kb/inference'
import { displayName, isAuxiliary } from '../kb/names'
import { angle as angleAt, area as areaOf } from './measure'
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
  /**
   * Right angles, read from the equal angles: an angle equal to the one beside it on a straight line
   * (`eq-angle a v s s v b` with v between a and b, which is how `right` unfolds). `arm` is the
   * shared arm's point, `outer` the two points on the straight line either side of the vertex.
   */
  rights: { vertex: string; arm: string; outer: [string, string] }[]
  /** The facts read, each held to by the drawing (relations.ts `holds`). */
  facts: GroundPredicate[]
}

/**
 * The construction model of some facts. `written`, the points of the facts as the page writes them
 * (`parallel-through a b p q`), come first, in that order: the planner gives freedom to earlier points,
 * so a construction's inputs stay its inputs, rather than whichever points its definition happens to
 * mention first (`copy-angle a b p p b q` mentions p and b before a).
 */
export function buildModel(facts: readonly GroundPredicate[], written: readonly string[] = []): ConstructionModel {
  const points: string[] = []
  const see = (p: string) => { if (!points.includes(p)) points.push(p) }
  const mentioned = new Set(facts.flatMap(f => relationOf(f)?.read ? f.args : []))
  written.filter(p => mentioned.has(p)).forEach(see)
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
    rights: rightAngles(measures, between),
    lines: mergeLines(groups).map(g => order(g.points)),
    lengths: segments.classes().filter(c => c.length >= 2).map(c => c.map(segmentEnds)),
    between,
    distinct,
    measures,
    facts: read,
  }
}

/**
 * The right angles among some equal angles: two angles at one vertex v sharing an arm v-s, whose
 * other arms run either way along one straight line (v between their points). Together they make a
 * straight angle, so each is right.
 */
function rightAngles(measures: ConstructionModel['measures'], between: ConstructionModel['between']): ConstructionModel['rights'] {
  const out: ConstructionModel['rights'] = []
  const straight = (a: string, v: string, b: string) =>
    between.some(([x, y, z]) => y === v && ((x === a && z === b) || (x === b && z === a)))
  for (const m of measures) {
    if (m.name !== 'eq-angle') continue
    const [t1, t2] = [m.args.slice(0, 3), m.args.slice(3)]
    const v = t1[1]
    if (t2[1] !== v) continue
    const ends1 = [t1[0], t1[2]], ends2 = [t2[0], t2[2]]
    const shared = ends1.filter(q => ends2.includes(q))
    if (shared.length !== 1 || shared[0] === v) continue
    const s = shared[0]
    const a = ends1.find(q => q !== s)!, b = ends2.find(q => q !== s)!
    if (a === b || a === v || b === v || !straight(a, v, b)) continue
    out.push({ vertex: v, arm: s, outer: [a, b] })
  }
  return out
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
  /** The line through `through` parallel to the line `to`. */
  | { kind: 'parallel'; through: string; to: [string, string] }
  /**
   * The two lines parallel to `base`, one either side, at the height that gives a triangle on it the
   * area of the triangle `area` (Euclid I.44 applies a given area to a given line).
   */
  | { kind: 'area'; base: [string, string]; area: [string, string, string] }
  /** The circle on `ends` as diameter: where a right angle's vertex is, its arms through the ends (Thales). */
  | { kind: 'thales'; ends: [string, string] }
  /** The line through `at` perpendicular to the line from `at` to `to`. */
  | { kind: 'perpendicular'; at: string; to: string }

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
function lociFor(model: ConstructionModel, p: string, placed: readonly string[], banned?: ReadonlySet<string>, euclid = false): Locus[] {
  const isPlaced = new Set(placed)
  const rank = (q: string) => placed.indexOf(q)
  const out: Locus[] = []
  for (const line of model.lines) {
    if (!line.includes(p)) continue
    const on = line.filter(q => q !== p && isPlaced.has(q)).sort((x, y) => rank(x) - rank(y))
    if (on.length >= 2) out.push({ kind: 'line', through: [on[0], on[1]] })
  }
  // Parallels: p's line is known once its other point and the other line are placed.
  for (const m of model.measures) {
    if (m.name !== 'parallel') continue
    const pairs: [string, string][] = [[m.args[0], m.args[1]], [m.args[2], m.args[3]]]
    for (const [mine, other] of [[pairs[0], pairs[1]], [pairs[1], pairs[0]]]) {
      if (!mine.includes(p) || other.includes(p)) continue
      const through = mine[0] === p ? mine[1] : mine[0]
      if (through === p || !isPlaced.has(through) || !other.every(q => isPlaced.has(q)) || other[0] === other[1]) continue
      // Through a point of the other line, the parallel is that line: placed already as a line locus.
      if (other.includes(through)) continue
      out.push({ kind: 'parallel', through, to: [other[0], other[1]] })
    }
  }
  // Equal areas: p is a corner of one triangle, the rest placed; it is on a parallel to the side
  // opposite it, at the height that makes the area.
  for (const m of model.measures) {
    if (m.name !== 'eq-area') continue
    if (!m.args.every(q => q === p || isPlaced.has(q)) || m.args.filter(q => q === p).length !== 1) continue
    const t1 = m.args.slice(0, 3), t2 = m.args.slice(3)
    const [mine, other] = t1.includes(p) ? [t1, t2] : [t2, t1]
    const base = mine.filter(q => q !== p)
    if (base[0] === base[1]) continue
    out.push({ kind: 'area', base: [base[0], base[1]], area: [other[0], other[1], other[2]] })
  }
  // Right angles: the vertex on the circle on the arms' points (Thales), once both are placed; an arm
  // on the perpendicular at the vertex, once the vertex and the other arm are. The equal angles they
  // come from give a bisector too, once the straight line is placed, which is the same perpendicular.
  for (const r of model.rights) {
    const outer = r.outer.filter(q => isPlaced.has(q)).sort((x, y) => rank(x) - rank(y))[0]
    if (p === r.vertex && isPlaced.has(r.arm) && outer) out.push({ kind: 'thales', ends: [r.arm, outer] })
    else if (p === r.arm && isPlaced.has(r.vertex) && outer) out.push({ kind: 'perpendicular', at: r.vertex, to: outer })
    else if (r.outer.includes(p) && isPlaced.has(r.vertex) && isPlaced.has(r.arm)) out.push({ kind: 'perpendicular', at: r.vertex, to: r.arm })
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
    } else if (occurrences === 2 && m.name === 'eq-angle' && t1[1] !== p && t2[1] !== p && t1[1] !== t2[1]) {
      // Equal base angles: p's angle at u towards v equals its angle at v towards u. Then p is as far
      // from u as from v (I.6): it is on the perpendicular bisector of u-v.
      const [u, v] = [t1[1], t2[1]]
      const other = (t: string[]) => t[0] === p ? t[2] : t[0]
      if (other(t1) === v && other(t2) === u) out.push({ kind: 'bisector', of: [u, v] })
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
      // With Euclid's moves only, the compass opens from the centre itself (the collapsing compass).
      for (const c of others) out.push({ kind: 'circle', center: c, radius: (euclid && complete.find(s => s.includes(c))) || complete[0] })
    } else {
      for (let i = 1; i < others.length; i++) out.push({ kind: 'bisector', of: [others[0], others[i]] })
    }
  }
  // Two straight loci through the same placed point meet only there: the rays of two copied angles
  // at one vertex, a line and a ray from a point on it. They are not two conditions on p but one
  // condition between the angles, which another point must take up; so of such loci only the first
  // counts.
  // The same locus twice (a perpendicular bisector from equal lengths and from equal base angles)
  // is one condition too.
  // Two parallels to one line, through two placed points, never meet (or are one line): they are one
  // condition between the points, not two on p (Playfair).
  const kept: Locus[] = []
  for (const l of out) {
    if (banned?.has(lociKey(p, l))) continue
    if (euclid && !(l.kind === 'line' || (l.kind === 'circle' && l.radius.includes(l.center)))) continue
    const through = pivots(l)
    if (through.length && kept.some(k => pivots(k).some(q => through.includes(q)))) continue
    if (kept.some(k => sameLocus(k, l))) continue
    if (l.kind === 'parallel' && kept.some(k => k.kind === 'parallel' && new Set([...k.to, ...l.to]).size === 2)) continue
    kept.push(l)
  }
  return kept
}

const lociKey = (p: string, l: Locus) => `${p} ${JSON.stringify(l)}`

function sameLocus(a: Locus, b: Locus): boolean {
  if (a.kind === 'bisector' && b.kind === 'bisector') return new Set([...a.of, ...b.of]).size === 2
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The placed points a straight locus always passes through (none for a circle or a perpendicular bisector). */
function pivots(l: Locus): string[] {
  switch (l.kind) {
    case 'line': return [...l.through]
    case 'parallel': return [l.through]
    case 'angle': case 'angle-bisector': return [l.vertex]
    case 'perpendicular': return [l.at]
    default: return []
  }
}

function countEquations(model: ConstructionModel): number {
  return model.lines.reduce((s, l) => s + l.length - 2, 0) + model.lengths.reduce((s, c) => s + c.length - 1, 0)
    + model.measures.filter(m => ['eq-angle', 'supp', 'parallel', 'eq-area'].includes(m.name)).length
}

const DP_LIMIT = 18

/** Where a slider on a ray starts, as a fraction of the arm it was copied along: just off the vertex. */
const RAY_START = 0.02

export interface PlanOptions {
  /** Points that must be free inputs (placed before anything constrains them). */
  free?: string[]
  /**
   * Euclid's moves only: a line through two placed points, a circle about a placed point through
   * another (the collapsing compass), and where they meet, or any point on one. A figure that still
   * draws is a ruler-and-compass construction by its own clauses; one that does not is drawn with
   * the planner's help (carried lengths, copied angles, perpendiculars, parallels, areas).
   */
  euclid?: boolean
}

/**
 * Choose the order of construction. Cost, compared lexicographically and summed over steps:
 *   1. degrees of freedom (= equations not used; every equation used removes one)
 *   2. degrees of freedom given to auxiliary points (inputs should be named points)
 *   3. text position of points given freedom (earlier-mentioned points are the natural inputs)
 * A point with two loci available is placed at once: delaying it can never use more equations.
 */
export function plan(model: ConstructionModel, options: PlanOptions = {}): ConstructionPlan {
  // Two loci can be one curve because of a theorem the planner cannot see from the facts' shapes: a
  // point on a circle about the midpoint of a-c, and the right angle it makes at a and c (Thales).
  // Then they are one condition, not two. Found by carrying the plan out; that locus is set aside for
  // that point and the order chosen again.
  const banned = new Set<string>()
  for (let i = 0; i <= model.points.length; i++) {
    const cp = planOnce(model, options, banned)
    const same = coincidentLocus(cp)
    if (!same || banned.has(same)) return cp
    banned.add(same)
  }
  return planOnce(model, options, banned)
}

/** Samples a plan is tried on for loci that coincide. */
const COINCIDENCE_SAMPLES = 3

/**
 * The key of the second locus of a meet whose two loci are one curve in every sample that reaches it
 * (they always are, so a theorem makes them one), or null.
 */
function coincidentLocus(cp: ConstructionPlan): string | null {
  if (!cp.steps.some(s => s.kind === 'meet')) return null
  const sample = sampler(cp, 11)
  let found: string | null = null
  for (let i = 0; i < COINCIDENCE_SAMPLES; i++) {
    const f = execute(cp, sample()).failure
    if (!f?.coincident) return null
    const step = cp.steps[f.step]
    if (step.kind !== 'meet') return null
    const key = lociKey(step.point, step.loci[1])
    if (found && found !== key) return null
    found = key
  }
  return found
}

function planOnce(model: ConstructionModel, options: PlanOptions, banned: ReadonlySet<string>): ConstructionPlan {
  const pts = model.points
  const n = pts.length
  const forced = (options.free ?? []).filter(p => pts.includes(p))
  const index = new Map(pts.map((p, i) => [p, i]))

  type Cost = [number, number, number]
  const add = (a: Cost, b: Cost): Cost => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const less = (a: Cost, b: Cost) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2]
  const stepCost = (p: string, placed: string[]): Cost => {
    const dof = 2 - Math.min(2, lociFor(model, p, placed, banned, options.euclid).length)
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
      const determined = remaining.find(p => lociFor(model, p, placed, banned, options.euclid).length >= 2)
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
    const loci = lociFor(model, p, order.slice(0, k), banned, options.euclid)
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
  if (locus.kind === 'area') {
    const [u, v] = locus.base.map(g), [a, b, c] = locus.area.map(g)
    const d = sub(v, u), len = Math.hypot(...d)
    if (len < 1e-12) return []
    const h = 2 * Math.abs(areaOf(a, b, c)) / len
    const n: Point = [-d[1] / len * h, d[0] / len * h]
    return h === 0 ? [{ kind: 'line', p: u, d }]
      : [{ kind: 'line', p: [u[0] + n[0], u[1] + n[1]], d }, { kind: 'line', p: [u[0] - n[0], u[1] - n[1]], d }]
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
    case 'angle': case 'angle-bisector': case 'area': return curvesOf(locus, at)[0] ?? null
    case 'line': {
      const [a, b] = locus.through.map(g)
      return dist(a, b) < 1e-12 ? null : { kind: 'line', p: a, d: sub(b, a) }
    }
    case 'parallel': {
      const [a, b] = locus.to.map(g)
      return dist(a, b) < 1e-12 ? null : { kind: 'line', p: g(locus.through), d: sub(b, a) }
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
    case 'thales': {
      const [a, b] = locus.ends.map(g)
      const r = dist(a, b) / 2
      return r < 1e-12 ? null : { kind: 'circle', c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r }
    }
    case 'perpendicular': {
      const v = g(locus.at), d = sub(g(locus.to), v)
      return Math.hypot(...d) < 1e-12 ? null : { kind: 'line', p: v, d: [-d[1], d[0]] }
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
/** A slider's position on its line. Only a line unbounded both ways reads the sign of s. */
/**
 * Where a slider's value puts its point along its line. An order bounds the slider at a point, which
 * it must stay off (`between` is strict: the book's orders come with `distinct`): it stops a little
 * short (ORDER_MARGIN), as a point on a ray stops off its vertex, so a drag past the bound leaves the
 * point beside it, not on it.
 */
function tFromS(s: number, [lo, hi]: [number, number]): number {
  const m = ORDER_MARGIN
  if (isFinite(lo) && isFinite(hi)) return lo + Math.min(1 - m, Math.max(m, Math.abs(s))) * (hi - lo)
  if (isFinite(lo)) return lo + Math.max(m, Math.abs(s))
  if (isFinite(hi)) return hi - Math.max(m, Math.abs(s))
  return s
}

/** How far short of a bounding point a slider stops: of the interval, or of the line's defining length. */
const ORDER_MARGIN = 0.02

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
  /** Where it stopped, and why; `coincident` when the two loci of a meet were one curve. */
  failure?: { step: number; point: string; reason: string; coincident?: boolean }
  /** Facts that do not hold in this drawing. */
  violations: { step: number; what: string }[]
  /**
   * The choices nothing decided (no previous or desired position): at each, the step, how many ways
   * there were and which was taken. A search backtracks over them (`search`).
   */
  decisions: { step: number; ways: number; took: number }[]
}

/** A locus in words, with points as they are shown (`d₁`). */
export function describeLocus(l: Locus): string {
  const n = (ps: readonly string[]) => ps.map(displayName).join('')
  switch (l.kind) {
    case 'line': return `line ${n(l.through)}`
    case 'circle': return `circle about ${displayName(l.center)} with radius ${n(l.radius)}`
    case 'bisector': return `the perpendicular bisector of ${n(l.of)}`
    case 'parallel': return `the parallel to ${n(l.to)} through ${n([l.through])}`
    case 'angle': return `the arm from ${displayName(l.vertex)} at ${l.supplement ? 'the supplement of ' : ''}angle ${n(l.angle)} to ${n([l.vertex, l.from])}`
    case 'angle-bisector': return `the ${l.outer ? 'outer ' : ''}bisector of angle ${n([l.arms[0], l.vertex, l.arms[1]])}`
    case 'area': return `a parallel to ${n(l.base)} at the height that gives the area of ${n(l.area)}`
    case 'thales': return `the circle on ${n(l.ends)}`
    case 'perpendicular': return `the perpendicular to ${n([l.at, l.to])} at ${n([l.at])}`
  }
}

/** A fact as it is shown: `eq-lines a d₁ b c`. */
export function describeFact(f: GroundPredicate): string {
  return `${f.name} ${f.args.map(displayName).join(' ')}`
}

export interface ExecuteOptions {
  /** Previous positions: where the order facts leave a choice of intersection, take the nearest. */
  previous?: Map<string, Point>
  /**
   * Where nothing says which branch to take (no previous or desired position), which way to take at
   * each such choice in turn: of two intersections, of a locus's two curves, or which way a slider runs
   * along a line unbounded both ways. Missing entries take the first way.
   */
  branches?: readonly number[]
  /** Desired positions: choose parameters that put each point as near as possible to these. */
  targets?: Map<string, Point>
  /** Called with the parameters actually used (useful together with `targets`). */
  onParams?: (params: number[]) => void
}

export function execute(cp: ConstructionPlan, params: readonly number[], options: ExecuteOptions = {}): Drawing {
  const at = new Map<string, Point>()
  const violations: Drawing['violations'] = []
  const decisions: Drawing['decisions'] = []
  /** A choice nothing decided: record it, and take the way `branches` says (the first by default). */
  const decide = (step: number, ways: number): number => {
    const took = Math.min(options.branches?.[decisions.length] ?? 0, ways - 1)
    decisions.push({ step, ways, took })
    return took
  }
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
    const fail = (reason: string, coincident?: boolean): Drawing => {
      options.onParams?.(used)
      return { coords: at, failure: { step: k, point: x, reason, ...(coincident ? { coincident } : {}) }, violations, decisions }
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
      const curve = curves.length === 1 ? curves[0]
        : near ? curves.reduce((best, c) => residual(near, c) < residual(near, best) ? c : best)
        : curves[decide(k, curves.length)]
      if (curve.kind === 'line') {
        const found = lineDomain(x, curve, orders, at, tol())
        // A ray's point stays off its vertex: there it would make an angle with an arm of no length.
        const domain: [number, number] = curve.ray ? [Math.max(RAY_START, found.domain[0]), found.domain[1]] : found.domain
        const applied = found.applied
        if (domain[0] > domain[1] + 1e-12) return fail(`no point of ${describeLocus(step.locus)} satisfies its order`)
        decided = applied
        // On a line unbounded both ways, a slider may run either way from its defining point; which
        // is a choice like a branch, unless a position decides it.
        const either = !isFinite(domain[0]) && !isFinite(domain[1]) && !target && !options.previous?.get(x)
        const s = target ? sFromT(dot(sub(target, curve.p), curve.d) / dot(curve.d, curve.d), domain)
          : either && decide(k, 2) === 1 ? -params[pi] : params[pi]
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
      if (same === us.length * vs.length) return fail(`${step.loci.map(describeLocus).join(' and ')} coincide`, true)
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
      // The drawing takes distinct names for distinct points: a meeting point already used is not one.
      const choices = allowed.filter(c => ![...at.keys()].some(q => coincides(c, q)))
      if (choices.length === 0) {
        const taken = [...at.keys()].filter(q => allowed.some(c => coincides(c, q)))
        return fail(`${step.loci.map(describeLocus).join(' and ')} meet only at ${taken.map(displayName).join(', ')}, which ${displayName(x)} must differ from`)
      }
      const near = target ?? options.previous?.get(x)
      pos = near ? choices.reduce((best, c) => dist(c, near) < dist(best, near) ? c : best)
        : choices.length > 1 ? choices[decide(k, choices.length)] : choices[0]
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
  return { coords: at, violations, decisions }
}

/** How far a drawing got: a failure at a later step, or fewer violations, is nearer to a figure. */
const miss = (d: Drawing) => (d.failure ? 1e6 - d.failure.step * 1e3 : 0) + d.violations.length

/** Most branch assignments tried for one set of parameters. */
const MAX_TRIES = 64

/**
 * Carry out a plan, choosing branches by backtracking: take the first way at every choice nothing
 * decides; if a later step fails or a later fact does not hold, go back to the latest choice made at or
 * before that step that has a way left, take the next way, and carry on. A choice can be decided only
 * by facts that mention points placed after it (that the squares of a windmill stand outside the
 * triangle shows only where their lines cross), so the first way is a preference, not a commitment.
 * Deterministic: the same parameters give the same figure. Returns the parameters as used (a slider
 * that ran the other way has its sign flipped) with the drawing, the first that satisfies every fact,
 * or else the one that got furthest.
 */
export function search(cp: ConstructionPlan, params: readonly number[]): { drawing: Drawing; params: number[] } {
  let branches: number[] = []
  let best: { drawing: Drawing; params: number[] } | null = null
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    let used: number[] = []
    const drawing = execute(cp, params, { branches, onParams: p => { used = p } })
    if (!best || miss(drawing) < miss(best.drawing)) best = { drawing, params: used }
    if (good(drawing)) return best
    const failed = drawing.failure?.step ?? Math.min(...drawing.violations.map(v => v.step))
    const ds = drawing.decisions
    let i = ds.length - 1
    while (i >= 0 && (ds[i].step > failed || ds[i].took + 1 >= ds[i].ways)) i--
    if (i < 0) break
    branches = [...ds.slice(0, i).map(d => d.took), ds[i].took + 1]
  }
  return best!
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

/** What a figure draws through its points, from the relation table's `draw` (figure.ts draws the same). */
interface Drawn { segments: [string, string][]; lines: string[][]; circles: { center: string; through: string[] }[] }

function drawnBy(cp: ConstructionPlan): Drawn {
  const out: Drawn = { segments: [], lines: [], circles: [] }
  for (const { fact } of cp.checks) relationOf(fact)?.draw?.(fact.args, {
    line: ps => { out.lines.push([...ps]) },
    segment: (a, c) => { out.segments.push([a, c]) },
    circle: (o, ps) => { out.circles.push({ center: o, through: [...ps] }) },
    angle: (a, b, c) => { out.segments.push([b, a], [b, c]) },
    supplement: () => {},
    sameLength: () => {},
  })
  return out
}

function toSegment(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a), L = dot(ab, ab)
  const t = L > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / L)) : 0
  return dist(p, [a[0] + t * ab[0], a[1] + t * ab[1]])
}

function toLine(p: Point, a: Point, b: Point): number {
  const L = dist(a, b)
  return L > 0 ? Math.abs(cross(sub(b, a), sub(p, a))) / L : dist(p, a)
}

/**
 * How well a drawing reads: its worst near-miss. Relative to its size (the distance across its named
 * points), the nearest that two named points come, or that a named point comes to a segment, line or
 * circle drawn through others without being on it: a figure scores low when points crowd, a triangle
 * is a sliver (a corner close to the opposite side), or a point looks as if it lay on a line or circle
 * it is not on (one that is on it, to rounding, is not near it). And how nearly two drawn lines are
 * equal, parallel or perpendicular without being so: a figure scores low when it looks special, which
 * suggests a relation that is not there. An auxiliary point counts only if something drawn passes
 * through it. A line runs across the page, so a point near it reads less as on it than one near a
 * segment; it counts at half weight.
 */
/** Closer than this (relative to the figure's size), a point is on what it is near. */
const ON = 1e-9
/** How a near-equality (a ratio's logarithm, an angle in radians) trades against crowding. */
const GENERIC = 2

export function legibility(cp: ConstructionPlan, coords: Map<string, Point>, why?: (what: string, score: number) => void): number {
  // The points the figure shows: named ones, and auxiliary ones a drawn line or circle passes through
  // (a right angle's extension point).
  const drawn = drawnBy(cp)
  const onDrawn = new Set([...drawn.segments.flat(), ...drawn.lines.flat(), ...drawn.circles.flatMap(c => [c.center, ...c.through])])
  const named = [...coords.keys()].filter(p => !isAuxiliary(p) || onDrawn.has(p))
  if (named.length < 2) return 1
  const pairs: [string, number][] = []
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++)
    pairs.push([`${named[i]} near ${named[j]}`, dist(coords.get(named[i])!, coords.get(named[j])!)])
  const diam = Math.max(...pairs.map(([, d]) => d))
  if (diam === 0) return 0
  let worst = Infinity
  const visible = new Set(named)
  const shown = (ps: readonly string[]) => ps.every(p => visible.has(p))
  const at = (p: string) => coords.get(p)!
  // Distances count relative to the figure's size; ratios and angles count as they are, at a weight
  // (GENERIC) that trades them against crowding.
  const near = (d: number, what = '') => { if (d > ON * diam) { worst = Math.min(worst, d / diam); why?.(what, d / diam) } }
  const apart = (x: number, what = '') => { if (x > ON) { worst = Math.min(worst, GENERIC * x); why?.(what, GENERIC * x) } }
  for (const [what, d] of pairs) near(d, what)
  for (const p of named) {
    const q = at(p)
    for (const [a, b] of drawn.segments) {
      if (p === a || p === b || !shown([a, b])) continue
      near(toSegment(q, at(a), at(b)), `${p} near ${a}${b}`)
    }
    for (const line of drawn.lines) {
      if (line.includes(p) || !shown(line)) continue
      near(2 * toLine(q, at(line[0]), at(line[line.length - 1])), `${p} near line ${line.join('')}`)
    }
    for (const { center, through } of drawn.circles) {
      if (p === center || through.includes(p) || !shown([center, ...through])) continue
      near(Math.abs(dist(q, at(center)) - dist(at(through[0]), at(center))), `${p} near circle ${center}`)
    }
  }
  // A figure should look like any figure of its facts, not a special one: two finite straight lines
  // nearly but not exactly equal, or nearly but not exactly parallel or perpendicular, suggest a
  // relation that is not there (Euclid's triangle should not look isosceles or right-angled).
  // A line's length is the page's business, so only finite straight lines compare in length.
  const pieces = [
    ...drawn.segments.map(([a, b]) => ({ a, b, finite: true })),
    ...drawn.lines.map(l => ({ a: l[0], b: l[l.length - 1], finite: false })),
  ].filter(({ a, b }) => shown([a, b]))
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const s = pieces[i], t = pieces[j]
    const u = sub(at(s.b), at(s.a)), v = sub(at(t.b), at(t.a))
    const lu = Math.hypot(...u), lv = Math.hypot(...v)
    if (lu === 0 || lv === 0) continue
    const turn = Math.atan2(Math.abs(cross(u, v)), Math.abs(dot(u, v)))   // 0 to π/2
    const pair = `${s.a}${s.b} and ${t.a}${t.b}`
    if (s.finite && t.finite) apart(Math.abs(Math.log(lu / lv)), `${pair} nearly equal`)
    apart(turn, `${pair} nearly parallel`)
    apart(Math.PI / 2 - turn, `${pair} nearly perpendicular`)
  }
  return worst
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
/** Parameters at random, seeded by the plan. Which way a slider runs is a branch (`search`). */
function sampler(cp: ConstructionPlan, seed = 0): () => number[] {
  const random = rng(hash(JSON.stringify(cp.steps)) + seed)
  return () => {
    const out: number[] = []
    for (const step of cp.steps) {
      if (step.kind === 'free') {
        const r = Math.sqrt(random()), a = 2 * Math.PI * random()
        out.push(r * Math.cos(a), r * Math.sin(a))
      } else if (step.kind === 'on') {
        // Slider values: inside an interval, a little way along a ray, or near the defining points. A
        // perpendicular is measured in the length of the arm it stands on, from half to three times it.
        const k = step.locus.kind
        out.push(k === 'circle' || k === 'thales' ? 2 * Math.PI * random() : k === 'perpendicular' ? 0.5 + 2.5 * random() : 0.2 + 0.6 * random())
      }
    }
    return out
  }
}

const good = (d: Drawing) => !d.failure && d.violations.length === 0

/** A fact the plan does not construct, and the point the solver is said to place for it. */
export interface Unconstructed { fact: GroundPredicate; step: number; point: string }

/**
 * The facts a plan does not construct: those that fail in every drawing it completes, over a
 * handful of sampled parameters. A fact the construction guarantees never fails; one it only
 * checks fails almost always (it holds only on a thinner set of parameters than the sampler
 * lands on). Each is said to place the point of its own that the plan places last, preferring a
 * named point to an auxiliary one: `c` in an equiangular triangle, not the auxiliary point of the
 * angle copied at `c`.
 */
export function unconstructed(cp: ConstructionPlan, samples = 12): Unconstructed[] {
  const sample = sampler(cp, 7)
  let failing: Set<string> | undefined
  for (let i = 0, seen = 0; i < samples * 4 && seen < samples; i++) {
    const d = search(cp, sample()).drawing
    if (d.failure) continue
    seen++
    const now = new Set(d.violations.map(v => v.what))
    failing = failing ? new Set([...failing].filter(w => now.has(w))) : now
  }
  if (!failing?.size) return []
  const stepOf = new Map(cp.steps.map((s, k) => [s.point, k]))
  return cp.checks.filter(c => failing!.has(describeFact(c.fact))).map(c => {
    const named = c.fact.args.filter(p => !isAuxiliary(p))
    const pool = named.length ? named : c.fact.args
    const point = pool.reduce((a, b) => (stepOf.get(b) ?? -1) > (stepOf.get(a) ?? -1) ? b : a)
    return { fact: c.fact, step: stepOf.get(point) ?? c.step, point }
  })
}

/**
 * Up to `n` different configurations of a plan that satisfy every fact and are well spread (no two
 * points nearly coincide): the figures on which a claim is tested numerically.
 */
export function configurations(cp: ConstructionPlan, n: number, attempts = 40 * n): Map<string, Point>[] {
  const sample = sampler(cp, 1)
  const out: Map<string, Point>[] = []
  for (let i = 0; i < attempts && out.length < n; i++) {
    const { drawing } = search(cp, sample())
    if (good(drawing) && spread(drawing.coords) >= MIN_SPREAD) out.push(drawing.coords)
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
  // Of drawings that fail, the best is one carried out to the end that misses the fewest facts: the
  // solver starts from it (useWorkspace's solution), so it should place every point it can.
  for (let i = 0; i < (options.attempts ?? 400) && found < 30; i++) {
    const { drawing, params } = search(cp, sample())
    if (!good(drawing)) {
      if (!best || (!best.valid && miss(drawing) < miss(best.drawing))) best = { params, drawing, valid: false }
      continue
    }
    found++
    const score = legibility(cp, drawing.coords)
    if (score > bestScore) { bestScore = score; best = { params, drawing, valid: true } }
  }
  if (best?.valid) return polish(cp, best, bestScore)
  if (best) return best
  const params = sample()
  return { params, drawing: execute(cp, params), valid: false }
}

/** Steps of `polish`, and how far its first steps move a parameter. */
const POLISH_STEPS = 120
const POLISH_REACH = 0.25

/**
 * Improve a valid figure by local search: move every parameter a little at random, keep the move
 * if the figure still satisfies every fact and reads better (`legibility`), and take smaller
 * steps as it goes. Seeded, so the figure is stable. Sampling finds a good region; this finds the
 * good figure in it, where more samples would only find a slightly better region.
 */
function polish(cp: ConstructionPlan, start: Realisation, score: number): Realisation {
  const random = rng(hash(JSON.stringify(cp.steps)) + 3)
  let best = start
  for (let i = 0; i < POLISH_STEPS; i++) {
    const reach = POLISH_REACH * (1 - i / POLISH_STEPS) + 0.01
    const tried = best.params.map(x => x + reach * (random() + random() + random() - 1.5))
    const { drawing, params } = search(cp, tried)
    if (!good(drawing)) continue
    const s = legibility(cp, drawing.coords)
    if (s > score) { score = s; best = { params, drawing, valid: true } }
  }
  return best
}

// ───────────────────────────── dragging ─────────────────────────────

export function draggable(cp: ConstructionPlan, point: string): boolean {
  const step = cp.steps.find(s => s.point === point)
  return !!step && step.kind !== 'meet'
}

/**
 * New parameters after dragging `point` towards `world` (other parameters unchanged). `previous`, the
 * positions as drawn, decides the branches of the points before it: the parameters do not say which
 * of two meeting points was taken, and taking the other would fit the dragged point to the wrong
 * figure (a square re-planned from c has b where two loci meet; its mirror image across c-a puts a-b
 * elsewhere, and d₁, fitted to that line, lands beside b).
 */
export function drag(cp: ConstructionPlan, params: readonly number[], point: string, world: Point, previous?: Map<string, Point>): number[] {
  const k = cp.steps.findIndex(s => s.point === point)
  if (k < 0 || cp.steps[k].kind === 'meet') return [...params]
  // Re-run the construction with the dragged point aimed at `world`; everything placed before it is
  // unchanged, so its parameter is the projection of `world` onto its locus within its allowed range.
  let next: number[] = []
  const targets = new Map<string, Point>([[point, world]])
  const offset = cp.steps.slice(0, k).reduce((s, st) => s + paramCount(st), 0)
  execute(cp, params, { targets, previous, onParams: p => { next = p } })
  const out = [...params]
  for (let i = 0; i < paramCount(cp.steps[k]); i++) if (next[offset + i] !== undefined) out[offset + i] = next[offset + i]
  return out
}
