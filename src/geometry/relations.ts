/**
 * The relations the drawing layer knows, one entry each: the boundary between the logic and the
 * figure. Everything below this table (extraction, the construction model, the checks a drawing is
 * held to, numeric evidence for lemmas) asks it rather than switching on names.
 *
 * An entry says, for one relation:
 *
 *   arity     how many points it takes (a fact with the wrong number is not read: a line being typed)
 *   read      how the construction model reads it: as a collinear group, an equal length, an order,
 *             a pair kept apart, or a measure. Absent for a relation the figure cannot impose
 *             (`eq-point`: the drawing takes distinct names for distinct points).
 *   depicted  whether the figure draws it as itself where a path from a written fact first reaches
 *             it: a circle is drawn as a circle, though the planner reads its definition. A relation
 *             can be depicted and defined (`right`: Byrne's square, its definition read by the planner).
 *   draw      how it is drawn (design.md, "What each relation draws"), through a pen (figure.ts).
 *             Equalities draw nothing of their own: their marks come from the classes in marks.ts.
 *   byNames   holds in any figure by its convention that distinct names are distinct points
 *             (`distinct`): a lemma's hypothesis of it is met by two different names.
 *   mark      its drawing is a mark (a right angle's square, a supplement's arcs): like an equality's
 *             ticks it is drawn wherever it is proven, not only where it is written.
 *   holds     whether it holds at given positions; `tol` is a length on the figure's scale. A
 *             degenerate case (an angle with an arm of no length) counts as holding: nothing to measure.
 *   residual  for the numeric solver: how far an equation is from holding, 0 when it does.
 *
 * Which relations are constraints, which are drawn and which are unread all follow from the table
 * (extraction.ts), and how it is drawn from `draw`.
 */

import { angle, spread } from './measure'

export type Point = [number, number]

/** What the construction model is built from (construction.ts, `buildModel`). */
export interface ModelReader {
  collinear(points: readonly string[]): void
  equal(a: string, b: string, c: string, d: string): void
  between(a: string, b: string, c: string): void
  distinct(a: string, b: string): void
  /** An equality of angles or spreads, or a supplement: placed by loci where it can be, else checked. */
  measure(name: string, args: readonly string[]): void
}

/** What a relation draws with (figure.ts); the pen knows the fact's depth and where it came from. */
export interface Pen {
  /** The line through the points, across the page. */
  line(points: readonly string[]): void
  /** The finite straight line a–c at full strength; its line, through `through`, continues faint. */
  segment(a: string, c: string, through: readonly string[]): void
  /** The circle about `center` through the points. */
  circle(center: string, through: readonly string[]): void
  /** The angle a-b-c with its arms: Byrne's square for a right angle. */
  angle(a: string, b: string, c: string, as: 'square'): void
  /** Two angles that together make a straight angle (figure.ts decides how: see Figure.angles). */
  supplement(first: readonly [string, string, string], second: readonly [string, string, string]): void
  /** Two lengths stated equal: circles about one centre with these radii are one circle. */
  sameLength(a: string, b: string, c: string, d: string): void
}

export interface Relation {
  name: string
  /** A number of points, or at least `min`. */
  arity: number | { min: number }
  read?(args: readonly string[], m: ModelReader): void
  depicted: boolean
  draw?(args: readonly string[], pen: Pen): void
  mark?: boolean
  byNames?(args: readonly string[]): boolean
  holds(ps: readonly Point[], tol: number): boolean
  residual?(ps: readonly Point[]): number
}

const d = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1])
const same = (p: Point, q: Point) => d(p, q) < 1e-12

/** Angles and spreads hold to this, in radians or as a spread: they do not scale with the figure. */
const MEASURE_TOL = 1e-7

/** A measure holds when its residual is small, or is undefined (a degenerate angle or line). */
const measured = (residual: (ps: readonly Point[]) => number): Pick<Relation, 'holds' | 'residual'> => ({
  residual,
  holds: ps => { const r = residual(ps); return Number.isNaN(r) || r <= MEASURE_TOL },
})

function farthestPair(ps: readonly Point[]): [Point, Point] {
  let best: [Point, Point] = [ps[0], ps[0]], len = -1
  for (const p of ps) for (const q of ps) if (d(p, q) > len) { len = d(p, q); best = [p, q] }
  return best
}

const TABLE: Relation[] = [
  {
    name: 'collinear', arity: { min: 3 }, depicted: true,
    read: (args, m) => m.collinear(args),
    draw: (args, pen) => pen.line(args),
    holds: (ps, tol) => {
      const [p, q] = farthestPair(ps), len = d(p, q)
      return len <= tol || ps.every(r => Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / len <= tol)
    },
  },
  {
    name: 'between', arity: 3, depicted: true,
    read: ([a, b, c], m) => { m.collinear([a, b, c]); m.between(a, b, c) },
    draw: ([a, b, c], pen) => pen.segment(a, c, [a, b, c]),
    holds: ([a, b, c], tol) => {
      const ac = d(a, c)
      if (ac <= tol) return d(a, b) <= tol
      const cross = Math.abs((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / ac
      const t = ((b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1])) / (ac * ac)
      return cross <= tol && t >= -tol / ac && t <= 1 + tol / ac
    },
  },
  {
    name: 'eq-lines', arity: 4, depicted: true,
    read: ([a, b, c, e], m) => m.equal(a, b, c, e),
    draw: ([a, b, c, e], pen) => pen.sameLength(a, b, c, e),
    holds: ([a, b, c, e], tol) => Math.abs(d(a, b) - d(c, e)) <= tol,
  },
  {
    // Defined in the book (equal radii), so the planner reads eq-lines; drawn as a circle.
    name: 'circle', arity: 3, depicted: true,
    read: ([a, b, c], m) => m.equal(a, b, a, c),
    draw: ([a, b, c], pen) => pen.circle(a, [b, c]),
    holds: ([a, b, c], tol) => Math.abs(d(a, b) - d(a, c)) <= tol,
  },
  {
    name: 'distinct', arity: 2, depicted: true,
    read: ([a, b], m) => m.distinct(a, b),
    byNames: ([a, b]) => a !== b,
    holds: ([a, b], tol) => d(a, b) > tol,
  },
  {
    // Angle a-b-c (vertex b, unsigned, 0 to π) equals angle d-e-f.
    name: 'eq-angle', arity: 6, depicted: true,
    read: (args, m) => m.measure('eq-angle', args),
    ...measured(P => {
      const degenerate = (a: Point, b: Point, c: Point) => same(a, b) || same(c, b)
      if (degenerate(P[0], P[1], P[2]) || degenerate(P[3], P[4], P[5])) return NaN
      return Math.abs(angle(P[0], P[1], P[2]) - angle(P[3], P[4], P[5]))
    }),
  },
  {
    // Angles a-b-c and d-e-f together make a straight angle.
    name: 'supp', arity: 6, depicted: true,
    read: (args, m) => m.measure('supp', args),
    draw: ([a, b, c, d, e, f], pen) => pen.supplement([a, b, c], [d, e, f]),
    mark: true,
    ...measured(P => {
      if (same(P[0], P[1]) || same(P[2], P[1]) || same(P[3], P[4]) || same(P[5], P[4])) return NaN
      return Math.abs(angle(P[0], P[1], P[2]) + angle(P[3], P[4], P[5]) - Math.PI)
    }),
  },
  {
    // The spread between lines a-b and c-d equals that between e-f and g-h.
    name: 'eq-spread', arity: 8, depicted: true,
    read: (args, m) => m.measure('eq-spread', args),
    ...measured(P => Math.abs(spread(P[0], P[1], P[2], P[3]) - spread(P[4], P[5], P[6], P[7]))),
  },
  {
    // Defined in the book (an angle equal to its own supplement), so the planner reads its definition;
    // drawn as Byrne draws it, a small square at the vertex.
    name: 'right', arity: 3, depicted: true,
    draw: ([a, b, c], pen) => pen.angle(a, b, c, 'square'),
    mark: true,
    ...measured(([a, b, c]) => same(a, b) || same(c, b) ? NaN : Math.abs(angle(a, b, c) - Math.PI / 2)),
  },
  {
    // Not read: the drawing takes distinct names for distinct points. Evaluated as a claim.
    name: 'eq-point', arity: 2, depicted: false,
    holds: ([a, b], tol) => d(a, b) <= tol,
  },
]

export const RELATIONS: ReadonlyMap<string, Relation> = new Map(TABLE.map(r => [r.name, r]))

/** The entry for a fact, if the drawing layer knows its relation and it has the right number of points. */
export function relationOf(f: { name: string; args: readonly string[] }): Relation | undefined {
  const r = RELATIONS.get(f.name)
  if (!r) return undefined
  return (typeof r.arity === 'number' ? f.args.length === r.arity : f.args.length >= r.arity.min) ? r : undefined
}

/** Does a fact hold in a configuration, up to a tolerance relative to the figure's size? */
export function holds(f: { name: string; args: readonly string[] }, coords: ReadonlyMap<string, Point>): boolean {
  const r = relationOf(f)
  const ps = f.args.map(a => coords.get(a))
  if (!r || ps.some(p => !p)) return true   // nothing to measure
  const size = Math.max(1, ...[...coords.values()].flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]))
  return r.holds(ps as Point[], 1e-7 * size)
}
