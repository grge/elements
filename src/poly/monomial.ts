export type Monomial = Array<number>

export interface MonomialOrder {
    (a: Monomial, b: Monomial): number;
}

export function m_repr (a: Monomial, vars?: string): string {
  if (typeof vars === 'undefined') {
    vars = 'abcdefghijklmnopqrstuvwxyz'
  }
  const out = []
  for (let i = 0; i < a.length; i++) {
    if (a[i] >= 2) {
      out.push(vars[i] + '^' + a[i])
    } else if (a[i] == 1) {
      out.push(vars[i])
    }
  }
  return out.join(' * ')
}

export function m_eq (a: Monomial, b: Monomial): boolean {
  if (a.length != b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false
    }
  }
  return true
}

export function m_mul (a: Monomial, b: Monomial): Monomial {
  if (a.length != b.length) { throw new TypeError('Incompatible monomials') }
  const out = Array(a.length)
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] + b[i]
  }
  return out
};

export function m_div (a: Monomial, b: Monomial): Monomial {
  // divides a by b
  const out = Array(a.length)
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) {
      throw TypeError('Cannot divide monomials')
    }
    out[i] = a[i] - b[i]
  }
  return out
}

export function m_divides (a: Monomial, b: Monomial): boolean {
  // returns true if b = a*c for some monomial c
  for (let i = 0; i < a.length; i++) {
    if (b[i] < a[i]) {
      return false
    }
  }
  return true
}

export function m_degree (a: Monomial): number {
  return a.reduce((pv, cv) => (pv + cv))
}

export function m_cmp_lex (a: Monomial, b: Monomial): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) {
      return 1
    } else if (a[i] > b[i]) {
      return -1
    }
  }
  return 0
}

export function m_cmp_grlex (a: Monomial, b: Monomial): number {
  const a_deg = m_degree(a)
  const b_deg = m_degree(b)
  if (a_deg < b_deg) {
    return 1
  } else if (a_deg > b_deg) {
    return -1
  } else {
    return m_cmp_lex(a, b)
  }
}

export function m_cmp_grevlex (a: Monomial, b: Monomial): number {
  const a_deg = m_degree(a)
  const b_deg = m_degree(b)
  if (a_deg < b_deg) {
    return 1
  } else if (a_deg > b_deg) {
    return -1
  } else {
    for (let i = a.length - 1; i >= 0; i--) {
      if (a[i] < b[i]) {
        return -1
      } else if (a[i] > b[i]) {
        return 1
      } else {
        return 0
      }
    }
  }
}

export function conform_vars (
  a: Monomial,
  old_vars: Array<string> | string,
  new_vars: Array<string> | string): Monomial {
  if (typeof old_vars === 'string') {
    old_vars = old_vars.split('')
  }
  if (typeof new_vars === 'string') {
    new_vars = new_vars.split('')
  }

  const out = Array(new_vars.length).fill(0)
  for (var i = 0; i < old_vars.length; i++) {
    const new_ix = new_vars.findIndex((val) => (val == old_vars[i]))
    if (new_ix == -1) {
      throw "Cannot conform monomial. '" + old_vars[i] + "' was not included in new_vars."
    } else {
      out[new_ix] = a[i]
    }
  }
  return out
}

export function get_m_cmp (sort_name: string): MonomialOrder {
  const sorters = {
    lex: m_cmp_lex,
    grlex: m_cmp_grlex,
    grevlex: m_cmp_grevlex
  }
  if (sort_name in sorters) {
    return sorters[sort_name]
  } else {
    return m_cmp_lex
  }
}
