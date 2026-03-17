/**
 * EL2 Geometry — canonicalization.
 * Port of el2/geometry/canonicalization.py
 */

import type {
  GeometryProblem, CollinearConstraint, OnCircleConstraint, EqualDistConstraint,
  Line, Circle,
} from './constraints'

// ── Union-Find ────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>()
  private rank   = new Map<string, number>()

  find(x: string): string {
    if (!this.parent.has(x)) { this.parent.set(x, x); this.rank.set(x, 0) }
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)!))
    return this.parent.get(x)!
  }

  union(x: string, y: string): void {
    const rx = this.find(x), ry = this.find(y)
    if (rx === ry) return
    const rankX = this.rank.get(rx)!, rankY = this.rank.get(ry)!
    if (rankX < rankY)      this.parent.set(rx, ry)
    else if (rankX > rankY) this.parent.set(ry, rx)
    else { this.parent.set(ry, rx); this.rank.set(rx, rankX + 1) }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function segKey(a: string, b: string): string {
  return [a, b].sort().join('\x1e')
}

// ── Main ──────────────────────────────────────────────────────────────

export function canonicalise(problem: GeometryProblem): void {
  // 1. Build distance equivalence classes from eq-dist constraints
  const distUF = new UnionFind()
  for (const c of problem.constraints) {
    if (c.kind === 'eq-dist') {
      distUF.union(segKey(...c.pair1), segKey(...c.pair2))
    }
  }

  // 2. Merge collinear constraints → Lines (share 2+ points)
  const collinear = problem.constraints.filter(
    (c): c is CollinearConstraint => c.kind === 'collinear'
  )
  if (collinear.length > 0) {
    const groups: Set<string>[] = collinear.map(c => new Set(c.points))
    let merged = true
    while (merged) {
      merged = false
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const shared = [...groups[i]].filter(p => groups[j].has(p))
          if (shared.length >= 2) {
            groups[j].forEach(p => groups[i].add(p))
            groups.splice(j, 1)
            merged = true
            break
          }
        }
        if (merged) break
      }
    }
    for (const pts of groups) {
      if (pts.size >= 2) problem.lines.push({ points: pts })
    }
    problem.constraints = problem.constraints.filter(c => c.kind !== 'collinear')
  }

  // 3. Merge circle constraints → Circles (same center + radius class)
  const onCircle = problem.constraints.filter(
    (c): c is OnCircleConstraint => c.kind === 'on-circle'
  )
  if (onCircle.length > 0) {
    // Map (center, radiusClass) → Set<circumferencePoints>
    const circleMap = new Map<string, Set<string>>()

    for (const c of onCircle) {
      const radiusClass = distUF.find(segKey(c.center, c.radiusPoint))
      const key = `${c.center}\x1e${radiusClass}`
      if (!circleMap.has(key)) circleMap.set(key, new Set())
      circleMap.get(key)!.add(c.radiusPoint)
      circleMap.get(key)!.add(c.targetPoint)
    }

    for (const [key, pts] of circleMap) {
      const center = key.split('\x1e')[0]
      const radiusClass = key.split('\x1e').slice(1).join('\x1e')
      problem.circles.push({ center, points: pts, radiusClass })
    }
    problem.constraints = problem.constraints.filter(c => c.kind !== 'on-circle')
  }
}
