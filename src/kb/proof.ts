/**
 * Proofs: why a fact follows, as the search found it (`Saturation.explain`), and an independent check
 * of one (`replay`). engine.md, *Part 1: proofs as objects*.
 *
 * A proof is a list of steps, each a fact with its justification and the facts it rests on, every one
 * of which is a hypothesis or an earlier step:
 *   rule        one rule of the knowledge base, applied to the premises (the rule's body, instantiated)
 *   solver      an integer combination of equations (turns, ratios, quadrances): the equations are the
 *               premises, with their coefficients
 *   chain       an equivalence's transitivity and symmetry, through the premises in order (equal
 *               lengths along a chain; in signed classes, flips counted by parity)
 *   same        the same fact read another way: a symmetric reading, or equal points substituted, the
 *               equalities among the premises
 *   definition  a defined fact, from an instance of its definition (the premises)
 *
 * Recognised structure (equivalences, symmetries, substitution, solvers) is trusted, as the engine
 * trusts it: it is proven from the rules (structure.ts). A replay asks the structure of `chain`, `same`
 * and `solver` steps, and matches `rule` steps against their rule.
 */

import type { Rule } from '../language/parser'
import type { GroundPredicate } from './inference'

export type Justification =
  | { kind: 'rule'; rule: Rule }
  | { kind: 'solver'; relation: string; coefficients: number[] }
  | { kind: 'chain' }
  | { kind: 'same' }
  | { kind: 'definition' }

export interface ProofStep {
  fact: GroundPredicate
  by: Justification
  premises: GroundPredicate[]
}

export interface Proof {
  goal: GroundPredicate
  /** The facts the search started from (the lemma's hypotheses, unfolded), as given. */
  hypotheses: GroundPredicate[]
  steps: ProofStep[]
}

/** What a replay needs of an engine: a store that applies recognised structure, and nothing else. */
export interface ReplayStore {
  assert(f: GroundPredicate): boolean
  holds(f: GroundPredicate): boolean
  /** Let the solvers hand back what they show, firing no rule (a solver's step may be a fact handed back). */
  settle(): boolean
}

/**
 * Check a proof without searching: assert the hypotheses, then for each step check that its premises
 * hold and that its justification gives its fact, and assert it. `fresh` makes an empty store over the
 * same knowledge base (one that fires no rules: only structure and the solvers answer). Returns the
 * index of the first step that fails, or -1 if the proof holds (its goal included).
 */
export function replay(proof: Proof, fresh: () => ReplayStore, equality: string | null): number {
  const store = fresh()
  for (const f of proof.hypotheses) store.assert(f)
  for (let i = 0; i < proof.steps.length; i++) {
    const st = proof.steps[i]
    if (!st.premises.every(p => store.holds(p))) return i
    if (st.by.kind === 'rule') {
      if (!instance(st.by.rule, st.premises, st.fact, store, equality)) return i
      store.assert(st.fact)
    } else {
      // Structure and the solvers answer these: with the premises in the store, the fact must hold.
      for (const p of st.premises) store.assert(p)
      if (st.by.kind === 'solver' && !store.holds(st.fact)) store.settle()
      if (!store.holds(st.fact)) {
        store.assert(st.fact)
        if (st.by.kind !== 'definition' || !store.holds(st.fact)) return i
      }
    }
  }
  return store.holds(proof.goal) ? -1 : proof.steps.length
}

/**
 * Is `fact` the rule's head, and `premises` its body, under one substitution? Names bound twice must be
 * one point (equal by the store's equality, as the engine substitutes equals). Head-only variables may
 * be anything.
 */
function instance(rule: Rule, premises: GroundPredicate[], fact: GroundPredicate, store: ReplayStore, equality: string | null): boolean {
  if (premises.length !== rule.body.length || fact.name !== rule.head.name || fact.args.length !== rule.head.args.length) return false
  const same = (a: string, b: string) => a === b || (!!equality && store.holds({ name: equality, args: [a, b] }))
  const sigma = new Map<string, string>()
  const bind = (v: string, x: string) => {
    const cur = sigma.get(v)
    if (cur === undefined) { sigma.set(v, x); return true }
    return same(cur, x)
  }
  for (let i = 0; i < premises.length; i++) {
    const b = rule.body[i], p = premises[i]
    if (b.name !== p.name || b.args.length !== p.args.length) return false
    if (!b.args.every((v, j) => bind(v, p.args[j]))) return false
  }
  return rule.head.args.every((v, j) => !sigma.has(v) || same(sigma.get(v)!, fact.args[j]))
}

/** A proof as text, one step a line: for tests, scripts and the page's first view of proofs. */
export function showProof(proof: Proof, ruleText: (r: Rule) => string = r => `${r.head.name} ${r.head.args.join(' ')}: ${r.body.map(b => `${b.name} ${b.args.join(' ')}`).join(', ')}`): string {
  const atom = (f: GroundPredicate) => `${f.name} ${f.args.join(' ')}`
  return proof.steps.map((s, i) => {
    const why = s.by.kind === 'rule' ? ruleText(s.by.rule)
      : s.by.kind === 'solver' ? `adding ${s.by.relation} (${s.by.coefficients.map(c => (c > 0 ? '+' : '') + c).join(' ')})`
      : s.by.kind
    return `${String(i + 1).padStart(3)}. ${atom(s.fact)}   ⟸ ${why}`
  }).join('\n')
}
