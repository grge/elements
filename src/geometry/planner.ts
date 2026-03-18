/**
 * EL2 Geometry — A* construction planner.
 * Given a GeometryProblem, produces a construction plan (sequence of ConstructionSteps)
 * with optional witness-based resolution of intersection choices.
 */

import type { GeometryProblem, WitnessModel, Line, Circle } from './constraints'

// ── Types ──────────────────────────────────────────────────────────────

export type ConstructionStep =
  | { kind: 'free'; point: string }
  | { kind: 'point-on-line'; point: string; line: Line }
  | { kind: 'point-on-circle'; point: string; circle: Circle }
  | { kind: 'line-line-intersection'; point: string; l1: Line; l2: Line }
  | { kind: 'circle-circle-intersection'; point: string; c1: Circle; c2: Circle; which: boolean }
  | { kind: 'circle-line-intersection'; point: string; circle: Circle; line: Line; which: boolean }

export type Plan = ConstructionStep[]

export interface PlanResult {
  plan: Plan
  totalDOF: number
}

// ── Planner ────────────────────────────────────────────────────────────

function isLineAvailable(line: Line, placed: Set<string>): boolean {
  return [...line.points].filter(p => placed.has(p)).length >= 2
}

function isCircleAvailable(circle: Circle, placed: Set<string>): boolean {
  return placed.has(circle.center) && [...circle.points].some(p => placed.has(p) && p !== circle.center)
}

interface DOFInfo { dof: number; constraints: (Line | Circle)[] }

function computeDOF(point: string, placed: Set<string>, problem: GeometryProblem): DOFInfo {
  const constraints: (Line | Circle)[] = []
  for (const line of problem.lines) {
    if (line.points.has(point) && isLineAvailable(line, placed)) {
      constraints.push(line)
    }
  }
  for (const circle of problem.circles) {
    if (circle.points.has(point) && isCircleAvailable(circle, placed)) {
      constraints.push(circle)
    }
  }
  return { dof: constraints.length === 0 ? 2 : constraints.length === 1 ? 1 : 0, constraints }
}

function deriveStep(point: string, dof: DOFInfo): ConstructionStep {
  const { constraints } = dof
  if (constraints.length === 0) {
    return { kind: 'free', point }
  } else if (constraints.length === 1) {
    const obj = constraints[0]
    return 'center' in obj ? { kind: 'point-on-circle', point, circle: obj } : { kind: 'point-on-line', point, line: obj }
  } else {
    const lines = constraints.filter((o): o is Line => !('center' in o))
    const circles = constraints.filter((o): o is Circle => 'center' in o)
    if (lines.length === 2) {
      return { kind: 'line-line-intersection', point, l1: lines[0], l2: lines[1] }
    } else if (circles.length === 2) {
      return { kind: 'circle-circle-intersection', point, c1: circles[0], c2: circles[1], which: false }
    } else {
      return { kind: 'circle-line-intersection', point, circle: circles[0], line: lines[0], which: false }
    }
  }
}

export function plan(problem: GeometryProblem, witness?: WitnessModel, timeoutMs: number = 500): PlanResult | null {
  const startTime = Date.now()
  const placed = new Set<string>()
  const steps: ConstructionStep[] = []
  const remaining = new Set(problem.points)

  while (remaining.size > 0) {
    if (Date.now() - startTime > timeoutMs) return null

    // For each unplaced point, compute DOF given currently placed points
    let bestPoint: string | null = null
    let bestDOF = 3

    // First pass: find minimum DOF among all unplaced points
    const candidates: Array<{ point: string; dof: number }> = []
    for (const point of remaining) {
      const dof = computeDOF(point, placed, problem).dof
      candidates.push({ point, dof })
      if (dof < bestDOF) bestDOF = dof
    }

    if (bestDOF === 0) {
      // Take any 0-DOF point
      bestPoint = candidates.find(c => c.dof === 0)!.point
    } else if (bestDOF === 1) {
      // Take any 1-DOF point
      bestPoint = candidates.find(c => c.dof === 1)!.point
    } else {
      // All remaining points are free (DOF=2). Pick the one that appears in the most
      // drawable objects — i.e. the one that, once placed, will unlock the most constraints.
      // "Unlock potential" = number of lines/circles containing this point where
      // placing it would bring the object to exactly 2 points placed (making it available).
      let bestUnlock = -1
      for (const point of remaining) {
        let unlock = 0
        for (const line of problem.lines) {
          if (!line.points.has(point)) continue
          const alreadyPlaced = [...line.points].filter(p => placed.has(p)).length
          if (alreadyPlaced === 1) unlock++  // placing this point makes line available
        }
        for (const circle of problem.circles) {
          if (circle.center === point) {
            // Placing the center unlocks the circle if a radius point is already placed
            const hasRadius = [...circle.points].some(p => placed.has(p))
            if (hasRadius) unlock++
          } else if (circle.points.has(point)) {
            // Placing a radius/target point unlocks circle if center is placed
            if (placed.has(circle.center)) unlock++
          }
        }
        if (unlock > bestUnlock) {
          bestUnlock = unlock
          bestPoint = point
        }
      }
      if (!bestPoint) bestPoint = candidates[0].point
    }

    if (bestPoint === null) return null

    const info = computeDOF(bestPoint, placed, problem)
    const step = deriveStep(bestPoint, info)
    steps.push(step)
    placed.add(bestPoint)
    remaining.delete(bestPoint)
  }

  // Resolve intersection choices from witness
  if (witness) {
    for (const step of steps) {
      if (step.kind === 'circle-circle-intersection') {
        step.which = selectCircleCircle(step.c1, step.c2, step.point, witness)
      } else if (step.kind === 'circle-line-intersection') {
        step.which = selectCircleLine(step.circle, step.line, step.point, witness)
      }
    }
  }

  const totalDOF = steps.reduce((s, st) => s + (st.kind === 'free' ? 2 : st.kind === 'point-on-line' || st.kind === 'point-on-circle' ? 1 : 0), 0)
  return { plan: steps, totalDOF }
}

// ── Intersection choice resolution ─────────────────────────────────────

function selectCircleCircle(c1: Circle, c2: Circle, point: string, witness: WitnessModel): boolean {
  const target = witness.coords.get(point)
  if (!target) return false
  const c1c = witness.coords.get(c1.center), c2c = witness.coords.get(c2.center)
  if (!c1c || !c2c) return false
  const rp1 = [...c1.points].map(p => witness.coords.get(p)).find((p): p is [number,number] => !!p)
  const rp2 = [...c2.points].map(p => witness.coords.get(p)).find((p): p is [number,number] => !!p)
  if (!rp1 || !rp2) return false
  const r1 = Math.hypot(rp1[0]-c1c[0], rp1[1]-c1c[1])
  const r2 = Math.hypot(rp2[0]-c2c[0], rp2[1]-c2c[1])
  const [cx1,cy1] = c1c, [cx2,cy2] = c2c
  const dx = cx2-cx1, dy = cy2-cy1, d = Math.hypot(dx,dy)
  if (d < 1e-12 || d > r1+r2 || d < Math.abs(r1-r2)) return false
  const a = (r1*r1 - r2*r2 + d*d)/(2*d), h2 = r1*r1 - a*a
  if (h2 < 0) return false
  const h = Math.sqrt(h2), px = cx1+(a/d)*dx, py = cy1+(a/d)*dy
  const s1: [number,number] = [px+(h/d)*(-dy), py+(h/d)*dx]
  const s2: [number,number] = [px-(h/d)*(-dy), py-(h/d)*dx]
  const d1 = Math.hypot(s1[0]-target[0], s1[1]-target[1])
  const d2 = Math.hypot(s2[0]-target[0], s2[1]-target[1])
  return d2 < d1
}

function selectCircleLine(circle: Circle, line: Line, point: string, witness: WitnessModel): boolean {
  const target = witness.coords.get(point)
  if (!target) return false
  const center = witness.coords.get(circle.center)
  if (!center) return false
  const linePts = [...line.points].map(p => witness.coords.get(p)).filter((p): p is [number,number] => !!p)
  if (linePts.length < 2) return false
  const rp = [...circle.points].map(p => witness.coords.get(p)).find((p): p is [number,number] => !!p)
  if (!rp) return false
  const [cx,cy] = center, r = Math.hypot(rp[0]-cx, rp[1]-cy)
  const [x1,y1] = linePts[0], [x2,y2] = linePts[1]
  const dx = x2-x1, dy = y2-y1
  const A = dx*dx+dy*dy, B = 2*((x1-cx)*dx+(y1-cy)*dy), C = (x1-cx)**2+(y1-cy)**2-r*r
  const disc = B*B-4*A*C
  if (disc < 0) return false
  const t0 = (-B - Math.sqrt(disc))/(2*A), t1 = (-B + Math.sqrt(disc))/(2*A)
  const s0: [number,number] = [x1+t0*dx, y1+t0*dy]
  const s1: [number,number] = [x1+t1*dx, y1+t1*dy]
  const d0 = Math.hypot(s0[0]-target[0], s0[1]-target[1])
  const d1 = Math.hypot(s1[0]-target[0], s1[1]-target[1])
  return d1 < d0
}

// ── Execution ──────────────────────────────────────────────────────────

function solve2x2(a: number, b: number, e: number, c: number, d: number, f: number): [number, number] | null {
  const det = a * d - b * c
  if (Math.abs(det) < 1e-12) return null
  return [(e * d - b * f) / det, (a * f - e * c) / det]
}

function getLinePoints(line: Line, coords: Map<string, [number, number]>): [[number, number], [number, number]] | null {
  const pts = [...line.points]
    .map(p => coords.get(p))
    .filter((p): p is [number, number] => !!p)
    .slice(0, 2)
  return pts.length === 2 ? [pts[0], pts[1]] : null
}

function lineLineIntersection(l1: Line, l2: Line, coords: Map<string, [number, number]>): [number, number] | null {
  const pts1 = getLinePoints(l1, coords)
  const pts2 = getLinePoints(l2, coords)
  if (!pts1 || !pts2) return null
  const [[x1, y1], [x2, y2]] = pts1
  const [[x3, y3], [x4, y4]] = pts2
  return solve2x2(y2 - y1, -(x2 - x1), (y2 - y1) * x1 - (x2 - x1) * y1,
                  y4 - y3, -(x4 - x3), (y4 - y3) * x3 - (x4 - x3) * y3)
}

function circleCircleIntersection(c1: Circle, c2: Circle, coords: Map<string, [number, number]>, which: boolean): [number, number] | null {
  const c1c = coords.get(c1.center), c2c = coords.get(c2.center)
  if (!c1c || !c2c) return null
  const [cx1, cy1] = c1c, [cx2, cy2] = c2c
  const pts1 = [...c1.points].map(p => coords.get(p)).filter((p): p is [number, number] => !!p)
  const pts2 = [...c2.points].map(p => coords.get(p)).filter((p): p is [number, number] => !!p)
  if (!pts1.length || !pts2.length) return null
  const r1 = Math.hypot(pts1[0][0] - cx1, pts1[0][1] - cy1)
  const r2 = Math.hypot(pts2[0][0] - cx2, pts2[0][1] - cy2)
  const dx = cx2 - cx1, dy = cy2 - cy1, d = Math.hypot(dx, dy)
  if (d < 1e-12 || d > r1 + r2 || d < Math.abs(r1 - r2)) return null
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h2 = r1 * r1 - a * a
  if (h2 < 0) return null
  const h = Math.sqrt(h2), px = cx1 + (a / d) * dx, py = cy1 + (a / d) * dy
  const x1 = px + (h / d) * (-dy), y1 = py + (h / d) * dx
  const x2 = px - (h / d) * (-dy), y2 = py - (h / d) * dx
  return which ? [x2, y2] : [x1, y1]
}

function circleLineIntersection(circle: Circle, line: Line, coords: Map<string, [number, number]>, which: boolean): [number, number] | null {
  const center = coords.get(circle.center)
  const pts = getLinePoints(line, coords)
  if (!center || !pts) return null
  const [cx, cy] = center, [[x1, y1], [x2, y2]] = pts
  const rpts = [...circle.points].map(p => coords.get(p)).filter((p): p is [number, number] => !!p)
  if (!rpts.length) return null
  const r = Math.hypot(rpts[0][0] - cx, rpts[0][1] - cy), dx = x2 - x1, dy = y2 - y1
  const a = dx * dx + dy * dy, b = 2 * ((x1 - cx) * dx + (y1 - cy) * dy), c = (x1 - cx) ** 2 + (y1 - cy) ** 2 - r * r
  const disc = b * b - 4 * a * c
  if (disc < 0) return null
  const t = which ? (-b + Math.sqrt(disc)) / (2 * a) : (-b - Math.sqrt(disc)) / (2 * a)
  return [x1 + t * dx, y1 + t * dy]
}

export function executePlan(plan: Plan, params: number[], problem: GeometryProblem): Map<string, [number, number]> | null {
  const coords = new Map<string, [number, number]>()
  let pi = 0
  for (const step of plan) {
    let pt: [number, number] | null | undefined
    switch (step.kind) {
      case 'free':
        pt = [params[pi++], params[pi++]]
        break
      case 'point-on-line':
        const pts = getLinePoints(step.line, coords)
        if (!pts) return null
        const [[x1, y1], [x2, y2]] = pts
        const t = params[pi++]
        pt = [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
        break
      case 'point-on-circle':
        const cc = coords.get(step.circle.center)
        if (!cc) return null
        const rpts = [...step.circle.points].map(p => coords.get(p)).filter((p): p is [number, number] => !!p)
        if (!rpts.length) return null
        const [cx, cy] = cc
        const r = Math.hypot(rpts[0][0] - cx, rpts[0][1] - cy)
        const theta = params[pi++]
        pt = [cx + r * Math.cos(theta), cy + r * Math.sin(theta)]
        break
      case 'line-line-intersection':
        pt = lineLineIntersection(step.l1, step.l2, coords)
        break
      case 'circle-circle-intersection':
        pt = circleCircleIntersection(step.c1, step.c2, coords, step.which)
        break
      case 'circle-line-intersection':
        pt = circleLineIntersection(step.circle, step.line, coords, step.which)
        break
    }
    if (!pt) return null
    coords.set(step.point, pt)
  }
  return coords
}

// ── Parameter extraction ──────────────────────────────────────────────

export function extractParams(plan: Plan, witness: WitnessModel, problem: GeometryProblem): number[] {
  const params: number[] = []
  for (const step of plan) {
    switch (step.kind) {
      case 'free': {
        const [x, y] = witness.coords.get(step.point) || [0, 0]
        params.push(x, y)
        break
      }
      case 'point-on-line': {
        const [x, y] = witness.coords.get(step.point) || [0, 0]
        const pts = getLinePoints(step.line, witness.coords)
        if (pts) {
          const [[x1, y1], [x2, y2]] = pts
          const d = (x2 - x1) ** 2 + (y2 - y1) ** 2
          const t = d > 1e-10 ? ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / d : 0
          params.push(t)
        } else {
          params.push(0)
        }
        break
      }
      case 'point-on-circle': {
        const [x, y] = witness.coords.get(step.point) || [0, 0]
        const [cx, cy] = witness.coords.get(step.circle.center) || [0, 0]
        params.push(Math.atan2(y - cy, x - cx))
        break
      }
      case 'circle-circle-intersection': {
        const [x, y] = witness.coords.get(step.point) || [0, 0]
        const sol1 = circleCircleIntersection(step.c1, step.c2, witness.coords, false)
        const sol2 = circleCircleIntersection(step.c1, step.c2, witness.coords, true)
        if (sol1 && sol2) {
          const d1 = (sol1[0] - x) ** 2 + (sol1[1] - y) ** 2
          const d2 = (sol2[0] - x) ** 2 + (sol2[1] - y) ** 2
          step.which = d2 < d1
        }
        break
      }
      case 'circle-line-intersection': {
        const [x, y] = witness.coords.get(step.point) || [0, 0]
        const sol1 = circleLineIntersection(step.circle, step.line, witness.coords, false)
        const sol2 = circleLineIntersection(step.circle, step.line, witness.coords, true)
        if (sol1 && sol2) {
          const d1 = (sol1[0] - x) ** 2 + (sol1[1] - y) ** 2
          const d2 = (sol2[0] - x) ** 2 + (sol2[1] - y) ** 2
          step.which = d2 < d1
        }
        break
      }
      case 'line-line-intersection':
        break
    }
  }
  return params
}
