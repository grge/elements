import test from 'ava';

import { p_eq, p_add, p_norm, p_reduce } from '../polynomial'

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

test("Polynomial reduction. One variable, one divisor.", t=> {
    // x^3 - 2x^2 - 4 = (x - 3) * (x^2 + x + 3) + 5
    let divisor = [{m:[1], coef:1}, {m:[0], coef:-3}]
    let dividend = [{m:[3], coef:1}, {m:[2], coef:-2}, {m:[0], coef:-4}]
    let [Q, r] = p_reduce(dividend, [divisor], 'lex')
    t.deepEqual(Q, [[{m:[2], coef:1}, {m:[1], coef:1}, {m:[0], coef:3}]])
    t.deepEqual(r, [{m:[0], coef:5}])
})