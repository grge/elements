/**
 * A rule's own symmetries (symmetry.ts): renamings of its variables that map its body onto itself and
 * its head onto an equivalent head. Matching skips images of a lesser match: fewer matches, the same
 * conclusions.
 */

import { describe, it, expect } from 'vitest'
import { KnowledgeBase, unfold } from '../src/kb/inference'
import { prepare, saturate } from '../src/kb/saturate'
import { FreshNames } from '../src/kb/names'
import { parseLemmas, parseRules } from '../src/language/parser'
import { ruleSymmetries } from '../src/kb/symmetry'
import { bookRules } from './book'

const kb = new KnowledgeBase(bookRules)
const st = prepare(kb).structure

describe("a rule's symmetries", () => {
  it('side-angle-side: exchange the triangles, read both backwards, or both', () => {
    const [sas] = parseRules('eq-lines a c d f: eq-lines b a e d, eq-lines b c e f, eq-angle a b c d e f')
    expect(ruleSymmetries(sas, st)?.perms).toHaveLength(3)
  })

  it('none where the head would change: side-angle-side concluding the angle at a', () => {
    // Read backwards, the conclusion would be the angle at c: a different fact, so not a symmetry.
    const [sas] = parseRules('eq-angle b a c e d f: eq-lines b a e d, eq-lines b c e f, eq-angle a b c d e f')
    expect(ruleSymmetries(sas, st)?.perms).toHaveLength(1)
  })
})

describe('breaking them keeps every conclusion', () => {
  // Only closures that run to the end compare: a search cut by its budget stops at a different place
  // when it does less work (and gets further). Measured over the book: every complete closure of
  // chapters 1 to 3 the same, 16% less work.
  it('the same facts, with and without, where the search runs to its end', () => {
    const lemmas = parseLemmas(`? eq-angle a b c a c b: eq-lines a b a c
? eq-turn b a b c d a d c: circle o a b, circle o a c, circle o a d
? eq-turn b a b c b c b a: circle o a b, circle o a c, between a o c`)
    const facts = () => lemmas.map(l => {
      const fresh = new FreshNames()
      const seeds = l.hypotheses.flatMap(h => unfold({ name: h.name, args: h.args }, kb, new Set(), { fresh }).frontier)
      const sat = saturate(kb, seeds, { maxDerivations: 2_000_000 })
      expect(sat.exhausted).toBe(false)
      return sat.allFacts().map(f => `${f.name} ${f.args.join(' ')}`).sort()
    })
    const withBreaks = facts()
    const saved = new Map(prepare(kb).breaks)
    prepare(kb).breaks.clear()
    const without = facts()
    for (const [k, v] of saved) prepare(kb).breaks.set(k, v)
    expect(withBreaks).toEqual(without)
  })
}, 120_000)
