import { Monomial, get_m_cmp, m_eq, m_mul } from './monomial'
import { Term, t_repr, t_add, t_eq, t_divides, t_div } from './term'

const epsilon = 1e-21

export type Poly = Array<Term>;

export function p_repr (p: Poly, vars?: string): string {
  const out = p.map((t) => (t_repr(t, vars))).join(' + ')
  return out.replace(/ \+ -1?/gi, ' - ').replace(/ \* /gi, '')
}

export function p_sort (p: Poly, sort_name?: string): Poly {
  const f = get_m_cmp(sort_name)
  return [...p].sort((a, b) => (f(a.m, b.m)))
}

export function p_lt (p: Poly, sort_name?: string): Term {
  return p_norm(p, sort_name)[0]
}

export function p_lc (p: Poly, sort_name?: string): number {
  return p_lt(p, sort_name).coef
}

export function p_lm (p: Poly, sort_name?: string): Monomial {
  return p_lt(p, sort_name).m
}

export function p_norm (p: Poly, sort_name?: string): Poly {
  // sort, and combine terms of the same monomial
  const sorted = p_sort(p, sort_name)
  const normed = sorted.reduce((acc, current) => {
    const ix = acc.length - 1
    if (ix == -1) {
      return [current]
    } else if (m_eq(acc[ix].m, current.m)) {
      acc[ix] = t_add(acc[ix], current)
    } else {
      acc.push(current)
    }
    return acc
  }, [])

  return normed.filter((t) => (Math.abs(t.coef) > epsilon))
}

export function p_eq (p: Poly, q: Poly, sort_name?: string): boolean {
  const zip = (a, b) => (a.map((k, i) => [k, b[i]]))
  const pn = p_norm(p, sort_name)
  const qn = p_norm(q, sort_name)
  if (pn.length != qn.length) { return false }
  return zip(pn, qn).every(([a, b]) => (t_eq(a, b)))
}

export function p_add (p: Poly, q: Poly): Poly {
  return [...p, ...q]
}

export function p_minus (p: Poly, q: Poly): Poly {
  return p_add(p, p_smul(-1, q))
}

export function p_smul (a: number, p: Poly): Poly {
  return p.map((t) => ({ m: t.m, coef: t.coef * a }))
}

export function p_tmul (t: Term, p: Poly): Poly {
  return p.map((u) => ({ coef: u.coef * t.coef, m: m_mul(u.m, t.m) }))
}

export function p_mul (p: Poly, q: Poly): Poly {
  return p.map((t) => (p_tmul(t, q))).flat()
}

export function p_reduce (f: Poly, G: Array<Poly>, sort_name?: string): [Array<Poly>, Poly] {
  let r = []
  let p = p_norm(f, sort_name)
  const Q = Array(G.length).fill([])

  const lt_G = G.map((g) => (p_lt(g)))

  while (!p_eq(p, [])) {
    let lt_p = p_lt(p)
    let i = 0
    let division_occured = false
    while ((i < Q.length) && (!division_occured)) {
      if (t_divides(lt_G[i], lt_p)) {
        const factored = [t_div(lt_p, lt_G[i])]
        Q[i] = p_norm(p_add(Q[i], factored), sort_name)
        p = p_norm(p_minus(p, p_mul(factored, G[i])), sort_name)
        lt_p = p_lt(p)
        division_occured = true
      } else {
        i += 1
      }
    }
    if (!division_occured) {
      r = p_norm(p_add(r, [lt_p]), sort_name)
      p = p_norm(p_minus(p, [lt_p]), sort_name)
    }
  }
  return [Q, r]
}

export function p_lcm (f: Poly, g: Poly, sort_name?: string): Monomial {
  const zip = (a, b) => (a.map((k, i) => [k, b[i]]))
  return zip(p_lm(f, sort_name), p_lm(g, sort_name)).map(([a, b]) => (Math.max(a, b)))
}

export function p_spoly (f: Poly, g: Poly, sort_name?: string): Poly {
  const t_lcm = { m: p_lcm(f, g, sort_name), coef: 1 }
  return p_norm(p_minus(
    p_mul([t_div(t_lcm, p_lt(f, sort_name))], f),
    p_mul([t_div(t_lcm, p_lt(g, sort_name))], g)
  ))
}

export function buchberger (F: Array<Poly>, sort_name?: string): Array<Poly> {
  let G = [...F]
  let Gp = []
  while (G != Gp) {
    Gp = G
    for (let i = 0; i < Gp.length; i++) {
      for (let j = i; j < Gp.length; j++) {
        if (i != j) {
          const S = p_spoly(Gp[i], Gp[j], sort_name)
          const [Q, r] = p_reduce(S, Gp, sort_name)
          if (!p_eq([], r)) {
            G = [...G, r]
          }
        }
      }
    }
  }
  return G
}

export function groebner_reduce (G: Array<Poly>, sort_name?: string): Array<Poly> {
  const G_out = [...G]
  for (let i = 0; i < G_out.length; i++) {
    const g = G_out[i]
    const G_minus_g = G_out.filter((v, ix) => ((!p_eq(v, [])) && ix != i))
    const [Q, g_prime] = p_reduce(g, G_minus_g, sort_name)
    G_out[i] = g_prime
  }
  return G_out.filter((p) => (!p_eq(p, [])))
}
