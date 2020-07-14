import { get_m_cmp, m_repr, m_eq } from './monomials.js';

/* Terms

*/
function t_repr(t, vars) { 
  return t_coef(t) + " * " + m_repr(t_mon(t), vars);
}

function t_coef(t) {
  return t[1];
}

function t_mon(t) {
  return t[0];
}

function t_add(t, u) {
  return [t[0], t[1] + u[1]]
}

/* Polynomials

A polynomial is represented by a list of pairs. Each pair is a monomial and a coefficient.

*/

function p_repr(p, vars) {
  return p.map((t) => (t_repr(t, vars))).join(' + ');
}

function p_sort(p, order) {
  order = get_m_cmp(order)
  return [...p].sort((a, b) => (order(t_mon(a), t_mon(b))));
}

function p_norm(p, order) {
  // sort, and combine terms of the same monomial
  var sorted = p_sort(p, order);
  var normed = sorted.reduce((acc, current) => {
    const ix = acc.length - 1;
    if (ix == -1) {
      return [current]
    }
    else if (m_eq(t_mon(acc[ix]), t_mon(current))) {
      acc[ix] = t_add(acc[ix], current)
    }
    else {
      acc.push(current)
    }
    return acc;
  }, [])

  return normed;
}

function p_add(p, q, order) {
  return p_norm([...p, ...q], order);
};

function p_minus(p, q, order) {
  return p_add(p, p_smul(-1, q), order)
};

function p_smul(a, p) {
  return p.map((t) => ([t_mon(t), t_coef(t)*a]))
};


var a = [
  [[1, 0, 2], 4],
  [[0, 1, 0], 2]
]

var b = [
  [[1, 1, 0], 4],
  [[0, 2, 1], 2],
  [[0, 1, 0], 1]
]
console.log(p_repr(p_smul(10, a)))


function p_mul(p, q) {

};

function p_div(p, q) {

};

function p_lt(f, order) {
    /* Leading term of a polynomial */

};

function p_lc(f, order) {

};

function p_lm(f, order) {

};

function p_reduce(f, G, order) {
    /* Generalised polynomial division algorithm.
    Given a polynomial f and a basis {g_1, ..., g_k}, computes the representation
    f = q_1 * g_1 + ... q_k * g_k + r

    Inputs
      f : a Polynomial in k[x_1, ..., x_n]
      G : A collection of polynomials in k[x_1, ..., x_n]
      order : (optional) a monomial order function. Lexicographic order is used by default

    Returns
      Q : An array of the coefficients q_1, ..., q_k
      r : The remainder term
    */


    var r = 0;
    var p = f;
    var q = Array(G.length).fill(0);

    var lt_G = G.map((g) => (leading_term(g)));
    var lt_p = leading_term(p);

    while (p != 0) {
        var i = 0;
        var division_occured = false;
        while (i < s && ~division_occred) {
            if (divides(lt_g_i, lt_p)) {
                var factored = poly_div(lt_p, lt_G[i])
                q[i] = poly_add(q[i], factored);
                p = poly_sub(p, poly_mul(favtored, G[i]));
                lt_p = leading_term(p)
                division_occured = true;
            }
            else {
                i += 1
            }
        }
        if (~division_occured) {
            r = poly_add(r, lt_p)
            p = poly_minus(p, lt_p)
        }
    }
};