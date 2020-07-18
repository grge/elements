import { Monomial, get_m_cmp, m_eq, m_mul } from './monomial';
import { Term, t_repr, t_add, t_eq, t_divides, t_div } from './term';

const epsilon = 1e-21;

export interface Poly extends Array<Term>{};

export function p_repr(p:Poly, vars?:string):string {
    let out = p.map((t) => (t_repr(t, vars))).join(' + ');
    return out.replace(/ \+ -1?/gi, ' - ').replace(/ \* /gi, '')
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
    let r = [];
    let p = p_norm(f, sort_name);
    let Q = Array(G.length).fill([]);

    let lt_G = G.map((g) => (p_lt(g)));

    while (! p_eq(p, [])) {
        let lt_p = p_lt(p);
        let i = 0;
        let division_occured = false;
        while ((i < Q.length) && (!division_occured)) {
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

export function p_lcm(f:Poly, g:Poly, sort_name?:string):Monomial {
    const zip = (a, b) => (a.map((k, i) => [k, b[i]]));
    return zip(p_lm(f, sort_name), p_lm(g, sort_name)).map(([a, b]) => (Math.max(a, b)));
}

export function p_spoly(f:Poly, g:Poly, sort_name?:string):Poly {
    let t_lcm = {m: p_lcm(f, g, sort_name), coef: 1};
    return p_norm(p_minus(
        p_mul([t_div(t_lcm, p_lt(f, sort_name))], f),
        p_mul([t_div(t_lcm, p_lt(g, sort_name))], g)
    ))
}

export function buchberger(F:Array<Poly>, sort_name?:string):Array<Poly> {
    let G = [...F];
    let Gp = [];
    while (G != Gp) {
        Gp = G;
        for (let i = 0; i < Gp.length; i++) {
            for (let j = i; j < Gp.length; j++) {
                if (i != j) {
                    let S = p_spoly(Gp[i], Gp[j], sort_name)
                    let [Q, r] = p_reduce(S, Gp, sort_name)
                    if (!p_eq([], r)) {
                        G = [...G, r];
                    }
                }
            }
        }
    }
    return G
}

export function groebner_reduce(G:Array<Poly>, sort_name?:string):Array<Poly> {
    let G_out = [...G]
    for (let i = 0; i < G_out.length; i++) {
        let g = G_out[i];
        let G_minus_g = G_out.filter((v, ix) => ((!p_eq(v, [])) && ix != i))
        let [Q, g_prime] = p_reduce(g, G_minus_g, sort_name);
        G_out[i] = g_prime;
    }
    return G_out.filter((p) => (!p_eq(p, [])));
}

// let F:Array<Poly> = [
//     [{m:[3, 0], coef:1}, {m:[1, 1], coef:-2}],
//     [{m:[2, 1], coef:1}, {m:[0, 2], coef:-2}, {m:[1, 0], coef:1}]
// ]

// let F:Array<Poly> = [
//     [{m:[2, 0, 0], coef:1}, {m:[0, 2, 0], coef:1}, {m:[0, 0, 2], coef:1}, {m:[0, 0, 0], coef:-1}],
//     [{m:[2, 0, 0], coef:1}, {m:[0, 2, 0], coef:1}, {m:[0, 0, 1], coef:-1}],
//     [{m:[1, 0, 0], coef:1}, {m:[0, 0, 1], coef:-1}]
// ]


// let G = buchberger(F, 'lex')
// console.log(G.map((g) => (p_repr(g))))
// let G_p = groebner_reduce(G, 'lex')
// console.log(G_p.map((g) => (p_repr(g))))

// G = buchberger(G_p, 'lex')
// console.log(G.map((g) => (p_repr(g))))

/*
we have
 circle A B C
 circle B A C

which is 
 distance A B = distance A C
 distance B A = distance B C

which is
 (Ax - Bx)^2 + (Ay - By)^2 = (Ax - Cx)^2 + (Ay - Cy)^2
 (Bx - Ax)^2 + (By - Ay)^2 = (Bx - Cx)^2 + (By - Cy)^2

which is
 Ax^2 - 2 * Ax * Bx + Bx^2 + Ay^2 - 2*Ay*By + By^2 = (Ax - Cx)^2 + (Ay - Cy)^2
 (Bx - Ax)^2 + (By - Ay)^2 = (Bx - Cx)^2 + (By - Cy)^2

 */

// let p1 = [
//      // Distance from A to B
//      {m:[2, 0, 0, 0, 0, 0], coef:1},
//      {m:[1, 0, 1, 0, 0, 0], coef:-2},
//      {m:[0, 0, 2, 0, 0, 0], coef:1},
//      {m:[0, 2, 0, 0, 0, 0], coef:1},
//      {m:[0, 1, 0, 1, 0, 0], coef:-2},
//      {m:[0, 0, 0, 2, 0, 0], coef:1},

//      // Minus the distance from A to C
//      {m:[2, 0, 0, 0, 0, 0], coef:-1},
//      {m:[1, 0, 0, 0, 1, 0], coef:2},
//      {m:[0, 0, 0, 0, 2, 0], coef:-1},
//      {m:[0, 2, 0, 0, 0, 0], coef:-1},
//      {m:[0, 1, 0, 0, 0, 1], coef:2},
//      {m:[0, 0, 0, 0, 0, 2], coef:-1},
// ];

// let p2 = [
//      // Distance from B to A
//      {m:[0, 0, 2, 0, 0, 0], coef:1},
//      {m:[1, 0, 1, 0, 0, 0], coef:-2},
//      {m:[2, 0, 0, 0, 0, 0], coef:1},
//      {m:[0, 0, 0, 2, 0, 0], coef:1},
//      {m:[0, 1, 0, 1, 0, 0], coef:-2},
//      {m:[0, 2, 0, 0, 0, 0], coef:1},

//      // Minus the distance from B to C
//      {m:[0, 0, 2, 0, 0, 0], coef:-1},
//      {m:[0, 0, 1, 0, 1, 0], coef:2},
//      {m:[0, 0, 0, 0, 2, 0], coef:-1},
//      {m:[0, 0, 0, 2, 0, 0], coef:-1},
//      {m:[0, 0, 0, 1, 0, 1], coef:2},
//      {m:[0, 0, 0, 0, 0, 2], coef:-1},
// ];

// let F = [p1, p2];

// console.log(F.map((p) => (p_repr(p))))

// console.log(F.map((p) => (p_repr(p_norm(p)))))

// let G = groebner_reduce(buchberger(F, 'grevlex'), 'grevlex')

// console.log(G.map((p) => (p_repr(p))))

// // let G = [[{"m":[3,0],"coef":1},{"m":[1,1],"coef":-2}],[{"m":[2,1],"coef":1},{"m":[0,2],"coef":-2},{"m":[1,0],"coef":1}],[{"m":[2,0],"coef":-1}],[{"coef":-2,"m":[1,1]}],[{"coef":-2,"m":[0,2]},{"coef":1,"m":[1,0]}]]

// // let s = p_spoly(G[1], G[4], 'grlex')

// // console.log(p_repr(s))
// // let [Q, r] = p_reduce(s, G, 'grlex')
// // console.log(Q.map((p) => (p_repr(p))))
// // console.log(G.map((p) => (p_repr(p))))
