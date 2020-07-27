import { Monomial, m_repr, m_divides, m_div, m_eq } from './monomial'

export interface Term {
    coef: number,
    m: Monomial
}

export function t_repr(t:Term, vars:string):string { 
    if (t.m.every((n) => (n==0))) {
        return t.coef.toString()
    }
    else if (t.coef == 1) {
        return m_repr(t.m, vars)
    }
    else {
        return t.coef + " * " + m_repr(t.m, vars);
    }
}

export function t_eq(t:Term, u:Term):boolean {
    return (Math.abs(t.coef - u.coef) < 1e-20) && m_eq(t.m, u.m)
}

export function t_add(t:Term, u:Term):Term {
    return {m: t.m, coef: t.coef + u.coef};
}

export function t_divides(t:Term, u:Term):boolean {
    return m_divides(t.m, u.m)
}

export function t_div(t:Term, u:Term):Term {
    return {m:m_div(t.m, u.m), coef:t.coef / u.coef}
}