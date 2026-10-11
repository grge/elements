import { parseRules } from './language/parser'
import type { PredicateEntry, UserClause } from './composables/useKB'
import type { GeometryProblem, WitnessModel } from './geometry/constraints'

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
  problem?: GeometryProblem | null,
  /** Space to leave free on the left (e.g. where text lies over the figure). */
  insetLeft = 0,
): RenderTransform | null {
  const coords = witness.coords
  if (!coords.size) return null

  const xs = [...coords.values()].map(([x]) => x)
  const ys = [...coords.values()].map(([, y]) => y)
  // Fit whole circles in view, not just the points they pass through.
  for (const circle of problem?.circles ?? []) {
    const c = coords.get(circle.center)
    const onCircle = [...circle.points].map(p => coords.get(p)).filter((p): p is [number, number] => !!p)
    if (!c || !onCircle.length) continue
    const r = onCircle.reduce((sum, [px, py]) => sum + Math.hypot(px - c[0], py - c[1]), 0) / onCircle.length
    xs.push(c[0] - r, c[0] + r)
    ys.push(c[1] - r, c[1] + r)
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = Math.max(maxX - minX, 1e-3)
  const rangeY = Math.max(maxY - minY, 1e-3)
  const boxWidth = Math.max(40, width - insetLeft - padding * 2)
  const scale = Math.min(boxWidth / rangeX, (height - padding * 2) / rangeY)
  const offsetX = insetLeft + padding + (boxWidth - rangeX * scale) / 2
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
