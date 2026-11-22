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

/**
 * An integer combination of the equations added, by their numbers: the certificate that an equation
 * follows (each coefficient times the equation it numbers, summed).
 */
export type Certificate = Map<number, number>

export class Lattice {
  /** Rows by their leading unknown, each with the combination of added equations it is. */
  private rows = new Map<number, { v: Vector; c: Certificate }>()
  private added = 0
  /** Set when a coefficient grew past LIMIT: further equations are dropped (never unsound). */
  overflowed = false

  /**
   * Add an equation: the lattice becomes the integer combinations of it and those before. Equations
   * are numbered in the order they are added, from 0, for certificates.
   */
  add(vector: Vector): void {
    let v = new Map([...vector].filter(([, c]) => c !== 0))
    let c: Certificate = new Map([[this.added++, 1]])
    while (v.size) {
      if ([...v.values()].some(x => Math.abs(x) > LIMIT)) { this.overflowed = true; return }
      const p = lead(v)
      const r = this.rows.get(p)
      if (!r) { this.rows.set(p, v.get(p)! < 0 ? { v: scale(v, -1), c: scale(c, -1) } : { v, c }); return }
      const rp = r.v.get(p)!, vp = v.get(p)!
      if (vp % rp === 0) { v = addScaled(v, r.v, -vp / rp); c = addScaled(c, r.c, -vp / rp); continue }
      // Neither divides the other: replace the row by the combination with the gcd as its lead, and
      // go on with the remainder, whose lead is gone (a unimodular change: the same lattice).
      const [g, s, t] = egcd(rp, vp)   // g = s·rp + t·vp
      const next = { v: addScaled(scale(r.v, s), v, t), c: addScaled(scale(r.c, s), c, t) }
      const rest = { v: addScaled(scale(r.v, vp / g), v, -rp / g), c: addScaled(scale(r.c, vp / g), c, -rp / g) }
      this.rows.set(p, next)
      v = rest.v
      c = rest.c
    }
  }

  /** Is the equation an integer combination of those added? */
  contains(vector: Vector): boolean {
    return this.certificate(vector) !== null
  }

  /** If the equation is an integer combination of those added, the combination; else null. */
  certificate(vector: Vector): Certificate | null {
    let v = new Map([...vector].filter(([, c]) => c !== 0))
    let c: Certificate = new Map()
    while (v.size) {
      const p = lead(v)
      const r = this.rows.get(p)
      if (!r) return null
      const rp = r.v.get(p)!, vp = v.get(p)!
      if (vp % rp !== 0) return null
      v = addScaled(v, r.v, -vp / rp)
      c = addScaled(c, r.c, vp / rp)
    }
    return c
  }
}
