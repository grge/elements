/**
 * useKB — the knowledge base: the bundled book plus the user's own clauses.
 *
 * The book is every `.geo` file in src/language/book/, one chapter per file in file-name order; a
 * chapter's title is its first comment line. The user's clauses live in the browser.
 *
 * Each clause belongs to a namespace (a chapter's id, or 'user'). A rule belongs to the predicate of
 * its head. A lemma belongs to the predicate it is about: of the predicates it mentions, the one
 * defined latest in the book (so `? eq-lines a c b d: vesica a b c d` belongs to vesica).
 */

import { ref, computed } from 'vue'
import { parseRules, parseSource, parseGeoFile, validateConsistentArities, type Lemma, type Rule, type TopLevel, type SourceRef } from '../language/parser'
import { KnowledgeBase } from '../kb/inference'

/** A chapter's id (its file name without `.geo`), or 'user'. */
export type Namespace = string
export type { Lemma, SourceRef }

export interface Chapter {
  id: Namespace
  title: string
}

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
  /** Argument names to show: its definition's (`vesica a b c d`), or plain letters if it has none. */
  args: string[]
  /** The first paragraph of its first clause's doc comment, if it has one. */
  doc?: string
}

export interface ClauseItem {
  id: string
  source: string
  predName: string
  namespace: Namespace
  readOnly: boolean
  sourceRef?: SourceRef
  /** For a rule, its head's arguments. */
  args?: string[]
  /** For a rule, the first paragraph of its doc comment. */
  doc?: string
}

const chapterSources = import.meta.glob('../language/book/*.geo', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const loaded = Object.entries(chapterSources)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, source]) => {
    const file = path.split('/').pop()!
    const id = file.replace(/\.geo$/, '')
    const title = source.match(/^#\s*(.+)$/m)?.[1].trim() ?? id
    return { id, title, file, source, items: parseGeoFile(source, file) }
  })
validateConsistentArities(loaded.map(c => ({ sourceName: c.file, items: c.items })))

export const chapters: Chapter[] = loaded.map(({ id, title }) => ({ id, title }))
const bookRules: Rule[] = loaded.flatMap(c => parseRules(c.source))

// Where each predicate is first defined in the book (chapter, then position), for ordering.
const definedAt = new Map<string, number>()
loaded.forEach((c, ci) => c.items.forEach((item, ii) => {
  if (item.kind === 'rule' && !definedAt.has(item.rule.head.name)) definedAt.set(item.rule.head.name, ci * 100_000 + ii)
}))

function owner(lemma: Lemma): string {
  const mentioned = [lemma.head, ...lemma.hypotheses].map(p => p.name).filter(n => definedAt.has(n))
  return mentioned.reduce((best, n) => definedAt.get(n)! > definedAt.get(best)! ? n : best, mentioned[0] ?? lemma.head.name)
}

const builtinClauses: ClauseItem[] = loaded.flatMap(c => c.items.flatMap(item => toClauseItem(item, c.id)))

/** A clause with its doc comment above it, each paragraph of the comment on one line (the editor wraps it). */
function withDocComment(source: string, item: TopLevel): string {
  if (!item.docComment) return source
  const paragraphs = item.docComment.split(/\n\s*\n/).map(p => p.split('\n').map(l => l.trim()).join(' '))
  return `${paragraphs.map(p => `# ${p}`).join('\n#\n')}\n${source}`
}

/** The first paragraph of a doc comment, as one line. */
function firstParagraph(doc: string | undefined): string | undefined {
  return doc?.split(/\n\s*\n/)[0].split('\n').map(l => l.trim()).join(' ') || undefined
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
        args: item.rule.head.args,
        doc: firstParagraph(item.docComment),
      }]
    case 'lemma':
      return [{
        id: `lemma:${item.lemma.head.name}:${Math.random()}`,
        source: withDocComment(lemmaToSource(item.lemma), item),
        predName: owner(item.lemma),
        namespace,
        readOnly: true,
        sourceRef: item.sourceRef,
      }]
    default:
      return []
  }
}

// The name predates the project's rename; changing it would lose clauses users have saved.
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
  return new KnowledgeBase([...bookRules, ...userRules])
})

/** The contradiction marker: a predicate of the logic, not something to browse. */
const RESERVED_FALSE = 'false'

const predicates = computed<PredicateEntry[]>(() => {
  const seen = new Map<string, PredicateEntry>()

  for (const item of builtinClauses) {
    if (item.predName === RESERVED_FALSE) continue
    const key = `${item.namespace}:${item.predName}`
    const entry = seen.get(key)
    if (!entry) {
      seen.set(key, {
        name: item.predName,
        namespace: item.namespace,
        readOnly: true,
        arity: arityOf(item),
        args: item.args ?? [],
        doc: item.doc,
      })
    } else {
      if (!entry.args.length && item.args) entry.args = item.args
      entry.doc ??= item.doc
    }
  }
  for (const c of userClauses.value) {
    try {
      for (const item of parseSource(c.source)) {
        if (item.kind !== 'rule') continue
        const r = item.rule
        const key = `user:${r.head.name}`
        if (!seen.has(key)) {
          seen.set(key, {
            name: r.head.name,
            namespace: 'user',
            readOnly: false,
            arity: r.head.args.length,
            args: r.head.args,
            doc: firstParagraph(item.docComment),
          })
        }
      }
    } catch {}
  }

  // Show a defined predicate with its definition's arguments; anything else (axioms such as
  // `eq-lines a b b a` come first) with plain letters.
  const definitions = kb.value.definitions()
  for (const entry of seen.values()) {
    const def = definitions.get(entry.name)
    entry.args = def?.kind === 'definition'
      ? def.clause.head.args
      : Array.from({ length: entry.arity }, (_, i) => String.fromCharCode(97 + i))
  }

  // Book predicates in the order the book defines them; the user's alphabetically, after.
  const rank = (p: PredicateEntry) => definedAt.get(p.name) ?? Infinity
  return [...seen.values()].sort((a, b) =>
    (a.namespace === 'user' ? 1 : 0) - (b.namespace === 'user' ? 1 : 0) || rank(a) - rank(b) || a.name.localeCompare(b.name)
  )
})

function arityOf(item: ClauseItem): number {
  const firstNonCommentLine = item.source.split('\n').find(line => !line.trimStart().startsWith('#')) ?? ''
  const firstLine = firstNonCommentLine.replace(/^\? /, '').split(':')[0].trim()
  return firstLine ? firstLine.split(/\s+/).length - 1 : 0
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

/** The user clause (if any) that has a clause for `predName`. */
function userClauseFor(predName: string): UserClause | null {
  return userClauses.value.find(c => {
    try { return parseRules(c.source).some(r => r.head.name === predName) }
    catch { return false }
  }) ?? null
}

function deleteUserClause(id: string) {
  userClauses.value = userClauses.value.filter(c => c.id !== id)
  saveUserClauses(userClauses.value)
}

export function useKB() {
  return {
    kb,
    predicates,
    userClauses,
    chapters,
    addUserClause,
    updateUserClause,
    deleteUserClause,
    clausesForPredicate,
    userClauseFor,
  }
}
