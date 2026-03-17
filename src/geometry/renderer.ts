/**
 * EL2 Geometry — SVG rendering.
 */

import type { GeometryProblem, WitnessModel } from './constraints'
import type { Plan } from './planner'

export interface RenderOptions {
  width?: number
  height?: number
  padding?: number
  pointRadius?: number
}

export function renderSVG(
  problem: GeometryProblem,
  witness: WitnessModel,
  opts: RenderOptions = {},
  plan?: Plan,
): string {
  const {
    width = 500, height = 500,
    padding = 40,
    pointRadius = 4,
  } = opts

  const coords = witness.coords
  if (!coords.size) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`

  // Compute bounding box and scale transform
  const xs = [...coords.values()].map(([x]) => x)
  const ys = [...coords.values()].map(([, y]) => y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = Math.max(maxX - minX, 1e-3)
  const rangeY = Math.max(maxY - minY, 1e-3)
  const scale = Math.min((width - padding*2) / rangeX, (height - padding*2) / rangeY)
  const offsetX = padding + ((width - padding*2) - rangeX * scale) / 2
  const offsetY = padding + ((height - padding*2) - rangeY * scale) / 2

  function tx(wx: number): number { return offsetX + (wx - minX) * scale }
  function ty(wy: number): number { return offsetY + (wy - minY) * scale }

  const els: string[] = []

  // Draw world-space grid
  const minorStep = 0.5
  const majorEvery = 4
  const worldLeft = minX - offsetX / scale
  const worldRight = minX + (width - offsetX) / scale
  const worldTop = minY - offsetY / scale
  const worldBottom = minY + (height - offsetY) / scale
  const startX = Math.floor(worldLeft / minorStep) * minorStep
  const endX = Math.ceil(worldRight / minorStep) * minorStep
  const startY = Math.floor(worldTop / minorStep) * minorStep
  const endY = Math.ceil(worldBottom / minorStep) * minorStep
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

  // Draw lines (extended to viewport edges)
  for (const line of problem.lines) {
    const pts = [...line.points].map(p => coords.get(p)!)
    if (pts.length < 2) continue
    // Use first two points to define direction, extend in SVG pixel space
    const [p1, p2] = pts
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1]
    const len = Math.sqrt(dx*dx + dy*dy)
    if (len < 1e-9) continue  // degenerate — skip rather than draw a dot
    const ux = dx/len, uy = dy/len  // unit direction in world space
    // Extend by enough SVG pixels to always overshoot the viewport
    const ext = (width + height) / scale
    const x1 = tx(p1[0] - ux * ext), y1 = ty(p1[1] - uy * ext)
    const x2 = tx(p1[0] + ux * ext), y2 = ty(p1[1] + uy * ext)
    els.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#7ec8e3" stroke-width="1.5" opacity="0.7"/>`)
  }

  // Draw circles
  for (const circle of problem.circles) {
    const center = coords.get(circle.center)!
    const pts = [...circle.points].map(p => coords.get(p)!)
    if (!pts.length) continue
    const radii = pts.map(([px, py]) => {
      const dx = px - center[0], dy = py - center[1]
      return Math.sqrt(dx*dx + dy*dy)
    })
    const r = radii.reduce((a,b) => a+b, 0) / radii.length * scale
    els.push(`<circle cx="${f(tx(center[0]))}" cy="${f(ty(center[1]))}" r="${f(r)}" fill="none" stroke="#e0b0ff" stroke-width="1.5" opacity="0.7"/>`)
  }

  // Build point → step index map if plan provided
  const pointStepIndex = new Map<string, number>()
  if (plan) {
    for (let i = 0; i < plan.length; i++) {
      pointStepIndex.set(plan[i].point, i)
    }
  }

  // Draw points
  for (const [name, [wx, wy]] of coords) {
    const x = tx(wx), y = ty(wy)
    els.push(`<circle data-point="${name}" data-wx="${wx}" data-wy="${wy}" cx="${f(x)}" cy="${f(y)}" r="${pointRadius}" fill="#ff6b6b" style="cursor:grab"/>`)
    els.push(`<text x="${f(x+6)}" y="${f(y-6)}" font-family="monospace" font-size="13" fill="#e0e0ff">${name}</text>`)
    
    // Add step number subscript if plan is provided
    if (plan && pointStepIndex.has(name)) {
      const step = pointStepIndex.get(name)!
      els.push(`<text x="${f(x+8)}" y="${f(y+8)}" font-family="monospace" font-size="9" fill="#888888"><tspan baseline-shift="super">${step}</tspan></text>`)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="background:transparent">
${els.join('\n')}
</svg>`
}

function f(n: number): string { return n.toFixed(2) }
