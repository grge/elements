/**
 * Angles and spreads: the measures behind eq-angle, supp and eq-spread (relations.ts).
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
