import { MonomialOrder, get_m_cmp, m_eq, m_mul } from './monomial';
import { Term, t_repr, t_add } from './term';

export interface Poly extends Array<Term>{};

export function p_repr(p:Poly, vars?:string):string {
    return p.map((t) => (t_repr(t, vars))).join(' + ');
}

export function p_sort(p:Poly, sort_name?:string):Poly {
    let f = get_m_cmp(sort_name)
    return [...p].sort((a, b) => (f(a.m, b.m)));
}

export function p_norm(p:Poly, sort_name?:string):Poly {
    // sort, and combine terms of the same monomial
    let sorted = p_sort(p, sort_name);
    let normed = sorted.reduce((acc, current) => {
        const ix = acc.length - 1;
        if (ix == -1) {
            return [current]
        }
        else if (m_eq(acc[ix].m, current.m)) {
            acc[ix] = t_add(acc[ix], current)
        }
        else {
            acc.push(current)
        }
        return acc;
    }, [])

    return normed;
}

export function p_add(p:Poly, q:Poly, sort_name?:string):Poly {
    return p_norm([...p, ...q], sort_name);
}

export function p_minus(p:Poly, q:Poly, sort_name?:string):Poly {
    return p_add(p, p_smul(-1, q), sort_name)
}

export function p_smul(a:number, p:Poly):Poly {
    return p.map((t) => ({m:t.m, coef:t.coef*a}))
}

export function p_tmul(t:Term, p:Poly):Poly {
    return p.map((u) => ({coef: u.coef*t.coef, m:m_mul(u.m, u.m)}))
}

export function p_mul(p:Poly, q:Poly):Poly {
    return p.map((t) => (p_tmul(t, q))).flat()
}


var a = [
  {m:[1, 0, 2], coef:4},
  {m:[0, 1, 0], coef:2}
]

var b = [
  {m:[1, 1, 0], coef:4},
  {m:[0, 2, 1], coef:1},
  {m:[0, 1, 0], coef:3}
]

console.log(p_repr(p_smul(10, a)))

/*

function p_mul(p, q) {

};

function p_div(p, q) {

};

function p_lt(f, order) {

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
*/