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

// ── Unfolding definitions ─────────────────────────────────────────────

export interface UnfoldResult {
  frontier: GroundPredicate[]
  /** For each frontier fact, how many definitions were unfolded to reach it (0: the goal itself). */
  depths: number[]
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
 * One node of an unfolding: a fact, how many definitions deep it is, and (if it was unfolded) the
 * body of its definition, unfolded in turn. A node without children is where unfolding stopped: an
 * open predicate, a repeated goal, or a stopPred.
 */
export interface UnfoldNode {
  fact: GroundPredicate
  depth: number
  children: UnfoldNode[] | null
}

/**
 * Replace a goal by the body of its predicate's definition, recursively, reading definitions as
 * if-and-only-if, and keep the tree. Which clause (if any) defines a predicate is decided by the
 * knowledge base (definitions.ts). Body-only variables are existentials: each unfolding gives them
 * fresh names. Optionally stops early when `stopPred(goal)` is true.
 */
export function unfoldTree(
  goal: GroundPredicate,
  kb: KnowledgeBase,
  options: UnfoldOptions = {},
  visiting: Set<string> = new Set(),
  depth = 0,
): UnfoldNode {
  const { stopPred } = options
  const fresh = options.fresh ?? new FreshNames()
  const leaf: UnfoldNode = { fact: goal, depth, children: null }
  if (stopPred?.(goal)) return leaf

  const key = groundKey(goal)
  if (visiting.has(key)) return leaf

  const rule = kb.definitionOf(goal.name)
  if (!rule) return leaf

  const s = unify(goal, rule.head, emptySubst())
  if (s === null) return leaf
  for (const v of variablesOf(rule.body)) {
    if (!s.has(v)) s.set(v, fresh.next(v))
  }

  const nextVisiting = new Set(visiting)
  nextVisiting.add(key)
  const children = rule.body.map(b => unfoldTree(applySubst(s, b), kb, { ...options, fresh }, nextVisiting, depth + 1))
  return { fact: goal, depth, children }
}

/** The leaves of an unfolding tree, in order. */
export function leavesOf(node: UnfoldNode): UnfoldNode[] {
  return node.children ? node.children.flatMap(leavesOf) : [node]
}

/** `unfoldTree`, read as its leaves: the facts a goal means, with their depths. */
export function unfold(
  goal: GroundPredicate,
  kb: KnowledgeBase,
  visiting: Set<string> = new Set(),
  options: UnfoldOptions = {},
): UnfoldResult {
  const tree = unfoldTree(goal, kb, options, visiting)
  const leaves = leavesOf(tree)
  return { frontier: leaves.map(l => l.fact), depths: leaves.map(l => l.depth), expanded: tree.children !== null }
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
    for (const k of [f.name, ...f.args.map((a, i) => argKey(f.name, i, a))]) {
      let list = index.get(k)
      if (!list) index.set(k, list = [])
      list.push(f)
    }
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

    // Semi-naive: only matches that use this fact are new (any match of older facts alone was
    // found when the last of them was processed). So bind each body atom it fits, join the rest.
    for (const rule of new Set(kb.rulesWithBody(fact.name))) {
      if (rule.body.length === 0) continue

      const freeVars = headOnlyVariables(rule)
      const matches = rule.body.flatMap((atom, i) => {
        if (atom.name !== fact.name) return []
        const s0 = unify(fact, atom, emptySubst())
        return s0 ? [...bodySatisfied(rule.body.filter((_, j) => j !== i), index, s0)] : []
      })
      for (const s of matches) {
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

/** Index key for facts of `name` whose argument `i` is `value` (the plain name keys all of them). */
const argKey = (name: string, i: number, value: string) => `${name}\u0001${i}\u0001${value}`

/**
 * Every way to satisfy a body, extending `s`. Joins the atom with the most bound arguments first, and
 * looks its candidates up by the most selective bound argument instead of scanning every fact.
 */
function* bodySatisfied(
  body: Predicate[],
  index: Map<string, GroundPredicate[]>,
  s: Subst,
): Generator<Subst> {
  if (body.length === 0) { yield s; return }

  let best = 0, bestBound = -1
  body.forEach((atom, i) => {
    const bound = atom.args.filter(a => s.has(a)).length
    if (bound > bestBound) { best = i; bestBound = bound }
  })
  const atom = body[best]
  const rest = body.filter((_, i) => i !== best)
  let list = index.get(atom.name) ?? []
  atom.args.forEach((a, i) => {
    const v = s.get(a)
    if (v === undefined) return
    const narrower = index.get(argKey(atom.name, i, v)) ?? []
    if (narrower.length < list.length) list = narrower
  })
  // Facts added while this runs are found later, by the semi-naive step that processes them.
  for (let k = 0, n = list.length; k < n; k++) {
    const s1 = unify(list[k], atom, s)
    if (s1 !== null) yield* bodySatisfied(rest, index, s1)
  }
}
