/**
 * Where an element of the figure came from (design.md, "Where each element came from"): the facts
 * that made it, each with the written fact it was unfolded from and how deep; for a mark, the chain
 * of equalities that makes it equal to the others.
 *
 *   circle a b c, in eq-triangle a b c (line 2), one level down
 *   ab = bc (proven, of eq-triangle a b c) = ac (proven, of eq-triangle a b c)
 */

import type { GroundPredicate } from '../kb/inference'
import { displayName } from '../kb/names'
import type { DrawableFact } from './extraction'
import type { Figure } from './figure'
import type { MarkClass, MarkSource } from './marks'

/** An element of the figure as the diagram reports it: the facts that made it, and its mark if any. */
export interface ElementRef { facts: string[]; mark: { mark: number; member: number } | null }

export interface Provenance {
  text: string
  /** Indexes of the written facts it came from. */
  origins: number[]
}

const show = (f: { name: string; args: readonly string[] }) => `${f.name} ${f.args.map(displayName).join(' ')}`
const LEVELS = ['', 'one level down', 'two levels down', 'three levels down']
const down = (depth: number) => LEVELS[depth] ?? `${depth} levels down`

/**
 * Describe an element. `written` are the page's facts (extraction's input, in order) and `lineOf`
 * says where one is written (1-based), if anywhere.
 */
export function provenance(
  figure: Figure,
  el: ElementRef,
  written: readonly GroundPredicate[],
  lineOf: (f: GroundPredicate) => number | null,
): Provenance {
  const origins = new Set<number>()
  const where = (f: DrawableFact): string => {
    if (f.origin === undefined) return show(f)
    origins.add(f.origin)
    const w = written[f.origin]
    const line = w ? lineOf(w) : null
    const at = line ? `line ${line}` : 'this page'
    if (f.depth === 0 || !w) return `${show(f)} (${at})`
    return `${show(f)}, in ${show(w)} (${at}), ${down(f.depth)}`
  }
  const facts = (keys: readonly string[]) => keys.flatMap(k => { const f = figure.sources.get(k); return f ? [f] : [] })

  if (el.mark) {
    const cls = figure.marks[el.mark.mark]
    if (cls) return { text: explainChain(cls, el.mark.member, s => reason(s, where)), origins: [...origins] }
  }
  return { text: facts(el.facts).map(where).join('; '), origins: [...origins] }
}

function reason(s: MarkSource, where: (f: DrawableFact) => string): string {
  if (s.kind === 'stated') return `stated: ${where(s.fact)}`
  if (s.kind === 'derived') return 'follows from the figure\'s facts'
  return `proven, of ${s.facts.map(where).join(' and ')}`
}

/** A member of a class as it is shown: a segment `ab`, an angle `∠abc`. */
const member = (cls: MarkClass, i: number) => `${cls.k === 3 ? '∠' : ''}${cls.members[i].points.map(displayName).join('')}`

/** The class from one member, each other member with the equality that reached it (breadth first). */
export function explainChain(cls: MarkClass, from: number, why: (s: MarkSource) => string): string {
  const parts = [member(cls, from)]
  const seen = new Set([from])
  const queue = [from]
  while (queue.length) {
    const m = queue.shift()!
    for (const e of cls.edges) {
      const next = e.from === m ? e.to : e.to === m ? e.from : -1
      if (next < 0 || seen.has(next)) continue
      seen.add(next)
      queue.push(next)
      parts.push(`${member(cls, next)} (${why(e.source)})`)
    }
  }
  return parts.join(' = ')
}
