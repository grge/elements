import { Monomial, m_repr } from './monomial'

export interface Term {
    coef: number,
    m: Monomial
}

export function t_repr(t:Term, vars:string):string { 
    return t.coef + " * " + m_repr(t.m, vars);
}

export function t_add(t:Term, u:Term):Term {
    return {m: t.m, coef: t.coef + u.coef};
}