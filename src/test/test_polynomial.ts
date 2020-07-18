import test from 'ava';

import { p_eq, p_add, p_norm, p_reduce, p_spoly } from '../polynomial'

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

test("Polynomial combines and cancels terms", t => {
    let unnormed = [
        {m: [1, 0], coef: 1},
        {m: [0, 1], coef: 1},
        {m: [0, 1], coef: -1},
    ];
    let normed = [
        {m: [1, 0], coef: 1},
    ];
    t.deepEqual(p_norm(unnormed), normed)
})

test("Polynomial normalisation respects sort type", t => {
    let f = [
        {m:[1, 2, 1], coef:4},
        {m:[0, 0, 2], coef:4},
        {m:[3, 0, 0], coef:-5},
        {m:[2, 0, 2], coef:7},
    ];

    let f_lex = [
        {m:[3, 0, 0], coef:-5},
        {m:[2, 0, 2], coef:7},
        {m:[1, 2, 1], coef:4},
        {m:[0, 0, 2], coef:4},
    ];

    let f_grlex = [
        {m:[2, 0, 2], coef:7},
        {m:[1, 2, 1], coef:4},
        {m:[3, 0, 0], coef:-5},
        {m:[0, 0, 2], coef:4},
    ];

    let f_grevlex = [
        {m:[1, 2, 1], coef:4},
        {m:[2, 0, 2], coef:7},
        {m:[3, 0, 0], coef:-5},
        {m:[0, 0, 2], coef:4},
    ];

    t.deepEqual(p_norm(f, 'lex'), f_lex);
    t.deepEqual(p_norm(f, 'grlex'), f_grlex);
    t.deepEqual(p_norm(f, 'grevlex'), f_grevlex);
})

test("Polynomial reduction. One variable, one divisor.", t=> {
    // x^3 - 2x^2 - 4  =  (x - 3) * (x^2 + x + 3) + 5
    let divisor = [{m:[1], coef:1}, {m:[0], coef:-3}]
    let dividend = [{m:[3], coef:1}, {m:[2], coef:-2}, {m:[0], coef:-4}]
    let [Q, r] = p_reduce(dividend, [divisor], 'lex')
    t.deepEqual(Q, [[{m:[2], coef:1}, {m:[1], coef:1}, {m:[0], coef:3}]])
    t.deepEqual(r, [{m:[0], coef:5}])
})

test("Polynomial reduction. Two variables, two divisors.", t=> {
    // Cox, Little, O'Shea 2015. Chapter 2.3. Example 4
    // yx^2 + xy^2 + y^2  =  (x + 1)*(y^2 - 1) + x*(xy - 1) + (2x+1)
    
    let divisors = [
        [{m:[0,  2], coef:1}, {m:[0, 0], coef:-1}],
        [{m:[1,  1], coef:1}, {m:[0, 0], coef:-1}],
    ]

    let dividend = [{m:[2, 1], coef:1}, {m:[1, 2], coef:1}, {m:[0, 2], coef:1}]
    let [Q, r] = p_reduce(dividend, divisors, 'lex')
    t.deepEqual(Q, [
        [{m:[1, 0], coef:1}, {m:[0, 0], coef:1}], 
        [{m:[1, 0], coef:1}]
    ])
    t.deepEqual(r, [{m:[1, 0], coef:2}, {m:[0, 0], coef:1}])
})

test("Compute S-polynomial for two variable polynomials", (t) => {
    let f = [
        {m:[3, 2], coef: 1},
        {m:[2, 3], coef: -1},
        {m:[1, 0], coef: 1}
    ]

    let g = [
        {m:[4, 1], coef: 3},
        {m:[0, 2], coef: 1},
    ]

    let S = p_spoly(f, g);

    let answer = [
        {m:[3, 3], coef: -1},
        {m:[2, 0], coef: 1},
        {m:[0, 3], coef: -1/3}
    ]

    t.deepEqual(S, answer)
})
