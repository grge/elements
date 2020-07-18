import test from 'ava';

import { m_eq, m_mul, m_degree, m_cmp_lex, m_cmp_grlex, m_cmp_grevlex } from '../monomial';

test('Empty monomials are equal', t => {
    t.true(m_eq([], []));
})

test('Incompatible monomials are not equal', t => {
    t.false(m_eq([0], [0, 0, 0]));
    t.false(m_eq([0], []));
    t.false(m_eq([1, 0], [1]));
    t.false(m_eq([0, 1], [1]));
})

test('Multiplication of single-variable monomials', t => {
    t.deepEqual(m_mul([1], [1]), [2]);
    t.deepEqual(m_mul([2], [1]), [3]);
    t.deepEqual(m_mul([0], [1]), [1]);
})

test('Multiplication of multi-variable monomials', t => {
    t.deepEqual(m_mul([0, 1], [0, 1]), [0, 2]);
    t.deepEqual(m_mul([2, 0, 1], [0, 1, 0]), [2, 1, 1]);
    t.deepEqual(m_mul([1, 2, 3], [3, 2, 1]), [4, 4, 4]);
})

test('Multiplication of incompatible monomials throws TypeError', t => {
    t.throws(() => m_mul([0], [0, 1]), {instanceOf: TypeError})
    t.throws(() => m_mul([0, 1, 1], []), {instanceOf: TypeError})
})

test("Monomial degree is sum of exponents", t => {
    t.is(m_degree([1, 1, 1]), 3);
    t.is(m_degree([0, 1, 0, 1, 1, 0, 0]), 3)
    t.is(m_degree([0, 1, 0, 1, 1, 100, 0]), 103)
})

test("Lexicographic order", t => {
    t.true(m_cmp_lex([1, 2, 0], [0, 3, 4]) < 0)
    t.true(m_cmp_lex([3, 2, 4], [3, 2, 1]) < 0)
})

test("Graded lexicographic order", t => {
    t.true(m_cmp_grlex([1, 2, 3], [3, 2, 0]) < 0)
    t.true(m_cmp_grlex([1, 2, 4], [1, 1, 5]) < 0)
})

test("Reverse graded lexicographic order", t => {
    t.true(m_cmp_grevlex([4, 7, 1], [4, 2, 3]) < 0)
    t.true(m_cmp_grevlex([1, 5, 2], [4, 1, 3]) < 0)
})

test("Lexical order sorts by exponent order", t => {
    let not_sorted = [[0, 1, 0], [1, 0, 0], [0, 0, 1]];
    let sorted = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    t.deepEqual(not_sorted.sort(m_cmp_lex), sorted)
})