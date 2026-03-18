/**
 * useKB — knowledge base composable.
 *
 * Three namespace layers:
 *   core/      read-only, bundled (inference rules)
 *   euclid/    read-only, bundled (constructions)
 *   user/      editable, localStorage
 *
 * Exposes:
 *   kb          — merged KnowledgeBase for inference
 *   predicates  — sorted list of { name, namespace, readOnly }
 *   userClauses — reactive user/ clause list (editable)
 *   addUserClause / updateUserClause / deleteUserClause
 */

import { ref, computed } from 'vue'
import { parseRules, parseLemmas, type Lemma } from '../language/parser'
import { KnowledgeBase } from '../kb/inference'
import coreGeo   from '../language/core.geo?raw'
import euclidGeo from '../language/euclid.geo?raw'
import lemmasGeo from '../language/lemmas.geo?raw'

export type Namespace = 'core' | 'euclid' | 'lemmas' | 'user'
export type { Lemma }

export interface UserClause {
  id: string
  source: string       // raw EL2 text for this single clause
  namespace: Namespace
}

// ── Foundation rules (parse once) ────────────────────────────────────

const coreRules   = parseRules(coreGeo)
const euclidRules = parseRules(euclidGeo)
const lemmaRules  = parseRules(lemmasGeo)  // auxiliary rules like 'midpoint'
export const builtinLemmas: Lemma[] = parseLemmas(lemmasGeo)

// Build index of which predicate name lives in which namespace
const namespaceOf: Record<string, Namespace> = {}
for (const r of coreRules)   namespaceOf[r.head.name] = 'core'
for (const r of euclidRules) namespaceOf[r.head.name] = 'euclid'

// ── localStorage persistence ──────────────────────────────────────────

const LS_KEY = 'elements2.user_clauses'

function loadUserClauses(): UserClause[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as UserClause[]
  } catch {}
  return []
}

function saveUserClauses(clauses: UserClause[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(clauses)) } catch {}
}

// ── Reactive state ─────────────────────────────────────────────────────

const userClauses = ref<UserClause[]>(loadUserClauses())

// ── Derived KB ─────────────────────────────────────────────────────────

const kb = computed<KnowledgeBase>(() => {
  const userRules = userClauses.value.flatMap(c => {
    try { return parseRules(c.source) } catch { return [] }
  })
  return new KnowledgeBase([...coreRules, ...euclidRules, ...lemmaRules, ...userRules])
})

// ── Predicate index ────────────────────────────────────────────────────

export interface PredicateEntry {
  name: string
  namespace: Namespace
  readOnly: boolean
  arity: number
}

const predicates = computed<PredicateEntry[]>(() => {
  const seen = new Map<string, PredicateEntry>()

  for (const r of coreRules) {
    if (!seen.has(r.head.name))
      seen.set(r.head.name, { name: r.head.name, namespace: 'core', readOnly: true, arity: r.head.args.length })
  }
  for (const r of euclidRules) {
    if (!seen.has(r.head.name))
      seen.set(r.head.name, { name: r.head.name, namespace: 'euclid', readOnly: true, arity: r.head.args.length })
  }
  for (const c of userClauses.value) {
    try {
      const rules = parseRules(c.source)
      for (const r of rules) {
        if (!seen.has(r.head.name))
          seen.set(r.head.name, { name: r.head.name, namespace: 'user', readOnly: false, arity: r.head.args.length })
      }
    } catch {}
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const lemmaPredicates = computed<PredicateEntry[]>(() => {
  const seen = new Map<string, PredicateEntry>()
  for (const l of builtinLemmas) {
    if (!seen.has(l.head.name))
      seen.set(l.head.name, { name: l.head.name, namespace: 'lemmas', readOnly: true, arity: l.head.args.length })
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
})

// ── Mutations ──────────────────────────────────────────────────────────

function addUserClause(source: string): UserClause {
  const clause: UserClause = {
    id: crypto.randomUUID(),
    source,
    namespace: 'user',
  }
  userClauses.value = [...userClauses.value, clause]
  saveUserClauses(userClauses.value)
  return clause
}

function updateUserClause(id: string, source: string) {
  userClauses.value = userClauses.value.map(c => c.id === id ? { ...c, source } : c)
  saveUserClauses(userClauses.value)
}

function deleteUserClause(id: string) {
  userClauses.value = userClauses.value.filter(c => c.id !== id)
  saveUserClauses(userClauses.value)
}



// ── Clause lookup by predicate name ───────────────────────────────────

function clausesForPredicate(name: string) {
  // Foundation clauses (read-only source text reconstructed from rules)
  const foundation = [...coreRules, ...euclidRules]
    .filter(r => r.head.name === name)
    .map(r => ({ id: `foundation:${r.head.name}:${Math.random()}`, source: ruleToSource(r), namespace: namespaceOf[name] ?? 'euclid' as Namespace, readOnly: true }))

  // Lemma clauses (read-only, shown grouped by head predicate)
  const lemmas = builtinLemmas
    .filter(l => l.head.name === name)
    .map(l => ({ id: `lemma:${l.head.name}:${Math.random()}`, source: lemmaToSource(l), namespace: 'lemmas' as Namespace, readOnly: true }))

  // User clauses
  const user = userClauses.value
    .filter(c => { try { return parseRules(c.source).some(r => r.head.name === name) } catch { return false } })
    .map(c => ({ ...c, readOnly: false }))

  return [...foundation, ...lemmas, ...user]
}

function ruleToSource(r: any): string {
  const head = `${r.head.name} ${r.head.args.join(' ')}`
  if (!r.body || r.body.length === 0) return `${head}: -`
  const body = r.body.map((p: any) => `${p.name} ${p.args.join(' ')}`).join('\n    ')
  return r.body.length === 1
    ? `${head}: ${r.body[0].name} ${r.body[0].args.join(' ')}`
    : `${head}:\n    ${body}`
}

function lemmaToSource(l: any): string {
  const head = `${l.head.name} ${l.head.args.join(' ')}`
  if (!l.hypotheses || l.hypotheses.length === 0) return `? ${head}: -`
  const hyps = l.hypotheses.map((p: any) => `${p.name} ${p.args.join(' ')}`).join(', ')
  return `? ${head}: ${hyps}`
}

// ── Singleton export ───────────────────────────────────────────────────

export function useKB() {
  return {
    kb,
    predicates,
    lemmaPredicates,
    userClauses,
    builtinLemmas,
    addUserClause,
    updateUserClause,
    deleteUserClause,
    clausesForPredicate,
    namespaceOf: (name: string): Namespace => namespaceOf[name] ?? 'user',
  }
}
