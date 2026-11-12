/**
 * Measures the drawing layer can check but not yet construct: angles and spreads.
 *
 *   eq-angle a b c d e f       angle a-b-c (vertex b, unsigned, 0 to π) equals angle d-e-f
 *   eq-spread a b c d e f g h  the spread between lines a-b and c-d equals that between e-f and g-h
 *   supp a b c d e f           angles a-b-c and d-e-f together make a straight angle
 *
 * The spread between two lines is Wildberger's: the squared cross product of their directions over
 * the product of their squared lengths, in effect sin² of the angle between them. It does not tell an
 * angle from its supplement, and needs no square root or trigonometry.
 */

export type Point = [number, number]

export const MEASURED = new Set(['eq-angle', 'eq-spread', 'supp'])

export function angle(a: Point, b: Point, c: Point): number {
  const u = [a[0] - b[0], a[1] - b[1]], v = [c[0] - b[0], c[1] - b[1]]
  return Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1])
}

export function spread(a: Point, b: Point, c: Point, d: Point): number {
  const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - c[0], d[1] - c[1]]
  const cross = u[0] * v[1] - u[1] * v[0]
  const q = (u[0] * u[0] + u[1] * u[1]) * (v[0] * v[0] + v[1] * v[1])
  return q === 0 ? NaN : (cross * cross) / q
}

/**
 * How far a measured fact is from holding (0 when it holds): a difference of angles in radians, or of
 * spreads. NaN when a point is missing or a line or arm has no length.
 */
export function measureResidual(name: string, args: readonly string[], at: (p: string) => Point | undefined): number {
  const ps = args.map(at)
  if (ps.some(p => !p)) return NaN
  const P = ps as Point[]
  if (name === 'eq-angle') {
    const degenerate = (a: Point, b: Point, c: Point) => same(a, b) || same(c, b)
    if (degenerate(P[0], P[1], P[2]) || degenerate(P[3], P[4], P[5])) return NaN
    return Math.abs(angle(P[0], P[1], P[2]) - angle(P[3], P[4], P[5]))
  }
  if (name === 'supp') {
    if (same(P[0], P[1]) || same(P[2], P[1]) || same(P[3], P[4]) || same(P[5], P[4])) return NaN
    return Math.abs(angle(P[0], P[1], P[2]) + angle(P[3], P[4], P[5]) - Math.PI)
  }
  if (name === 'eq-spread') return Math.abs(spread(P[0], P[1], P[2], P[3]) - spread(P[4], P[5], P[6], P[7]))
  return NaN
}

const same = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-12
