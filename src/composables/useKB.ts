/**
 * useKB — knowledge base composable.
 *
 * Three namespace layers:
 *   core/      read-only, bundled (inference rules)
 *   euclid/    read-only, bundled (constructions)
 *   lemmas/    read-only, bundled (test lemmas + auxiliary rules)
 *   user/      editable, localStorage
 *
 * All horn clauses and lemmas are stored in a single flat ClauseItem list,
 * each tagged with its source namespace. clausesForPredicate(name, ns)
 * filters that list — no special-casing per namespace.
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
  source: string
  namespace: Namespace
}

export interface PredicateEntry {
  name: string
  namespace: Namespace
  readOnly: boolean
  arity: number
}

// A unified clause item — either a horn clause or a lemma, tagged with namespace
interface ClauseItem {
  id: string
  source: string       // reconstructed source text
  predName: string
  namespace: Namespace
  readOnly: boolean
}

// ── Parse foundation files once ───────────────────────────────────────

const coreRules   = parseRules(coreGeo)
const euclidRules = parseRules(euclidGeo)
const lemmaRules  = parseRules(lemmasGeo)
export const builtinLemmas: Lemma[] = parseLemmas(lemmasGeo)

// Build flat clause index for builtin namespaces (core, euclid, lemmas)
const builtinClauses: ClauseItem[] = [
  ...coreRules.map(r   => ({ id: `core:${r.head.name}:${Math.random()}`,   source: ruleToSource(r),   predName: r.head.name, namespace: 'core'   as Namespace, readOnly: true })),
  ...euclidRules.map(r  => ({ id: `euclid:${r.head.name}:${Math.random()}`, source: ruleToSource(r),   predName: r.head.name, namespace: 'euclid'  as Namespace, readOnly: true })),
  ...lemmaRules.map(r   => ({ id: `lemmas:${r.head.name}:${Math.random()}`, source: ruleToSource(r),   predName: r.head.name, namespace: 'lemmas'  as Namespace, readOnly: true })),
  ...builtinLemmas.map(l => ({ id: `lemma:${l.head.name}:${Math.random()}`, source: lemmaToSource(l),  predName: l.head.name, namespace: 'lemmas'  as Namespace, readOnly: true })),
]

// ── Source reconstruction ─────────────────────────────────────────────

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

// ── Reactive state ────────────────────────────────────────────────────

const userClauses = ref<UserClause[]>(loadUserClauses())

// ── Derived KB ────────────────────────────────────────────────────────

const kb = computed<KnowledgeBase>(() => {
  const userRules = userClauses.value.flatMap(c => {
    try { return parseRules(c.source) } catch { return [] }
  })
  return new KnowledgeBase([...coreRules, ...euclidRules, ...lemmaRules, ...userRules])
})

// ── Predicate index ───────────────────────────────────────────────────

const predicates = computed<PredicateEntry[]>(() => {
  const seen = new Map<string, PredicateEntry>()

  for (const item of builtinClauses) {
    if (!seen.has(`${item.namespace}:${item.predName}`))
      seen.set(`${item.namespace}:${item.predName}`, { name: item.predName, namespace: item.namespace, readOnly: true, arity: arityOf(item) })
  }
  for (const c of userClauses.value) {
    try {
      for (const r of parseRules(c.source)) {
        const key = `user:${r.head.name}`
        if (!seen.has(key))
          seen.set(key, { name: r.head.name, namespace: 'user', readOnly: false, arity: r.head.args.length })
      }
    } catch {}
  }

  return [...seen.values()].sort((a, b) =>
    a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name)
  )
})

function arityOf(item: ClauseItem): number {
  // Parse arity from reconstructed source head line
  const firstLine = item.source.replace(/^\? /, '').split(':')[0].trim()
  return firstLine.split(/\s+/).length - 1
}

function predicatesInNS(ns: Namespace): PredicateEntry[] {
  return predicates.value.filter(p => p.namespace === ns)
}

// ── Clause lookup ─────────────────────────────────────────────────────

function clausesForPredicate(name: string, ns: Namespace): ClauseItem[] {
  if (ns === 'user') {
    return userClauses.value
      .filter(c => { try { return parseRules(c.source).some(r => r.head.name === name) } catch { return false } })
      .map(c => ({ id: c.id, source: c.source, predName: name, namespace: 'user' as Namespace, readOnly: false }))
  }
  return builtinClauses.filter(c => c.predName === name && c.namespace === ns)
}

// ── Mutations ─────────────────────────────────────────────────────────

function addUserClause(source: string): UserClause {
  const clause: UserClause = { id: crypto.randomUUID(), source, namespace: 'user' }
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

// ── Singleton export ──────────────────────────────────────────────────

export function useKB() {
  return {
    kb,
    predicates,
    predicatesInNS,
    userClauses,
    builtinLemmas,
    addUserClause,
    updateUserClause,
    deleteUserClause,
    clausesForPredicate,
  }
}
