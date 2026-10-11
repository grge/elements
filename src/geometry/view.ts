/**
 * Mapping between world coordinates (the figure) and screen coordinates (the SVG).
 */

import type { GeometryProblem, WitnessModel } from './constraints'

export interface RenderTransform {
  minX: number
  minY: number
  scale: number
  offsetX: number
  offsetY: number
}

/** Fit a figure (its points and whole circles) into a viewport, leaving `insetLeft` px free on the left. */
export function computeRenderTransform(
  witness: WitnessModel,
  width = 400,
  height = 400,
  padding = 40,
  problem?: GeometryProblem | null,
  insetLeft = 0,
): RenderTransform | null {
  const coords = witness.coords
  if (!coords.size) return null

  const xs = [...coords.values()].map(([x]) => x)
  const ys = [...coords.values()].map(([, y]) => y)
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

export function screenToWorld(x: number, y: number, t: RenderTransform): [number, number] {
  return [(x - t.offsetX) / t.scale + t.minX, (y - t.offsetY) / t.scale + t.minY]
}
