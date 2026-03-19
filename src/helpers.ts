import { parseRules } from './language/parser'
import type { PredicateEntry, UserClause } from './composables/useKB'
import type { Plan, ConstructionStep } from './geometry/planner'
import type { GeometryProblem, WitnessModel } from './geometry/constraints'

export interface PlannerView {
  steps: any[]
  params: number[]
  dof: number
}

// This belongs in the KB/composable layer or an editing model, not in MainView.
export function findUserClauseForPredicate(predName: string, userClauses: UserClause[]): UserClause | null {
  return userClauses.find(c => {
    try {
      return parseRules(c.source).some(r => r.head.name === predName)
    } catch {
      return false
    }
  }) ?? null
}

export function isPredicateReadOnly(predName: string, predicates: PredicateEntry[]): boolean {
  const pred = predicates.find(p => p.name === predName)
  return pred?.readOnly ?? true
}

export interface RenderTransform {
  minX: number
  minY: number
  scale: number
  offsetX: number
  offsetY: number
}

// This belongs with the renderer or a renderer/UI bridge, not in a Vue component.
export function computeRenderTransform(
  witness: WitnessModel,
  width = 400,
  height = 400,
  padding = 40,
): RenderTransform | null {
  const coords = witness.coords
  if (!coords.size) return null

  const xs = [...coords.values()].map(([x]) => x)
  const ys = [...coords.values()].map(([, y]) => y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = Math.max(maxX - minX, 1e-3)
  const rangeY = Math.max(maxY - minY, 1e-3)
  const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY)
  const offsetX = padding + ((width - padding * 2) - rangeX * scale) / 2
  const offsetY = padding + ((height - padding * 2) - rangeY * scale) / 2

  return { minX, minY, scale, offsetX, offsetY }
}

// This belongs with the renderer or a renderer/UI bridge, not in a Vue component.
export function screenToWorld(
  x: number,
  y: number,
  transform: RenderTransform,
): [number, number] {
  return [
    (x - transform.offsetX) / transform.scale + transform.minX,
    (y - transform.offsetY) / transform.scale + transform.minY,
  ]
}

function stepParamArity(step: ConstructionStep): number {
  switch (step.kind) {
    case 'free':
      return 2
    case 'point-on-line':
    case 'point-on-circle':
      return 1
    default:
      return 0
  }
}

function stepParamOffset(plan: Plan, pointName: string): number | null {
  let offset = 0
  for (const step of plan) {
    if (step.point === pointName) return offset
    offset += stepParamArity(step)
  }
  return null
}

function getLineAnchorPoints(step: Extract<ConstructionStep, { kind: 'point-on-line' }>, coords: Map<string, [number, number]>): [[number, number], [number, number]] | null {
  const pts = [...step.line.points].slice(0, 2).map(p => coords.get(p))
  return pts.length === 2 && pts[0] && pts[1] ? [pts[0], pts[1]] : null
}

export interface PlannerDragResult {
  params: number[]
  draggable: boolean
}

// This belongs with planner/UI interaction semantics, not in a Vue component.
export function dragPlannerPoint(
  plan: Plan,
  params: number[],
  coords: Map<string, [number, number]>,
  pointName: string,
  world: [number, number],
): PlannerDragResult {
  const step = plan.find(s => s.point === pointName)
  if (!step) return { params, draggable: false }

  const offset = stepParamOffset(plan, pointName)
  if (offset === null) return { params, draggable: false }

  const next = [...params]
  const [x, y] = world

  switch (step.kind) {
    case 'free':
      next[offset] = x
      next[offset + 1] = y
      return { params: next, draggable: true }

    case 'point-on-line': {
      const anchors = getLineAnchorPoints(step, coords)
      if (!anchors) return { params, draggable: false }
      const [[x1, y1], [x2, y2]] = anchors
      const dx = x2 - x1
      const dy = y2 - y1
      const d = dx * dx + dy * dy
      const t = d > 1e-10 ? ((x - x1) * dx + (y - y1) * dy) / d : 0
      next[offset] = t
      return { params: next, draggable: true }
    }

    case 'point-on-circle': {
      const center = coords.get(step.circle.center)
      if (!center) return { params, draggable: false }
      next[offset] = Math.atan2(y - center[1], x - center[0])
      return { params: next, draggable: true }
    }

    default:
      return { params, draggable: false }
  }
}

function f(n: number): string { return n.toFixed(2) }

function renderGridElements(transform: RenderTransform, width: number, height: number): string[] {
  const els: string[] = []
  const minorStep = 0.5
  const majorEvery = 4
  const worldLeft = transform.minX - transform.offsetX / transform.scale
  const worldRight = transform.minX + (width - transform.offsetX) / transform.scale
  const worldTop = transform.minY - transform.offsetY / transform.scale
  const worldBottom = transform.minY + (height - transform.offsetY) / transform.scale
  const startX = Math.floor(worldLeft / minorStep) * minorStep
  const endX = Math.ceil(worldRight / minorStep) * minorStep
  const startY = Math.floor(worldTop / minorStep) * minorStep
  const endY = Math.ceil(worldBottom / minorStep) * minorStep
  const tx = (wx: number) => transform.offsetX + (wx - transform.minX) * transform.scale
  const ty = (wy: number) => transform.offsetY + (wy - transform.minY) * transform.scale
  let gxIndex = 0
  for (let gx = startX; gx <= endX + 1e-9; gx += minorStep) {
    const x = tx(gx)
    const major = gxIndex % majorEvery === 0
    els.push(`<line x1="${f(x)}" y1="0" x2="${f(x)}" y2="${height}" stroke="#7ec8e3" stroke-width="1" opacity="${major ? '0.10' : '0.04'}"/>`)
    gxIndex++
  }
  let gyIndex = 0
  for (let gy = startY; gy <= endY + 1e-9; gy += minorStep) {
    const y = ty(gy)
    const major = gyIndex % majorEvery === 0
    els.push(`<line x1="0" y1="${f(y)}" x2="${width}" y2="${f(y)}" stroke="#7ec8e3" stroke-width="1" opacity="${major ? '0.10' : '0.04'}"/>`)
    gyIndex++
  }
  return els
}

function renderLineElements(problem: GeometryProblem, coords: Map<string, [number, number]>, tx: (n: number) => number, ty: (n: number) => number, scale: number, width: number, height: number): string[] {
  const els: string[] = []
  for (const line of problem.lines) {
    const pts = [...line.points].map(p => coords.get(p)!)
    if (pts.length < 2) continue
    const [p1, p2] = pts
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-9) continue
    const ux = dx / len, uy = dy / len
    const ext = (width + height) / scale
    const x1 = tx(p1[0] - ux * ext), y1 = ty(p1[1] - uy * ext)
    const x2 = tx(p1[0] + ux * ext), y2 = ty(p1[1] + uy * ext)
    els.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#7ec8e3" stroke-width="1.5" opacity="0.7"/>`)
  }
  return els
}

function renderCircleElements(problem: GeometryProblem, coords: Map<string, [number, number]>, tx: (n: number) => number, ty: (n: number) => number, scale: number): string[] {
  const els: string[] = []
  for (const circle of problem.circles) {
    const center = coords.get(circle.center)!
    const pts = [...circle.points].map(p => coords.get(p)!)
    if (!pts.length) continue
    const radii = pts.map(([px, py]) => Math.hypot(px - center[0], py - center[1]))
    const r = radii.reduce((a, b) => a + b, 0) / radii.length * scale
    els.push(`<circle cx="${f(tx(center[0]))}" cy="${f(ty(center[1]))}" r="${f(r)}" fill="none" stroke="#e0b0ff" stroke-width="1.5" opacity="0.7"/>`)
  }
  return els
}

// This belongs with the renderer or a renderer/UI bridge, not in a Vue component.
export function renderSVGWithTransform(
  problem: GeometryProblem,
  witness: WitnessModel,
  transform: RenderTransform,
  width = 400,
  height = 400,
  pointRadius = 4,
  plan?: Plan,
): string {
  const coords = witness.coords
  if (!coords.size) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`

  const tx = (wx: number) => transform.offsetX + (wx - transform.minX) * transform.scale
  const ty = (wy: number) => transform.offsetY + (wy - transform.minY) * transform.scale

  const els: string[] = []
  els.push(...renderGridElements(transform, width, height))
  els.push(...renderLineElements(problem, coords, tx, ty, transform.scale, width, height))
  els.push(...renderCircleElements(problem, coords, tx, ty, transform.scale))

  const pointStepIndex = new Map<string, number>()
  if (plan) for (let i = 0; i < plan.length; i++) pointStepIndex.set(plan[i].point, i)

  for (const [name, [wx, wy]] of coords) {
    const x = tx(wx), y = ty(wy)
    els.push(`<circle data-point="${name}" data-wx="${wx}" data-wy="${wy}" cx="${f(x)}" cy="${f(y)}" r="${pointRadius}" fill="#ff6b6b" style="cursor:grab"/>`)
    els.push(`<text x="${f(x + 6)}" y="${f(y - 6)}" font-family="monospace" font-size="13" fill="#e0e0ff">${name}</text>`)
    if (plan && pointStepIndex.has(name)) {
      const step = pointStepIndex.get(name)!
      els.push(`<text x="${f(x + 8)}" y="${f(y + 8)}" font-family="monospace" font-size="9" fill="#888888"><tspan baseline-shift="super">${step}</tspan></text>`)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:transparent">\n${els.join('\n')}\n</svg>`
}
