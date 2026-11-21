/**
 * Integer combinations of linear equations: the solver for differences (structure.ts, saturate.ts).
 *
 * Each equation is a vector of integer coefficients over unknowns (a turn: plus one line's direction,
 * minus another's, ...). An equation follows from others when it is an integer combination of them:
 * sound whatever the values are, in any abelian group, and so round a half turn too, where dividing
 * is not (twice a turn being nothing does not make the turn nothing). The equations are kept as a
 * lattice in echelon form, each row with a leading unknown no later row has; a vector is in the
 * lattice when reducing it by the rows, each step an exact division, leaves nothing.
 */

export type Vector = Map<number, number>

/** Coefficients past this are not trusted to floating point: the lattice stops growing. */
const LIMIT = 2 ** 40

const lead = (v: Vector): number => {
  let best = Infinity
  for (const [k, c] of v) if (c !== 0 && k < best) best = k
  return best
}

/** v + m·r, dropping zeros. */
function addScaled(v: Vector, r: Vector, m: number): Vector {
  const out = new Map(v)
  for (const [k, c] of r) {
    const x = (out.get(k) ?? 0) + m * c
    if (x === 0) out.delete(k)
    else out.set(k, x)
  }
  return out
}

function scale(v: Vector, m: number): Vector {
  return new Map([...v].map(([k, c]) => [k, m * c]))
}

/** Extended Euclid: [g, s, t] with s·a + t·b = g = gcd(a, b) > 0. */
function egcd(a: number, b: number): [number, number, number] {
  let [r0, r1, s0, s1, t0, t1] = [a, b, 1, 0, 0, 1]
  while (r1 !== 0) {
    const q = Math.trunc(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
    [t0, t1] = [t1, t0 - q * t1]
  }
  return r0 < 0 ? [-r0, -s0, -t0] : [r0, s0, t0]
}

export class Lattice {
  /** Rows by their leading unknown. */
  private rows = new Map<number, Vector>()
  /** Set when a coefficient grew past LIMIT: further equations are dropped (never unsound). */
  overflowed = false

  /** Add an equation: the lattice becomes the integer combinations of it and those before. */
  add(vector: Vector): void {
    let v = new Map([...vector].filter(([, c]) => c !== 0))
    while (v.size) {
      if ([...v.values()].some(c => Math.abs(c) > LIMIT)) { this.overflowed = true; return }
      const p = lead(v)
      const r = this.rows.get(p)
      if (!r) { this.rows.set(p, v.get(p)! < 0 ? scale(v, -1) : v); return }
      const rp = r.get(p)!, vp = v.get(p)!
      if (vp % rp === 0) { v = addScaled(v, r, -vp / rp); continue }
      // Neither divides the other: replace the row by the combination with the gcd as its lead, and
      // go on with the remainder, whose lead is gone (a unimodular change: the same lattice).
      const [g, s, t] = egcd(rp, vp)   // g = s·rp + t·vp
      const next = addScaled(scale(r, s), v, t)
      const rest = addScaled(scale(r, vp / g), v, -rp / g)
      this.rows.set(p, next)
      v = rest
    }
  }

  /** Is the equation an integer combination of those added? */
  contains(vector: Vector): boolean {
    let v = new Map([...vector].filter(([, c]) => c !== 0))
    while (v.size) {
      const p = lead(v)
      const r = this.rows.get(p)
      if (!r) return false
      const rp = r.get(p)!, vp = v.get(p)!
      if (vp % rp !== 0) return false
      v = addScaled(v, r, -vp / rp)
    }
    return true
  }
}
