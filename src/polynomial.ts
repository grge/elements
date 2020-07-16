import { Monomial, get_m_cmp, m_eq, m_mul } from './monomial';
import { Term, t_repr, t_add, t_eq, t_divides, t_div } from './term';

const epsilon = 1e-21;

export interface Poly extends Array<Term>{};

export function p_repr(p:Poly, vars?:string):string {
    return p.map((t) => (t_repr(t, vars))).join(' + ');
}

export function p_sort(p:Poly, sort_name?:string):Poly {
    let f = get_m_cmp(sort_name);
    return [...p].sort((a, b) => (f(a.m, b.m)));
}

export function p_lt(p:Poly, sort_name?:string):Term {
    return p_norm(p, sort_name)[0];
}

export function p_lc(p:Poly, sort_name?:string):number {
    return p_lt(p, sort_name).coef;
}

export function p_lm(p:Poly, sort_name?:string):Monomial {
    return p_lt(p, sort_name).m;
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

    return normed.filter((t) => (Math.abs(t.coef) > epsilon));
}

export function p_eq(p:Poly, q:Poly, sort_name?:string):boolean {
    const zip = (a, b) => (a.map((k, i) => [k, b[i]]));
    let pn = p_norm(p, sort_name);
    let qn = p_norm(q, sort_name)
    if (pn.length != qn.length) { return false }
    return zip(pn, qn).every(([a, b]) => (t_eq(a, b)))
}

export function p_add(p:Poly, q:Poly):Poly {
    return [...p, ...q];
}

export function p_minus(p:Poly, q:Poly):Poly {
    return p_add(p, p_smul(-1, q))
}

export function p_smul(a:number, p:Poly):Poly {
    return p.map((t) => ({m:t.m, coef:t.coef*a}))
}

export function p_tmul(t:Term, p:Poly):Poly {
    return p.map((u) => ({coef: u.coef*t.coef, m:m_mul(u.m, t.m)}))
}

export function p_mul(p:Poly, q:Poly):Poly {
    return p.map((t) => (p_tmul(t, q))).flat()
}

export function p_reduce(f:Poly, G:Array<Poly>, sort_name?:string):[Array<Poly>, Poly] {
    let zero = []; // sloppy way to create a zero polynomial
    let r = zero;
    let p = p_norm(f, sort_name);
    let Q = Array(G.length).fill(zero);

    let lt_G = G.map((g) => (p_lt(g)));


    while (! p_eq(p, zero)) {
        let lt_p = p_lt(p);
        var i = 0;
        var division_occured = false;
        while ((i < Q.length) && (~division_occured)) {
            if (t_divides(lt_G[i], lt_p)) {
                let factored = [t_div(lt_p, lt_G[i])]
                Q[i] = p_norm(p_add(Q[i], factored), sort_name);
                p = p_norm(p_minus(p, p_mul(factored, G[i])), sort_name);
                lt_p = p_lt(p)
                division_occured = true;
            }
            else {
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


var a = [
  {m:[1, 0, 1], coef:2},
  {m:[0, 1, 0], coef:1},
]


var b = [
  {m:[1, 0, 0], coef:1},
  {m:[0, 1, 0], coef:1},
]

var c = [
  {m:[1, 0, 0], coef:1},
  {m:[0, 0, 1], coef:1},
]

let divisor = [{m:[1], coef:1}, {m:[0], coef:-3}]
let dividend = [{m:[3], coef:1}, {m:[2], coef:-2}, {m:[0], coef:-4}]
let [Q, r] = p_reduce(dividend, [divisor])
console.log(Q[0])
console.log(r)


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