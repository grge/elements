/**
 * Inference — the knowledge base, unfolding of definitions, and the reference forward closure.
 *
 * `forwardClosure` is the plain, generic Datalog-style engine. It is the reference semantics; the
 * checker uses `saturate` (saturate.ts), which computes the same closure faster.
 */

import type { Predicate, Rule } from '../language/parser'
import { analyseDefinitions, type DefinitionStatus } from './definitions'
import { FreshNames } from './names'

// ── Knowledge Base ────────────────────────────────────────────────────

export interface KnowledgeBaseOptions {
  /** Precomputed definitional status (skips the analysis; used while the analysis itself runs). */
  definitions?: Map<string, DefinitionStatus>
}

export class KnowledgeBase {
  private rules: Rule[]
  private byHead: Map<string, Rule[]>
  private byBody: Map<string, Rule[]>
  private definitionStatus: Map<string, DefinitionStatus> | undefined

  constructor(rules: Rule[], options: KnowledgeBaseOptions = {}) {
    this.rules = rules
    this.byHead = new Map()
    this.byBody = new Map()
    this.definitionStatus = options.definitions

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

  /** Definitional status of every predicate with clauses (see definitions.ts). Computed lazily. */
  definitions(): Map<string, DefinitionStatus> {
    return this.definitionStatus ??= analyseDefinitions(this.rules)
  }

  /** The clause that defines `name` (read as if-and-only-if), if it has one. */
  definitionOf(name: string): Rule | undefined {
    const status = this.definitions().get(name)
    return status?.kind === 'definition' ? status.clause : undefined
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

function variablesOf(preds: readonly Predicate[]): Set<string> {
  return new Set(preds.flatMap(pred => pred.args))
}

function headOnlyVariables(rule: Rule): string[] {
  const bodyVars = variablesOf(rule.body)
  return [...new Set(rule.head.args.filter(arg => !bodyVars.has(arg)))]
}

function cartesianTuples(items: readonly string[], arity: number): string[][] {
  if (arity === 0) return [[]]
  if (items.length === 0) return []
  const out: string[][] = []
  const rest = cartesianTuples(items, arity - 1)
  for (const item of items) {
    for (const suffix of rest) out.push([item, ...suffix])
  }
  return out
}

function instantiateOverUniverse(
  rule: Rule,
  baseSubst: Subst,
  universe: ReadonlySet<string>,
): GroundPredicate[] {
  const freeVars = headOnlyVariables(rule)
  if (freeVars.length === 0) return [applySubst(baseSubst, rule.head)]

  const objs = [...universe]
  const tuples = cartesianTuples(objs, freeVars.length)
  const out: GroundPredicate[] = []
  for (const tuple of tuples) {
    const s = substClone(baseSubst)
    for (let i = 0; i < freeVars.length; i++) s.set(freeVars[i], tuple[i])
    out.push(applySubst(s, rule.head))
  }
  return out
}

// ── Unification ───────────────────────────────────────────────────────

function unify(goal: GroundPredicate, head: Predicate, s: Subst): Subst | null {
  if (goal.name !== head.name || goal.args.length !== head.args.length) return null

  const out = substClone(s)
  for (let i = 0; i < goal.args.length; i++) {
    const gArg = goal.args[i]
    const hArg = head.args[i]

    const bound = out.get(hArg)
    if (bound !== undefined) {
      if (bound !== gArg) return null
    } else {
      out.set(hArg, gArg)
    }
  }
  return out
}

// ── Exceptions ────────────────────────────────────────────────────────

export class DepthExceeded extends Error {}

// ── Unfolding definitions ─────────────────────────────────────────────

export interface UnfoldResult {
  frontier: GroundPredicate[]
  expanded: boolean
}

export interface UnfoldOptions {
  stopPred?: (p: GroundPredicate) => boolean
  /**
   * Supply of fresh names for the auxiliary (body-only) objects a definition introduces. Share one
   * supply across every unfolding in the same proof or drawing, so auxiliaries never collide with
   * each other; they cannot collide with user names (see names.ts).
   */
  fresh?: FreshNames
}

/**
 * Replace a goal by the body of its predicate's definition, recursively, reading definitions as
 * if-and-only-if. Which clause (if any) defines a predicate is decided by the knowledge base
 * (definitions.ts); everything without a definition is left in the frontier.
 *
 * Body-only variables are existentials: each unfolding gives them fresh names.
 * Optionally also stops early when `stopPred(goal)` is true.
 */
export function unfold(
  goal: GroundPredicate,
  kb: KnowledgeBase,
  visiting: Set<string> = new Set(),
  options: UnfoldOptions = {},
): UnfoldResult {
  const { stopPred } = options
  const fresh = options.fresh ?? new FreshNames()
  if (stopPred?.(goal)) {
    return { frontier: [goal], expanded: false }
  }

  const key = groundKey(goal)
  if (visiting.has(key)) {
    return { frontier: [goal], expanded: false }
  }

  const rule = kb.definitionOf(goal.name)
  if (!rule) return { frontier: [goal], expanded: false }

  const s = unify(goal, rule.head, emptySubst())
  if (s === null) return { frontier: [goal], expanded: false }
  for (const v of variablesOf(rule.body)) {
    if (!s.has(v)) s.set(v, fresh.next(v))
  }

  const nextVisiting = new Set(visiting)
  nextVisiting.add(key)

  const frontier: GroundPredicate[] = []
  for (const bodyPred of rule.body) {
    frontier.push(...unfold(applySubst(s, bodyPred), kb, nextVisiting, { ...options, fresh }).frontier)
  }

  return { frontier, expanded: true }
}

// ── Forward Closure ───────────────────────────────────────────────────

export function forwardClosure(
  kb: KnowledgeBase,
  seedFacts: GroundPredicate[],
  maxSteps?: number,
  goalKey?: string,
): GroundPredicate[] {
  const facts = new Map<string, GroundPredicate>()
  const index = new Map<string, GroundPredicate[]>()
  const agenda: GroundPredicate[] = []
  const universe = new Set<string>()

  const axioms = kb.allRules().filter(rule => rule.body.length === 0)
  const otherRules = kb.allRules().filter(rule => rule.body.length > 0)

  function addFact(f: GroundPredicate): boolean {
    const key = groundKey(f)
    if (facts.has(key)) return false
    facts.set(key, f)
    if (!index.has(f.name)) index.set(f.name, [])
    index.get(f.name)!.push(f)
    agenda.push(f)
    return key === goalKey
  }

  function processNewObjects(names: readonly string[]): boolean {
    const fresh: string[] = []
    for (const name of names) {
      if (!universe.has(name)) {
        universe.add(name)
        fresh.push(name)
      }
    }
    if (fresh.length === 0) return false

    for (const rule of axioms) {
      for (const fact of instantiateOverUniverse(rule, emptySubst(), universe)) {
        if (addFact(fact)) return true
      }
    }

    for (const rule of otherRules) {
      const freeVars = headOnlyVariables(rule)
      if (freeVars.length === 0) continue
      for (const s of bodySatisfied(rule.body, index, emptySubst())) {
        for (const fact of instantiateOverUniverse(rule, s, universe)) {
          if (addFact(fact)) return true
        }
      }
    }

    return false
  }

  for (const f of seedFacts) {
    const hitGoal = addFact(f)
    if (processNewObjects(f.args)) return [...facts.values()]
    if (hitGoal) return [...facts.values()]
  }

  let steps = 0
  while (agenda.length > 0 && (maxSteps === undefined || steps < maxSteps)) {
    const fact = agenda.shift()!

    for (const rule of kb.rulesWithBody(fact.name)) {
      if (rule.body.length === 0) continue

      const freeVars = headOnlyVariables(rule)
      for (const s of bodySatisfied(rule.body, index, emptySubst())) {
        const derived = freeVars.length === 0
          ? [applySubst(s, rule.head)]
          : instantiateOverUniverse(rule, s, universe)

        for (const head of derived) {
          const hitGoal = addFact(head)
          if (processNewObjects(head.args)) return [...facts.values()]
          if (hitGoal) return [...facts.values()]
        }
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
