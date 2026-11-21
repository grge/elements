/**
 * The vocabulary: every name the knowledge base mentions, with what it can do and where each
 * capability comes from (the index, an alternative to the contents by chapter).
 *
 * A capability comes from one of three places:
 *
 *   itself      the relation table declares it (relations.ts): the plane's own meaning of the word.
 *   definition  the word unfolds, through its definition, to words that have it: a vesica is drawn
 *               because its definition is circles, and the planner reads those.
 *   rules       the engine proves it from the word's own clauses (structure.ts): an equivalence, a
 *               symmetry, the equality. Nothing here is declared.
 *
 * What a word unfolds to is read exactly as a page reads it (extraction.ts), and whether a claim of
 * it can be measured exactly as numeric evidence decides it (evidence.ts): so the index says what
 * the system does, not what it might.
 */

import type { KnowledgeBase } from '../kb/inference'
import { analyseStructure } from '../kb/structure'
import { extract } from './extraction'
import { RELATIONS, relationOf } from './relations'

/** Where a capability comes from, or 'none'. */
export type Source = 'itself' | 'definition' | 'none'

export interface Capability {
  source: Source
  /** The words it comes through (for 'definition'), or what it is (`ticks`), for showing. */
  detail: string[]
}

/** Whether a claim of the word can be checked against a figure's positions. */
export type Measure =
  | 'itself'        // the table measures it directly
  | 'definition'    // by unfolding it to words the table measures
  | 'hypothesis'    // only as a hypothesis: unfolding it brings in points a claim does not have
  | 'none'          // unfolding reaches a word the figure cannot measure

export interface WordRow {
  name: string
  args: string[]
  /** One of the thirteen words the plane knows (the relation table). */
  plane: boolean
  /** Mentioned by some clause (a word of the plane may go unused). */
  used: boolean
  /** The book defines it (definitions.ts): a definition the engine may unfold. */
  defined: boolean
  constructs: Capability
  draws: Capability
  marks: Capability
  measured: { source: Measure; detail: string[] }
  /** Held by the checker's convention that different names are different points. */
  convention: boolean
  /** The words its definition's body uses, in order: what it rests on. Empty for an open word. */
  dependsOn: string[]
  /** Structure the engine proves from the rules. */
  discovered: ('the equality' | 'equivalence' | 'symmetric')[]
}

const RESERVED = new Set(['false'])
const letters = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i))
const unique = (xs: string[]) => [...new Set(xs)]
/** The plane's words in the table's order, then anything else: lists read the same in every row. */
const PLANE_ORDER = [...RELATIONS.keys()]
const MARK_ORDER = ['ticks', 'arcs', 'square', 'arrows', 'hatch']
const inOrder = (order: string[]) => (xs: string[]) => unique(xs).sort((a, b) =>
  ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99) || a.localeCompare(b))
const planeOrder = inOrder(PLANE_ORDER)

/** Every name the knowledge base mentions, in first-mentioned order, with its arity. */
function names(kb: KnowledgeBase): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of kb.allRules()) {
    for (const p of [r.head, ...r.body]) if (!RESERVED.has(p.name) && !out.has(p.name)) out.set(p.name, p.args.length)
  }
  return out
}

function markOf(name: string): string | null {
  const r = RELATIONS.get(name)
  return r?.classMark?.as ?? (r?.mark ? (name === 'right' ? 'square' : 'arcs') : null)
}

/** One row per name the knowledge base mentions. */
export function vocabulary(kb: KnowledgeBase): WordRow[] {
  const definitions = kb.definitions()
  const structure = analyseStructure(kb.allRules())
  const rows: WordRow[] = []

  const used = names(kb)
  // The plane's words the knowledge base never mentions are still words it could use.
  const all = new Map(used)
  for (const r of RELATIONS.values()) if (!all.has(r.name)) all.set(r.name, typeof r.arity === 'number' ? r.arity : r.arity.min)

  for (const [name, arity] of all) {
    const def = definitions.get(name)
    const defined = def?.kind === 'definition'
    const args = defined ? [...def.clause.head.args] : letters(arity)
    const own = relationOf({ name, args })
    let x: ReturnType<typeof extract> | null = null
    try { x = extract(kb, [{ name, args }]) } catch { x = null }
    const others = (facts: { name: string }[] | undefined) => planeOrder((facts ?? []).map(f => f.name).filter(n => n !== name))

    // The planner reads the leaves its unfolding reaches.
    const read = others(x?.constraints)
    const constructs: Capability = own?.read ? { source: 'itself', detail: [] }
      : read.length ? { source: 'definition', detail: read } : { source: 'none', detail: [] }

    // The figure draws the first drawn word on each path.
    const drawn = others(x?.depicted).filter(n => { const r = RELATIONS.get(n); return !!(r?.draw && r.depicted) })
    const draws: Capability = own?.draw && own.depicted ? { source: 'itself', detail: [] }
      : drawn.length ? { source: 'definition', detail: drawn } : { source: 'none', detail: [] }

    // Marks: its own, or those of the equalities its unfolding passes through.
    const ownMark = markOf(name)
    const marked = inOrder(MARK_ORDER)(others(x?.outline).flatMap(n => markOf(n) ?? []))
    const marks: Capability = ownMark ? { source: 'itself', detail: [ownMark] }
      : marked.length ? { source: 'definition', detail: marked } : { source: 'none', detail: [] }

    // Measured as evidence.ts measures a claim: unfold, then measure the leaves. A leaf the table
    // cannot measure stops it; a point the unfolding brings in leaves only the table's own measure.
    let measured: WordRow['measured']
    const leaves = x ? [...x.constraints, ...x.unread] : []
    const unmeasurable = x ? x.unread.filter(f => !relationOf(f)).map(f => f.name) : [name]
    const introduces = leaves.some(f => f.args.some(a => a.includes('#')))
    if (own?.holds) measured = { source: 'itself', detail: [] }
    else if (unmeasurable.length || !defined) measured = { source: 'none', detail: unique(unmeasurable) }
    else if (introduces) measured = { source: 'hypothesis', detail: [] }
    else measured = { source: 'definition', detail: planeOrder(leaves.map(f => f.name)) }

    const discovered: WordRow['discovered'] = []
    if (structure.equality === name) discovered.push('the equality')
    else if (structure.equivalences.has(name)) discovered.push('equivalence')
    if (structure.symmetries.has(name)) discovered.push('symmetric')

    rows.push({
      name, args, plane: RELATIONS.has(name), used: used.has(name), defined,
      constructs, draws, marks, measured,
      convention: !!own?.byNames,
      discovered,
      dependsOn: defined ? unique(def.clause.body.map(b => b.name).filter(n => n !== name && !RESERVED.has(n))) : [],
    })
  }
  return rows
}
