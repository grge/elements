import test from 'ava';

import { p_eq, p_add, p_norm } from '../polynomial'

test('Zero polynomials are equal', t => {
    t.true(p_eq([], []));
})

test('Identical polynomials are equal', t => {
    let poly = [
        {m: [0, 1, 2], coef: 1},
        {m: [4, 2, 1], coef: 4},
        {m: [0, 0, 1], coef: 1},
    ]
    t.true(p_eq(poly, poly));
});


test("Basic polynomial addition", t => {
    let poly = [{m: [1, 0], coef: 1}];
    t.deepEqual(p_add(poly, poly), [...poly, ...poly]);
})


test("Polynomial normalisation combines terms", t => {
    let unnormed = [
        {m: [1, 0], coef: 1},
        {m: [1, 0], coef: 1},
    ];
    let normed = [
        {m: [1, 0], coef: 2},
    ];
    t.deepEqual(p_norm(unnormed), normed)
})

test("Polynomial normalisation removes zero terms", t => {
    let unnormed = [
        {m: [1, 0], coef: 1},
        {m: [0, 1], coef: 0},
    ];
    let normed = [
        {m: [1, 0], coef: 1},
    ];
    t.deepEqual(p_norm(unnormed), normed)
})