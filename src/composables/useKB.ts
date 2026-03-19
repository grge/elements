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
import { parseRules, parseLemmas, parseGeoFile, validateConsistentArities, type Lemma, type Rule, type TopLevel, type SourceRef } from '../language/parser'
import { KnowledgeBase } from '../kb/inference'
import coreGeo   from '../language/core.geo?raw'
import euclidGeo from '../language/euclid.geo?raw'
import lemmasGeo from '../language/lemmas.geo?raw'

export type Namespace = 'core' | 'euclid' | 'lemmas' | 'user'
export type { Lemma, SourceRef }

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

export interface ClauseItem {
  id: string
  source: string
  predName: string
  namespace: Namespace
  readOnly: boolean
  sourceRef?: SourceRef
}

const coreItems = parseGeoFile(coreGeo, 'core.geo')
const euclidItems = parseGeoFile(euclidGeo, 'euclid.geo')
const lemmaItems = parseGeoFile(lemmasGeo, 'lemmas.geo')
validateConsistentArities([
  { sourceName: 'core.geo', items: coreItems },
  { sourceName: 'euclid.geo', items: euclidItems },
  { sourceName: 'lemmas.geo', items: lemmaItems },
])

const coreRules   = parseRules(coreGeo)
const euclidRules = parseRules(euclidGeo)
const lemmaRules  = parseRules(lemmasGeo)
export const builtinLemmas: Lemma[] = parseLemmas(lemmasGeo)

const builtinClauses: ClauseItem[] = [
  ...coreItems.flatMap(item => toClauseItem(item, 'core')),
  ...euclidItems.flatMap(item => toClauseItem(item, 'euclid')),
  ...lemmaItems.flatMap(item => toClauseItem(item, 'lemmas')),
]

function withDocComment(source: string, item: TopLevel): string {
  if (!item.docComment) return source
  const doc = item.docComment.split('\n').map(line => `# ${line}`).join('\n')
  return `${doc}\n${source}`
}

function ruleToSource(r: Rule): string {
  const head = `${r.head.name} ${r.head.args.join(' ')}`
  if (!r.body || r.body.length === 0) return `${head}: -`
  const body = r.body.map((p) => `${p.name} ${p.args.join(' ')}`).join('\n    ')
  return r.body.length === 1
    ? `${head}: ${r.body[0].name} ${r.body[0].args.join(' ')}`
    : `${head}:\n    ${body}`
}

function lemmaToSource(l: Lemma): string {
  const head = `${l.head.name} ${l.head.args.join(' ')}`
  if (!l.hypotheses || l.hypotheses.length === 0) return `? ${head}: -`
  const hyps = l.hypotheses.map((p) => `${p.name} ${p.args.join(' ')}`).join(', ')
  return `? ${head}: ${hyps}`
}

function toClauseItem(item: TopLevel, namespace: Namespace): ClauseItem[] {
  switch (item.kind) {
    case 'rule':
      return [{
        id: `${namespace}:${item.rule.head.name}:${Math.random()}`,
        source: withDocComment(ruleToSource(item.rule), item),
        predName: item.rule.head.name,
        namespace,
        readOnly: true,
        sourceRef: item.sourceRef,
      }]
    case 'lemma':
      return [{
        id: `lemma:${item.lemma.head.name}:${Math.random()}`,
        source: withDocComment(lemmaToSource(item.lemma), item),
        predName: item.lemma.head.name,
        namespace,
        readOnly: true,
        sourceRef: item.sourceRef,
      }]
    default:
      return []
  }
}

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

const userClauses = ref<UserClause[]>(loadUserClauses())

const kb = computed<KnowledgeBase>(() => {
  const userRules = userClauses.value.flatMap(c => {
    try { return parseRules(c.source) } catch { return [] }
  })
  return new KnowledgeBase([...coreRules, ...euclidRules, ...lemmaRules, ...userRules])
})

const predicates = computed<PredicateEntry[]>(() => {
  const seen = new Map<string, PredicateEntry>()

  for (const item of builtinClauses) {
    if (!seen.has(`${item.namespace}:${item.predName}`)) {
      seen.set(`${item.namespace}:${item.predName}`, {
        name: item.predName,
        namespace: item.namespace,
        readOnly: true,
        arity: arityOf(item),
      })
    }
  }
  for (const c of userClauses.value) {
    try {
      for (const r of parseRules(c.source)) {
        const key = `user:${r.head.name}`
        if (!seen.has(key)) {
          seen.set(key, {
            name: r.head.name,
            namespace: 'user',
            readOnly: false,
            arity: r.head.args.length,
          })
        }
      }
    } catch {}
  }

  return [...seen.values()].sort((a, b) =>
    a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name)
  )
})

function arityOf(item: ClauseItem): number {
  const firstNonCommentLine = item.source.split('\n').find(line => !line.trimStart().startsWith('#')) ?? ''
  const firstLine = firstNonCommentLine.replace(/^\? /, '').split(':')[0].trim()
  return firstLine ? firstLine.split(/\s+/).length - 1 : 0
}

function predicatesInNS(ns: Namespace): PredicateEntry[] {
  return predicates.value.filter(p => p.namespace === ns)
}

function clausesForPredicate(name: string, ns: Namespace): ClauseItem[] {
  if (ns === 'user') {
    return userClauses.value
      .filter(c => { try { return parseRules(c.source).some(r => r.head.name === name) } catch { return false } })
      .map(c => ({ id: c.id, source: c.source, predName: name, namespace: 'user' as Namespace, readOnly: false }))
  }
  return builtinClauses.filter(c => c.predName === name && c.namespace === ns)
}

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
