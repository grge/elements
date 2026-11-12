/**
 * Mapping between world coordinates (the figure) and screen coordinates (the SVG).
 */

import type { WitnessModel } from './solver'
import type { Figure } from './figure'

export interface RenderTransform {
  minX: number
  minY: number
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Fit a figure into a viewport. Its points must lie in the region right of `insetLeft` (where text
 * may cover the left of the page); its whole circles must lie within the viewport, so geometry may
 * extend behind the text while the points stay clear of it. The largest scale satisfying both wins.
 */
export function computeRenderTransform(
  witness: WitnessModel,
  width = 400,
  height = 400,
  padding = 40,
  figure?: Figure | null,
  insetLeft = 0,
): RenderTransform | null {
  const coords = witness.coords
  if (!coords.size) return null

  const px = [...coords.values()].map(([x]) => x)
  const py = [...coords.values()].map(([, y]) => y)
  const ax = [...px], ay = [...py]
  for (const circle of figure?.circles ?? []) {
    const c = coords.get(circle.center)
    const onCircle = [...circle.points].map(p => coords.get(p)).filter((p): p is [number, number] => !!p)
    if (!c || !onCircle.length) continue
    const r = onCircle.reduce((sum, [qx, qy]) => sum + Math.hypot(qx - c[0], qy - c[1]), 0) / onCircle.length
    ax.push(c[0] - r, c[0] + r)
    ay.push(c[1] - r, c[1] + r)
  }
  const [pMinX, pMaxX] = [Math.min(...px), Math.max(...px)]
  const [aMinX, aMaxX] = [Math.min(...ax), Math.max(...ax)]
  const [aMinY, aMaxY] = [Math.min(...ay), Math.max(...ay)]

  const left = Math.min(insetLeft, width * 0.6) + padding  // where the points' region starts
  const right = width - padding
  const scale = Math.min(
    Math.max(40, right - left) / Math.max(pMaxX - pMinX, 1e-3),
    Math.max(40, width - 2 * padding) / Math.max(aMaxX - aMinX, 1e-3),
    Math.max(40, height - 2 * padding) / Math.max(aMaxY - aMinY, 1e-3),
  )

  // Horizontal offset: centre the points in their region, as far as the circles allow.
  const lo = Math.max(left - pMinX * scale, padding - aMinX * scale)
  const hi = Math.min(right - pMaxX * scale, right - aMaxX * scale)
  const centred = (left + right) / 2 - ((pMinX + pMaxX) / 2) * scale
  const offsetX = lo <= hi ? Math.min(hi, Math.max(lo, centred)) : (lo + hi) / 2
  const offsetY = height / 2 - ((aMinY + aMaxY) / 2) * scale
  return { minX: 0, minY: 0, scale, offsetX, offsetY }
}

export function screenToWorld(x: number, y: number, t: RenderTransform): [number, number] {
  return [(x - t.offsetX) / t.scale + t.minX, (y - t.offsetY) / t.scale + t.minY]
}
