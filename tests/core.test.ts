/**
 * The matching core (src/kb/core.ts) against its oracle, `Saturation` (engine-review.md: "saturate.ts
 * as the oracle, every closure compared"). Both run the same prepared rules on the same facts. On every
 * lemma of the book and *Beyond*, unfolded as the checker unfolds them (with the convention), a goal
 * search must agree in everything: whether the goal holds, whether the budget ran out, the join steps
 * (the budget's unit, which only the join order fixes) and the complete matches. A budget a tenth of
 * the checker's keeps the suite quick and catches the searches that run out alike. Full closures (no
 * goal) must hold the same facts both ways.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { KnowledgeBase, unfold, type GroundPredicate } from '../src/kb/inference'
import { FreshNames } from '../src/kb/names'
import { Saturation, prepare, relevant, type SaturateOptions } from '../src/kb/saturate'
import { Core } from '../src/kb/core'
import { parseLemmas, parseRules, type Lemma } from '../src/language/parser'
import { bookLemmas, bookRules, regressionLemmas } from './book'

const beyond = readFileSync(resolve(__dirname, '../src/language/extra/beyond.geo'), 'utf8')
const kb = new KnowledgeBase([...bookRules, ...parseRules(beyond)])
const show = (l: Lemma) => `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`
const yieldToRunner = () => new Promise(resolve => setTimeout(resolve, 0))

/** The lemma's hypotheses as the checker searches from them: unfolded, with every two points distinct. */
function seedsOf(l: Lemma): GroundPredicate[] {
  const fresh = new FreshNames()
  const unfolded = l.hypotheses.flatMap(h => unfold({ name: h.name, args: h.args }, kb, new Set(), { fresh }).frontier)
  const points = [...new Set([...unfolded.flatMap(f => f.args), ...l.head.args])]
  const missing = l.head.args.filter(a => !unfolded.some(f => f.args.includes(a))).map(a => ({ name: '__object__', args: [a] }))
  const distinct = points.flatMap((p, i) => points.slice(i + 1).map(q => ({ name: 'distinct', args: [p, q] })))
  return [...unfolded, ...missing, ...distinct]
}

function both(seeds: readonly GroundPredicate[], names: readonly string[], opts: SaturateOptions) {
  const prep = relevant(prepare(kb), names)
  const s = new Saturation(prep, opts), c = new Core(prep, opts)
  for (const f of seeds) { s.assert(f); c.assert(f) }
  s.run(); c.run()
  return { s, c }
}

describe('the core agrees with Saturation, step for step', () => {
  for (const lemma of [...bookLemmas, ...parseLemmas(beyond)]) {
    it(show(lemma), async () => {
      await yieldToRunner()
      const goal = { name: lemma.head.name, args: lemma.head.args }
      const { s, c } = both(seedsOf(lemma), [goal.name], { goal, maxWork: 300_000 })
      expect({ holds: c.holds(goal), exhausted: c.exhausted, work: c.work, matches: c.matches })
        .toEqual({ holds: s.holds(goal), exhausted: s.exhausted, work: s.work, matches: s.matches })
    }, 60_000)
  }
})

describe('full closures are the same', () => {
  for (const lemma of regressionLemmas.slice(0, 40)) {
    it(show(lemma), async () => {
      await yieldToRunner()
      const { s, c } = both(seedsOf(lemma), ['false'], { maxWork: 200_000 })
      expect(c.exhausted).toBe(s.exhausted)
      expect(c.work).toBe(s.work)
      // Fact for fact, both ways (each engine names a class by its own representative).
      expect(s.allFacts().filter(f => !c.holds(f)).map(f => `${f.name} ${f.args.join(' ')}`)).toEqual([])
      expect(c.allFacts().filter(f => !s.holds(f)).map(f => `${f.name} ${f.args.join(' ')}`)).toEqual([])
    }, 60_000)
  }
})
