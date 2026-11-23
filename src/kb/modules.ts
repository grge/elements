/**
 * Modules (foundations.md, *Modules and strata: the design*). A module is a book file, and a rule's
 * module is the file it is written in (`Rule.module`). Nothing else is declared: which module owns
 * each word, and which modules use which, are worked out from the rules.
 *
 *   ownership  A word belongs to the module holding its own rules: those whose body mentions nothing
 *              but the word and the equality (its symmetries, its equivalence axioms, the exchange of
 *              equal points). A defined word belongs to the module holding its definition. Every
 *              primitive word has such a rule; one whose own rules are in two modules, or in none, is
 *              a problem ("one fact, one home").
 *   uses       Module M uses module N when M's rule bodies mention a word N owns. The uses give the
 *              modules a partial order; a cycle is a problem.
 *   crossings  Rules concluding another module's word. They are not uses: they send results back
 *              across, and are what makes a search need a second level.
 *
 * Logic is no module's: `false`, the equality, and the objects.
 *
 * Strata (saturate.ts, `levelOf`): a search runs first the rules of the modules its words need (those
 * owning the goal's and the hypotheses' words, and all they use), then the rest. Scheduling, not
 * meaning: the closure is the same.
 */

import type { Rule } from '../language/parser'

/** The rules of a book file, each marked with its module. */
export function inModule(rules: readonly Rule[], module: string): Rule[] {
  return rules.map(r => ({ ...r, module }))
}

export type ModuleProblem =
  | { kind: 'two homes'; word: string; modules: string[] }
  | { kind: 'no home'; word: string; modules: string[] }
  | { kind: 'cycle'; modules: string[] }

export interface Crossing { rule: Rule; module: string; word: string; owner: string }

export interface ModuleAnalysis {
  /** The modules, in an order the uses respect (ties by name). */
  modules: string[]
  owner: Map<string, string>
  uses: Map<string, Set<string>>
  crossings: Crossing[]
  problems: ModuleProblem[]
}

export interface ModuleOptions {
  /** Words read as definitions: owned by the module holding the definition. */
  defined: ReadonlySet<string>
  /** Words of logic, owned by no module (`false`, the equality, the objects). */
  logic: ReadonlySet<string>
}

export function analyseModules(rules: readonly Rule[], options: ModuleOptions): ModuleAnalysis {
  const { defined, logic } = options
  const moduled = rules.filter((r): r is Rule & { module: string } => !!r.module)
  const names = [...new Set(moduled.map(r => r.module))].sort()

  // Own rules: a definition's clause, or a rule mentioning only its head's word and logic.
  const homes = new Map<string, Set<string>>()
  const concludedIn = new Map<string, Set<string>>()
  for (const r of moduled) {
    const w = r.head.name
    if (logic.has(w)) continue
    if (!concludedIn.has(w)) concludedIn.set(w, new Set())
    concludedIn.get(w)!.add(r.module)
    if (defined.has(w) || r.body.every(b => b.name === w || logic.has(b.name))) {
      if (!homes.has(w)) homes.set(w, new Set())
      homes.get(w)!.add(r.module)
    }
  }
  const owner = new Map<string, string>()
  const problems: ModuleProblem[] = []
  for (const [w, ms] of concludedIn) {
    const h = homes.get(w)
    if (!h) problems.push({ kind: 'no home', word: w, modules: [...ms].sort() })
    else if (h.size > 1) problems.push({ kind: 'two homes', word: w, modules: [...h].sort() })
    else owner.set(w, [...h][0])
  }

  const uses = new Map(names.map(m => [m, new Set<string>()]))
  const crossings: Crossing[] = []
  for (const r of moduled) {
    for (const b of r.body) {
      const o = owner.get(b.name)
      if (o && o !== r.module) uses.get(r.module)!.add(o)
    }
    const o = owner.get(r.head.name)
    if (o && o !== r.module) crossings.push({ rule: r, module: r.module, word: r.head.name, owner: o })
  }

  // The uses' order: a module after those it uses; modules on a cycle last, reported.
  const order: string[] = [], left = new Set(names)
  while (left.size) {
    const ready = [...left].filter(m => [...uses.get(m)!].every(u => !left.has(u)))
    if (!ready.length) {
      problems.push({ kind: 'cycle', modules: [...left].sort() })
      order.push(...[...left].sort())
      break
    }
    for (const m of ready.sort()) { order.push(m); left.delete(m) }
  }
  return { modules: order, owner, uses, crossings, problems }
}

/** The modules that words need: those owning them, and every module those use. */
export function needs(analysis: ModuleAnalysis, words: Iterable<string>): Set<string> {
  const out = new Set<string>(), todo: string[] = []
  for (const w of words) { const o = analysis.owner.get(w); if (o) todo.push(o) }
  while (todo.length) {
    const m = todo.pop()!
    if (out.has(m)) continue
    out.add(m)
    todo.push(...analysis.uses.get(m) ?? [])
  }
  return out
}

/** A problem, as a line for a report or a test. */
export function showProblem(p: ModuleProblem): string {
  return p.kind === 'cycle' ? `a cycle among ${p.modules.join(', ')}` : `${p.word}: ${p.kind} (${p.modules.join(', ')})`
}
