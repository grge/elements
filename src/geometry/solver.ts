/**
 * Numerical solver: finds coordinates satisfying a construction model (construction.ts, the same
 * model the planner builds from) by minimising an energy with Adam gradient descent (analytic
 * gradients, random restarts). Used only when no configuration satisfies every fact with the
 * ruler-and-compass construction.
 */

import type { ConstructionModel } from './construction'
import { RELATIONS } from './relations'

/** Positions for every point, and the energy left (0 when every fact holds). */
export interface WitnessModel {
  coords: Map<string, [number, number]>
  energy: number
}

// ── Types ─────────────────────────────────────────────────────────────

type Coords = Float64Array
type Grad   = Float64Array
type CoordIdx = Map<string, number>  // point name → flat index (x at i, y at i+1)

function idx(i: number): [number, number] { return [i * 2, i * 2 + 1] }
function dist2(x: Coords, i: number, j: number): number {
  const dx = x[i*2]-x[j*2], dy = x[i*2+1]-x[j*2+1]
  return dx*dx + dy*dy
}
function dist(x: Coords, i: number, j: number): number {
  return Math.sqrt(dist2(x, i, j))
}

// ── Analytic energy + gradient ────────────────────────────────────────

/** Add a*v to g[k] (accumulate gradient) */
function addG(g: Grad, k: number, a: number, v: number) { g[k] += a * v }

// Gauge: fix p0=(0,0), p1=(1,0)
function gaugeGrad(x: Coords, g: Grad, pts: string[], cidx: CoordIdx, w = 1e6): number {
  if (pts.length < 2) return 0
  const [p0, p1] = [cidx.get(pts[0])!, cidx.get(pts[1])!]
  const [i0x, i0y] = idx(p0), [i1x, i1y] = idx(p1)
  const e = w*(x[i0x]**2 + x[i0y]**2) + w*(x[i1x]-1)**2 + w*x[i1y]**2
  g[i0x] += 2*w*x[i0x]; g[i0y] += 2*w*x[i0y]
  g[i1x] += 2*w*(x[i1x]-1); g[i1y] += 2*w*x[i1y]
  return e
}

// Triangle area squared: zero iff collinear
function triAreaSq(x: Coords, a: number, b: number, c: number): number {
  const ax=x[b*2]-x[a*2], ay=x[b*2+1]-x[a*2+1]
  const bx=x[c*2]-x[a*2], by=x[c*2+1]-x[a*2+1]
  const cr = ax*by - ay*bx
  return cr*cr
}
function triAreaSqGrad(x: Coords, g: Grad, a: number, b: number, c: number, w: number) {
  const ax=x[b*2]-x[a*2], ay=x[b*2+1]-x[a*2+1]
  const bx=x[c*2]-x[a*2], by=x[c*2+1]-x[a*2+1]
  const cr = ax*by - ay*bx
  const k = 2*w*cr
  // d(cr)/d(each coord):
  g[b*2]   += k * by;   g[b*2+1] += k * (-bx)
  g[c*2]   += k * (-ay); g[c*2+1] += k * ax
  g[a*2]   += k * (ay - by); g[a*2+1] += k * (bx - ax)
}

function collinearGrad(lines: string[][], x: Coords, g: Grad, cidx: CoordIdx, w = 1e4): number {
  let e = 0
  for (const line of lines) {
    const pts = [...line].sort().map(p => cidx.get(p)!)
    if (pts.length < 2) continue
    // Anchor-pair formulation: perpendicular distance from line through pts[0],pts[1]
    // for all other points. O(n) terms, no collapse degeneracy.
    // For the anchor pair itself: use a separation term to keep them apart.
    const [p0, p1] = pts
    // Soft separation between the two anchors (prevent them collapsing)
    const d2 = dist2(x, p0, p1)
    if (d2 < 1.0) {
      const penalty = w * (d2 - 1.0) ** 2
      e += penalty
      if (d2 > 1e-10) {
        const k = 4 * w * (d2 - 1.0)
        g[p0*2]   += k*(x[p0*2]-x[p1*2]);   g[p0*2+1] += k*(x[p0*2+1]-x[p1*2+1])
        g[p1*2]   += k*(x[p1*2]-x[p0*2]);   g[p1*2+1] += k*(x[p1*2+1]-x[p0*2+1])
      }
    }
    // All other points: area of triangle with anchors = 0
    for (let i = 2; i < pts.length; i++) {
      e += w * triAreaSq(x, p0, p1, pts[i])
      triAreaSqGrad(x, g, p0, p1, pts[i], w)
    }
  }
  return e
}

// Equal lengths: within each class of segments, every length is pulled to the class's mean. (The
// derivative of the mean drops out, since the differences from it sum to zero.)
function lengthGrad(classes: [string, string][][], x: Coords, g: Grad, cidx: CoordIdx, w = 1e3): number {
  let e = 0
  for (const cls of classes) {
    const ends = cls.map(([a, b]) => [cidx.get(a)!, cidx.get(b)!] as const)
    const lens = ends.map(([a, b]) => dist(x, a, b))
    const mean = lens.reduce((s, l) => s + l, 0) / lens.length
    ends.forEach(([a, b], i) => {
      const diff = lens[i] - mean
      e += w * diff * diff
      if (lens[i] < 1e-10) return
      const k = 2 * w * diff / lens[i]
      g[a*2]   += k*(x[a*2]-x[b*2]);   g[a*2+1] += k*(x[a*2+1]-x[b*2+1])
      g[b*2]   += k*(x[b*2]-x[a*2]);   g[b*2+1] += k*(x[b*2+1]-x[a*2+1])
    })
  }
  return e
}

function betweenGrad(between: [string, string, string][], x: Coords, g: Grad, cidx: CoordIdx, w = 1e4): number {
  let e = 0
  for (const triple of between) {
    const [ai, bi, ci2] = triple.map(n=>cidx.get(n)!)

    // Collinearity term
    e += w * triAreaSq(x, ai, bi, ci2)
    triAreaSqGrad(x, g, ai, bi, ci2, w)

    // t ∈ (0,1) ordering via dot product
    const acx=x[ci2*2]-x[ai*2], acy=x[ci2*2+1]-x[ai*2+1]
    const abx=x[bi*2]-x[ai*2], aby=x[bi*2+1]-x[ai*2+1]
    const acSq = acx*acx + acy*acy
    if (acSq < 1e-10) continue
    const t = (abx*acx + aby*acy) / acSq

    let dt = 0
    if (t <= 0)      { e += w*t*t;       dt = 2*w*t }
    else if (t >= 1) { e += w*(t-1)**2;  dt = 2*w*(t-1) }

    if (dt !== 0) {
      // d(t)/d(x) — chain rule
      const invAcSq = 1 / acSq
      g[bi*2]   += dt * acx * invAcSq
      g[bi*2+1] += dt * acy * invAcSq
      g[ai*2]   += dt * (-acx - abx + 2*t*acx) * invAcSq
      g[ai*2+1] += dt * (-acy - aby + 2*t*acy) * invAcSq
      g[ci2*2]  += dt * (abx - 2*t*acx) * invAcSq
      g[ci2*2+1]+= dt * (aby - 2*t*acy) * invAcSq
    }
  }
  return e
}

// Equal angles and spreads: energy (difference)², gradient by central differences on the points
// involved (a handful of coordinates per fact).
function measureGrad(cs: ConstructionModel['measures'], x: Coords, g: Grad, cidx: CoordIdx, w = 1e3): number {
  let e = 0
  for (const c of cs) {
    const ids = c.args.map(p => cidx.get(p)!)
    const residualOf = RELATIONS.get(c.name)?.residual
    if (!residualOf) continue
    const residual = () => {
      const r = residualOf(c.args.map(p => { const i = cidx.get(p)!; return [x[i * 2], x[i * 2 + 1]] as [number, number] }))
      return Number.isNaN(r) ? 0 : r
    }
    const r0 = residual()
    e += w * r0 * r0
    const h = 1e-6
    for (const i of new Set(ids)) for (const k of [i * 2, i * 2 + 1]) {
      const v = x[k]
      x[k] = v + h; const rp = residual()
      x[k] = v - h; const rm = residual()
      x[k] = v
      g[k] += w * (rp * rp - rm * rm) / (2 * h)
    }
  }
  return e
}

function separationGrad(x: Coords, g: Grad, constrained: Set<string>, w = 1.0, minSep = 0.3): number {
  // Only penalise pairs that share NO geometric constraint.
  // Points on the same line/circle are allowed to be close.
  const n = x.length / 2; let e = 0
  const minSep2 = minSep * minSep
  for (let i = 0; i < n; i++)
    for (let j = i+1; j < n; j++) {
      if (constrained.has(`${i},${j}`)) continue  // skip geometrically linked pairs
      const d2 = dist2(x, i, j)
      if (d2 > minSep2) continue
      const denom = d2 + 1e-6
      e += w / denom
      const k = -2*w / (denom*denom)
      g[i*2]   += k*(x[i*2]-x[j*2]);   g[i*2+1] += k*(x[i*2+1]-x[j*2+1])
      g[j*2]   += k*(x[j*2]-x[i*2]);   g[j*2+1] += k*(x[j*2+1]-x[i*2+1])
    }
  return e
}

function buildConstrainedPairs(model: ConstructionModel, cidx: CoordIdx): Set<string> {
  const s = new Set<string>()
  const pair = (a: number, b: number) => { const lo=Math.min(a,b), hi=Math.max(a,b); s.add(`${lo},${hi}`) }
  for (const line of model.lines) {
    const pts = line.map(p => cidx.get(p)!)
    for (let i = 0; i < pts.length; i++) for (let j = i+1; j < pts.length; j++) pair(pts[i], pts[j])
  }
  // A segment's ends, and the far ends of equal segments from a shared point (points on a circle).
  for (const cls of model.lengths) {
    for (const [a, b] of cls) pair(cidx.get(a)!, cidx.get(b)!)
    for (const [a, b] of cls) for (const [c, d] of cls) {
      const shared = a === c ? [b, d] : a === d ? [b, c] : b === c ? [a, d] : b === d ? [a, c] : null
      if (shared && shared[0] !== shared[1]) pair(cidx.get(shared[0])!, cidx.get(shared[1])!)
    }
  }
  return s
}

function computeGradient(x: Coords, model: ConstructionModel, pts: string[], cidx: CoordIdx, constrained: Set<string>, pin?: Map<string, [number, number]>): [number, Grad] {
  const g = new Float64Array(x.length)
  // While dragging, the dragged point is held under the pointer (instead of the gauge).
  let e = pin?.size ? pinGrad(x, g, cidx, pin) : gaugeGrad(x, g, pts, cidx)
  e = e
    + collinearGrad(model.lines, x, g, cidx)
    + lengthGrad(model.lengths, x, g, cidx)
    + betweenGrad(model.between, x, g, cidx)
    + measureGrad(model.measures, x, g, cidx)
    + separationGrad(x, g, constrained)
  return [e, g]
}

// ── Adam ──────────────────────────────────────────────────────────────

function pinGrad(x: Coords, g: Grad, cidx: CoordIdx, pin: Map<string, [number, number]>, w = 1e4): number {
  let e = 0
  for (const [p, [px, py]] of pin) {
    const i = cidx.get(p)
    if (i === undefined) continue
    const dx = x[i * 2] - px, dy = x[i * 2 + 1] - py
    e += w * (dx * dx + dy * dy)
    g[i * 2] += 2 * w * dx; g[i * 2 + 1] += 2 * w * dy
  }
  return e
}

/** A seeded generator, so a figure the solver draws is the same every time. */
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

function adam(
  x0: Float64Array,
  model: ConstructionModel,
  pts: string[],
  cidx: CoordIdx,
  constrained: Set<string>,
  steps = 800,
  lr = 0.05,
  pin?: Map<string, [number, number]>,
): { x: Float64Array; energy: number } {
  const x = new Float64Array(x0)
  const m = new Float64Array(x.length)
  const v = new Float64Array(x.length)
  const β1 = 0.9, β2 = 0.999, ε = 1e-8
  let energy = Infinity

  for (let t = 1; t <= steps; t++) {
    const [e, g] = computeGradient(x, model, pts, cidx, constrained, pin)
    energy = e
    for (let i = 0; i < x.length; i++) {
      m[i] = β1*m[i] + (1-β1)*g[i]
      v[i] = β2*v[i] + (1-β2)*g[i]**2
      const mHat = m[i]/(1-β1**t)
      const vHat = v[i]/(1-β2**t)
      x[i] -= lr * mHat / (Math.sqrt(vHat) + ε)
    }
    if (t % 100 === 0 && energy < 1e-4) break
  }

  return { x, energy }
}

// ── Public solver ─────────────────────────────────────────────────────

export function solve(
  model: ConstructionModel,
  maxRestarts = 12,
  warmStart?: Map<string, [number, number]>,
  /** Points to hold where they are (the point being dragged). */
  pin?: Map<string, [number, number]>,
): WitnessModel {
  const random = rng([...model.points].sort().join(' ').split('').reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261))
  const pts = [...model.points].sort()
  const cidx = new Map(pts.map((p, i) => [p, i]))
  const n = pts.length
  const constrained = buildConstrainedPairs(model, cidx)

  let best: { x: Float64Array; energy: number } | null = null

  // If we have warm-start coords for ALL points, try them first as restart 0
  const warmPts = warmStart ? pts.filter(p => warmStart.has(p)) : []
  const hasFullWarm = warmPts.length === n
  const startR = hasFullWarm ? -1 : 0  // -1 = do warm run before random restarts

  for (let r = startR; r < maxRestarts; r++) {
    const x0 = new Float64Array(n * 2)

    if (r < 0) {
      // Warm start: seed all points from previous witness
      for (let i = 0; i < n; i++) {
        const [wx, wy] = warmStart!.get(pts[i])!
        x0[i*2] = wx
        x0[i*2+1] = wy
      }
    } else {
      const radius = 1.5 + r * 0.6
      const angleOffset = r * 0.37
      for (let i = 0; i < n; i++) {
        const θ = (2 * Math.PI * i / n) + angleOffset + (random() - 0.5) * 0.4
        x0[i*2]   = Math.cos(θ) * radius
        x0[i*2+1] = Math.sin(θ) * radius
        // Seed known points from warm start even in random restarts
        if (warmStart?.has(pts[i])) {
          const [wx, wy] = warmStart.get(pts[i])!
          x0[i*2] = wx + (random()-0.5)*0.3
          x0[i*2+1] = wy + (random()-0.5)*0.3
        }
      }
    }

    const steps = n > 6 ? 1200 : 800
    // A warm start continues from where the figure was: a short run, so a drag follows the pointer.
    const result = adam(x0, model, pts, cidx, constrained, r < 0 && pin ? 300 : steps, 0.05, pin)
    if (!best || result.energy < best.energy) best = result
    if (best.energy < 1e-4) break
  }

  const { x, energy } = best!
  const coords = new Map<string, [number, number]>(
    pts.map((p, i) => [p, [x[i*2], x[i*2+1]]])
  )
  return { coords, energy }
}
