
// MONOMIALS

/* Monomials are represented by an array of exponents. */

export function m_repr(a, vars) {
  if (typeof vars === 'undefined') {
    vars = 'abcdefghijklmnopqrstuvwxyz';
  }
  var reprs = []
  for (var i = 0; i < a.length; i++) {
    if (a[i] >= 2) {
      reprs.push(vars[i] + "^" + a[i])
    }
    else if (a[i] == 1) {
      reprs.push(vars[i])
    }
  }
  return reprs.join(' * ')
}

export function m_eq(a, b) {
  if (a.length != b.length) {
    return false;
  }
  for (var i = 0; i < a.length; i++) {
    if (a[i] != b[i]) {
      return false;
    }
  }
  return  true;
}

export function m_mul(a, b) {
  var out = Array(a.length);
  for (var i = 0; i < a.length; i++) {
    out[i] = a[i] + b[i];
  }
  return out
};

export function m_div(a, b) {
  // divides a by b
  var out = Array(a.length);
  for (var i = 0; i < a.length; i++) {
    if (a[i] < b[i]) {
      throw "Cannot divide monomials"
    }
    out[i] = a[i] - b[i];
  }
  return out
};

export function m_divides(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (b[i] < a[i]) {
      return false;
    }
  }
  return true;
}

export function m_degree(a) {
  return a.reduce((pv, cv) => (pv + cv));
}

export function m_cmp_lex(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] < b[i]) {
      return -1;
    }
    else if (a[i] > b[i]) {
      return 1
    }
  }
  return 0
}

export function m_cmp_grlex(a, b) {
  const a_deg = m_degree(a);
  const b_deg = m_degree(b);
  if (a_deg < b_deg) {
    return -1
  }
  else if (a_deg > b_deg) {
    return 1

  }
  else {
    return m_cmp_lex(a, b)
  }
}

export function m_cmp_grevlex(a, b) {
  const a_deg = m_degree(a);
  const b_deg = m_degree(b);
  if (a_deg < b_deg) {
    return -1;
  }
  else if (a_deg > b_deg) {
    return 1
  }
  else {
    for (var i = a.length - 1; i >= 0; i--) {
      if (a[i] < b[i]) {
        return 1;
      }
      else if (a[i] > b[i]) {
        return -1;
      }
      else {
        return 0
      }
    }
  }
}

export function m_conform_vars(a, old_vars, new_vars) {
  if (typeof old_vars === "string") {
    old_vars = old_vars.split('')
  }
  if (typeof new_vars === "string") {
    new_vars = new_vars.split('')
  }
  var out = Array(new_vars.length).fill(0);
  for (var i = 0; i < old_vars.length; i++) {
    const new_ix = new_vars.findIndex((val) => (val == old_vars[i]));
    if (new_ix == -1) {
      throw "Cannot conform monomial. '" + old_vars[i] + "' was not included in new_vars."
    }
    else {
      out[new_ix] = a[i]
    }
  }
  return out
}

export function get_m_cmp(sorter) {
  if (typeof sorter === 'string') {
    return {
      'lex': m_cmp_lex,
      'grlex': m_cmp_grlex,
      'grevlex': m_cmp_grevlex
    }[sorter]
  }
  else if (typeof sorter === 'function') {
    return sorter
  }
  else {
    return m_cmp_lex
  }
}