/**
 * Angles, spreads and areas: the measures behind eq-angle, supp, eq-spread and eq-area (relations.ts).
 *
 *   eq-angle a b c d e f       angle a-b-c (vertex b, unsigned, 0 to π) equals angle d-e-f
 *   eq-spread a b c d e f g h  the spread between lines a-b and c-d equals that between e-f and g-h
 *   supp a b c d e f           angles a-b-c and d-e-f together make a straight angle
 *   eq-area a b c d e f        triangle a-b-c has the area of triangle d-e-f (unsigned)
 *   eq-turn a b c d e f g h    the turn from line a-b to line c-d equals that from e-f to g-h
 *   cyclic a b c d             a, b, c and d lie on one circle
 *
 * The spread between two lines is Wildberger's: the squared cross product of their directions over
 * the product of their squared lengths, in effect sin² of the angle between them. It does not tell an
 * angle from its supplement, and needs no square root or trigonometry.
 */

export type Point = [number, number]

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
 * The turn from line a-b to line c-d: how far a-b turns, anticlockwise (y up), to lie along c-d, in
 * [0, π). Lines, not rays: a half turn brings a line back to itself. NaN for a pair of equal points.
 */
export function turn(a: Point, b: Point, c: Point, d: Point): number {
  const u = [b[0] - a[0], b[1] - a[1]], v = [d[0] - c[0], d[1] - c[1]]
  if (Math.hypot(u[0], u[1]) < 1e-12 || Math.hypot(v[0], v[1]) < 1e-12) return NaN
  const t = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
  const m = ((t % Math.PI) + Math.PI) % Math.PI
  return m >= Math.PI - 1e-15 ? 0 : m
}

/** How far apart two turns are, round the half turn: 0 when equal. */
export function turnGap(s: number, t: number): number {
  const d = Math.abs(s - t) % Math.PI
  return Math.min(d, Math.PI - d)
}

/** The circle through three points: its centre and radius; null if they are on one line (or two are one). */
export function circumcircle(a: Point, b: Point, c: Point): { c: Point; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  const scale = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - a[0], c[1] - a[1]), 1e-12)
  if (Math.abs(d) < 1e-9 * scale * scale) return null
  const sq = (p: Point) => p[0] * p[0] + p[1] * p[1]
  const ux = (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d
  const uy = (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d
  return { c: [ux, uy], r: Math.hypot(a[0] - ux, a[1] - uy) }
}

/** The signed area of triangle a-b-c: positive when a, b, c turn anticlockwise (y up). */
export function area(a: Point, b: Point, c: Point): number {
  return ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
}
