/**
 * EL2 Inference Engine — unification, backward chaining, forward closure.
 * Port of el2/inference.py
 */

import type { Predicate, Rule } from '../language/parser'

// ── Knowledge Base ────────────────────────────────────────────────────

export class KnowledgeBase {
  private rules: Rule[]
  private byHead: Map<string, Rule[]>
  private byBody: Map<string, Rule[]>

  constructor(rules: Rule[]) {
    this.rules = rules
    this.byHead = new Map()
    this.byBody = new Map()

    for (const rule of rules) {
      const h = rule.head.name
      if (!this.byHead.has(h)) this.byHead.set(h, [])
      this.byHead.get(h)!.push(rule)

      for (const b of rule.body) {
        if (!this.byBody.has(b.name)) this.byBody.set(b.name, [])
        this.byBody.get(b.name)!.push(rule)
      }
    }
  }

  rulesWithHead(name: string): Rule[] {
    return this.byHead.get(name) ?? []
  }

  rulesWithBody(name: string): Rule[] {
    return this.byBody.get(name) ?? []
  }

  allRules(): Rule[] {
    return this.rules
  }

  extend(rules: Rule[]): KnowledgeBase {
    return new KnowledgeBase([...this.rules, ...rules])
  }
}

// ── Ground Predicates ─────────────────────────────────────────────────

export interface GroundPredicate {
  name: string
  args: readonly string[]
}

export function groundKey(p: GroundPredicate): string {
  return `${p.name}(${p.args.join(',')})`
}

// ── Substitution ──────────────────────────────────────────────────────

type Subst = Map<string, string>

function emptySubst(): Subst {
  return new Map()
}

function substClone(s: Subst): Subst {
  return new Map(s)
}

function applySubst(s: Subst, pred: Predicate): GroundPredicate {
  return {
    name: pred.name,
    args: pred.args.map(a => s.get(a) ?? a),
  }
}

// ── Unification ───────────────────────────────────────────────────────

/**
 * Unify a ground predicate (goal) with a rule head (pattern).
 * Rule variables are fresh — we only bind rule vars to goal constants.
 * Returns extended substitution or null on failure.
 */
function unify(goal: GroundPredicate, head: Predicate, s: Subst): Subst | null {
  if (goal.name !== head.name || goal.args.length !== head.args.length) return null

  const out = substClone(s)
  for (let i = 0; i < goal.args.length; i++) {
    const gArg = goal.args[i]   // always a ground constant
    const hArg = head.args[i]   // a variable name in the rule

    const bound = out.get(hArg)
    if (bound !== undefined) {
      if (bound !== gArg) return null  // conflict
    } else {
      out.set(hArg, gArg)
    }
  }
  return out
}

// ── Backward Chaining ─────────────────────────────────────────────────

/**
 * Depth-first backward chaining. Returns true if goal is provable.
 */
export function prove(
  goal: GroundPredicate,
  kb: KnowledgeBase,
  facts: Set<string> = new Set(),
  depth = 1000,
): boolean {
  const cacheGood = new Set<string>()
  const cacheBad  = new Set<string>()
  const visiting  = new Set<string>()

  function dfs(g: GroundPredicate, d: number): boolean {
    if (d === 0) return false

    const key = groundKey(g)
    if (facts.has(key))      return true
    if (cacheGood.has(key))  return true
    if (cacheBad.has(key))   return false
    if (visiting.has(key))   return false

    visiting.add(key)
    try {
      for (const rule of kb.rulesWithHead(g.name)) {
        const s = unify(g, rule.head, emptySubst())
        if (s === null) continue

        // Axiom (empty body) — succeeds immediately
        if (rule.body.length === 0) {
          cacheGood.add(key)
          return true
        }

        if (rule.body.every(b => dfs(applySubst(s, b), d - 1))) {
          cacheGood.add(key)
          return true
        }
      }

      cacheBad.add(key)
      return false
    } finally {
      visiting.delete(key)
    }
  }

  return dfs(goal, depth)
}

// ── Exceptions ────────────────────────────────────────────────────────

export class AmbiguousExpansion extends Error {}
export class NoRuleError       extends Error {}
export class DepthExceeded     extends Error {}

// ── Deterministic Expansion ───────────────────────────────────────────

/**
 * Expand goal until all leaves satisfy stopPred (i.e. are primitives).
 * Requires exactly one matching rule at each step — raises otherwise.
 */
export function expandUnique(
  goal: GroundPredicate,
  kb: KnowledgeBase,
  facts: Set<string> = new Set(),
  stopPred: (p: GroundPredicate) => boolean = () => false,
  depth = 25,
): Set<string> {
  if (stopPred(goal) || facts.has(groundKey(goal))) {
    return new Set([groundKey(goal)])
  }

  const rules = kb.rulesWithHead(goal.name)
  const matches: Array<{ rule: Rule; s: Subst }> = []
  for (const rule of rules) {
    const s = unify(goal, rule.head, emptySubst())
    if (s !== null) matches.push({ rule, s })
  }

  if (matches.length === 0) throw new NoRuleError(`No rules for ${groundKey(goal)}`)
  if (matches.length > 1)   throw new AmbiguousExpansion(`Multiple rules for ${groundKey(goal)}`)

  if (depth === 0) throw new DepthExceeded(`Depth exceeded expanding ${groundKey(goal)}`)

  const { rule, s } = matches[0]

  // Axiom — goal is a leaf
  if (rule.body.length === 0) {
    return new Set([groundKey(goal)])
  }

  const leaves = new Set<string>()
  for (const b of rule.body) {
    const expanded = expandUnique(applySubst(s, b), kb, facts, stopPred, depth - 1)
    expanded.forEach(l => leaves.add(l))
  }
  return leaves
}

// ── Forward Closure ───────────────────────────────────────────────────

/**
 * Saturate facts under all rules to a fixpoint.
 */
export function forwardClosure(
  kb: KnowledgeBase,
  seedFacts: GroundPredicate[],
  maxSteps?: number,
  goalKey?: string,
): GroundPredicate[] {
  const facts = new Map<string, GroundPredicate>()
  const index = new Map<string, GroundPredicate[]>()
  const agenda: GroundPredicate[] = []

  function addFact(f: GroundPredicate): boolean {
    const key = groundKey(f)
    if (facts.has(key)) return false
    facts.set(key, f)
    if (!index.has(f.name)) index.set(f.name, [])
    index.get(f.name)!.push(f)
    agenda.push(f)
    return key === goalKey  // true signals early-exit
  }

  for (const f of seedFacts) {
    if (addFact(f)) return [...facts.values()]
  }

  let steps = 0
  while (agenda.length > 0 && (maxSteps === undefined || steps < maxSteps)) {
    const fact = agenda.shift()!

    for (const rule of kb.rulesWithBody(fact.name)) {
      for (const s of bodySatisfied(rule.body, index, emptySubst())) {
        const head = applySubst(s, rule.head)
        if (addFact(head)) return [...facts.values()]
      }
    }
    steps++
  }

  return [...facts.values()]
}

function* bodySatisfied(
  body: Predicate[],
  index: Map<string, GroundPredicate[]>,
  s: Subst,
): Generator<Subst> {
  if (body.length === 0) { yield s; return }

  const [first, ...rest] = body
  for (const fact of index.get(first.name) ?? []) {
    const s1 = unify(fact, first, s)
    if (s1 !== null) yield* bodySatisfied(rest, index, s1)
  }
}
