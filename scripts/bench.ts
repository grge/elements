/**
 * The engine's benchmark, the baseline for the roadmap's engine work (measurements in docs/review-notes.md).
 *
 *   npx vite-node scripts/bench.ts [--scoped] [--witness] [--only=text] [--json]   checking: every book lemma
 *   npx vite-node scripts/bench.ts pages                               drawing: every defined predicate's page
 *
 * Checking runs each lemma as the checker does (unfold the hypotheses, saturate until the goal), then,
 * if it is proved, saturates again from the start looking for `false`, the second phase of a check.
 * (The checker skips that phase when `false` cannot be reached from the hypotheses' kinds of facts at
 * all; here it always runs, which makes chapter 1 a few seconds dearer than the checker.) Derivations
 * are counted in all, and those that added a fact. `--witness` checks as the app does: a figure of the
 * hypotheses (evidence.ts) shows them consistent, and the search for `false` runs only without one.
 * `--scoped` checks each chapter with its own rules
 * and the earlier chapters' only. `--json` prints a line per lemma.
 *
 * Pages plans and realises each defined predicate's signature as its page does, and times the closure
 * that merges its marks (useClosure.ts), which the app runs in a worker and remembers.
 *
 * Times vary by a tenth or so between runs; counts do not.
 */
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseLemmas, parseRules, type Lemma } from '../src/language/parser'
import { KnowledgeBase, unfold, type GroundPredicate } from '../src/kb/inference'
import { Saturation, prepare, relevant } from '../src/kb/saturate'
import { FreshNames } from '../src/kb/names'
import { extract } from '../src/geometry/extraction'
import { buildModel, plan, realise } from '../src/geometry/construction'
import { drawFigure } from '../src/geometry/figure'
import { closureQueries } from '../src/geometry/marks'
import { closureAnswers, assumedOf } from '../src/geometry/closure'
import { RELATIONS } from '../src/geometry/relations'
import { numericEvidence } from '../src/geometry/evidence'
import { checkWrittenProof } from '../src/kb/checker'
import { checkConstruction } from '../src/geometry/constructionStep'

const bookDir = resolve(__dirname, '../src/language/book')
const files = readdirSync(bookDir).filter(f => f.endsWith('.geo')).sort()
const source = (f: string) => readFileSync(resolve(bookDir, f), 'utf8')
// Each rule's file, for --strata (the strata spike: a stratum per file, in book order).
const fileOf = new WeakMap<object, number>()
const rulesTo = (chapter: number) => files.slice(0, chapter + 1).flatMap((f, i) => {
  const rules = parseRules(source(f))
  for (const r of rules) fileOf.set(r, i)
  return rules
})
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const only = args.find(a => a.startsWith('--only='))?.slice(7)
const show = (l: Lemma) => `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`
const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const FALSE: GroundPredicate = { name: 'false', args: [] }

// Every assertion is a derivation; the ones that return true added a fact.
let derived = 0, added = 0
let passes = 0, returns = 0, lastStrata: object | null = null
const assert = Saturation.prototype.assert
Saturation.prototype.assert = function (f: GroundPredicate) {
  derived++
  const changed = assert.call(this, f)
  if (changed) added++
  return changed
}

// --goal-first: the modules a goal needs first. A word's module is the first file with a rule concluding
// it; a module uses those whose words its rule bodies mention. Level 0 is the goal word's module and all
// it uses, interleaved; level 1 adds the rest (the strata spike, foundations.md).
const moduleRules = files.map(f => parseRules(source(f)))
const ownerOf = new Map<string, number>()
moduleRules.forEach((rs, i) => { for (const r of rs) if (!ownerOf.has(r.head.name)) ownerOf.set(r.head.name, i) })
const usesOf = moduleRules.map((rs, i) => new Set(rs.flatMap(r => r.body.map(b => ownerOf.get(b.name))).filter((o): o is number => o !== undefined && o !== i)))
function needs(word: string): Set<number> {
  const out = new Set<number>(), start = ownerOf.get(word)
  const todo = start === undefined ? [] : [start]
  while (todo.length) { const m = todo.pop()!; if (out.has(m)) continue; out.add(m); todo.push(...usesOf[m]) }
  return out
}

function saturateFrom(kb: KnowledgeBase, frontier: GroundPredicate[], goal: GroundPredicate) {
  derived = added = 0
  const t = performance.now()
  const core = new Set([goal, ...frontier].flatMap(f => [...needs(f.name)]))
  const stratumOf = flag('--goal-first') ? (r: object) => core.has(fileOf.get(r) ?? -1) ? 0 : 1
    : flag('--strata') ? (r: object) => fileOf.get(r) ?? -1 : undefined
  const sat = new Saturation(relevant(prepare(kb), [goal.name]), { goal, maxDerivations: 200_000, stratumOf, strataPolicy: flag('--widening') || flag('--goal-first') ? 'widening' : 'separate' })
  for (const f of frontier) sat.assert(f)
  sat.run()
  passes += sat.passes; returns += sat.returns
  lastStrata = { work: sat.work, ...(stratumOf ? { passes: sat.passes, returns: sat.returns, byStratum: Object.fromEntries(sat.workByStratum) } : {}) }
  return { ms: performance.now() - t, holds: sat.holds(goal), exhausted: sat.exhausted, derived, added }
}

const allLemmas = files.flatMap(f => parseLemmas(source(f)))
function writtenFrom(kb: KnowledgeBase, lemma: Lemma) {
  derived = added = 0
  const t = performance.now()
  const lemmas = allLemmas.slice(0, allLemmas.findIndex(l => show(l) === show(lemma)))
  const r = checkWrittenProof(lemma, kb, { distinctNames: true, lemmas, construct: (st, above, np) => checkConstruction(kb, st, above, np) })
  const holds = r.head.result === 'verified' && r.steps.every(st => st.result === 'follows' || st.result === 'constructed')
  return { ms: performance.now() - t, holds, exhausted: r.head.result === 'out-of-budget', derived, added }
}

function checking() {
  const all = rulesTo(files.length - 1)
  const rows: { chapter: number; goalMs: number; falseMs: number; witnessMs: number; witnessed: boolean; exhausted: boolean; derived: number; added: number; proved: boolean }[] = []
  files.forEach((file, chapter) => {
    const kb = new KnowledgeBase(flag('--scoped') ? rulesTo(chapter) : all)
    prepare(kb) // the structure analysis, once per knowledge base, outside the timings
    for (const lemma of parseLemmas(source(file))) {
      if (only && !show(lemma).includes(only)) continue
      const fresh = new FreshNames()
      const seeds = lemma.hypotheses.map(h => ({ name: h.name, args: h.args }))
      const headOnly = lemma.head.args.filter(a => !seeds.some(f => f.args.includes(a)))
      const frontier = [
        ...seeds.flatMap(f => unfold(f, kb, new Set(), { fresh }).frontier),
        ...headOnly.map(a => ({ name: '__object__', args: [a] })), // as the checker introduces them
      ]
      // A written proof is checked as the page checks it, steps and head (its time is the goal's).
      const goal = lemma.steps ? writtenFrom(kb, lemma) : saturateFrom(kb, frontier, { name: lemma.head.name, args: lemma.head.args })
      const t = performance.now()
      const witnessed = flag('--witness') && goal.holds && !!numericEvidence(lemma, kb).witness
      const witnessMs = flag('--witness') && goal.holds ? performance.now() - t : 0
      const contra = goal.holds && !witnessed ? saturateFrom(kb, frontier, FALSE) : null
      const row = {
        chapter: chapter + 1, goalMs: goal.ms, falseMs: contra?.ms ?? 0, witnessMs, witnessed, exhausted: contra?.exhausted ?? false,
        derived: goal.derived + (contra?.derived ?? 0), added: goal.added + (contra?.added ?? 0), proved: goal.holds,
      }
      rows.push(row)
      if (flag('--json')) console.log(JSON.stringify({ lemma: show(lemma), ...row, goalMs: Math.round(row.goalMs), falseMs: Math.round(row.falseMs), search: lemma.steps ? null : lastStrata }))
    }
  })
  console.log(`${flag('--scoped') ? 'each chapter with its own and earlier rules' : 'the whole book for every lemma'}`)
  console.log('chapter  lemmas  proved  goal      witness   witnessed  false     out of budget')
  const line = (label: string, rs: typeof rows) => console.log(
    `${label.padEnd(9)}${String(rs.length).padStart(6)}${String(rs.filter(r => r.proved).length).padStart(8)}  ` +
    `${s(rs.reduce((t, r) => t + r.goalMs, 0)).padEnd(10)}${s(rs.reduce((t, r) => t + r.witnessMs, 0)).padEnd(10)}` +
    `${String(rs.filter(r => r.witnessed).length).padEnd(11)}${s(rs.reduce((t, r) => t + r.falseMs, 0)).padEnd(10)}${rs.filter(r => r.exhausted).length}`)
  files.forEach((_, i) => line(String(i + 1), rows.filter(r => r.chapter === i + 1)))
  line('all', rows)
  const d = rows.reduce((t, r) => t + r.derived, 0), a = rows.reduce((t, r) => t + r.added, 0)
  console.log(`derivations ${d}, of which added a fact ${a} (${(100 * a / d).toFixed(1)}%)`)
  if (flag('--strata') || flag('--goal-first')) console.log(`strata: ${passes} passes, ${returns} returns to the lowest`)
}

function pages() {
  const kb = new KnowledgeBase(rulesTo(files.length - 1))
  const lemmas = files.flatMap(f => parseLemmas(source(f)))
  const properties = [...RELATIONS.values()].flatMap(r => r.mark && typeof r.arity === 'number' ? [{ name: r.name, arity: r.arity }] : [])
  console.log('page                        points  plan     realise  figure        marks closure')
  for (const [name, status] of kb.definitions()) {
    if (status.kind !== 'definition' || name === 'false') continue
    const fact = { name, args: status.clause.head.args }
    const x = extract(kb, [fact])
    const t0 = performance.now()
    const model = buildModel(x.constraints, fact.args)
    const cp = plan(model)
    const t1 = performance.now()
    const r = realise(cp)
    const t2 = performance.now()
    const figure = drawFigure(kb, x, lemmas)
    const queries = figure ? closureQueries(figure.marks, properties) : []
    const t3 = performance.now()
    if (queries.length) closureAnswers(kb, [...x.constraints, ...x.outline], queries.map(q => q.fact), assumedOf([...new Set(x.constraints.flatMap(f => f.args))]))
    const t4 = performance.now()
    console.log(`${name.padEnd(28)}${String(model.points.length).padStart(6)}  ${`${Math.round(t1 - t0)} ms`.padEnd(9)}${`${Math.round(t2 - t1)} ms`.padEnd(9)}` +
      `${(r.valid ? 'constructed' : 'solver').padEnd(14)}${queries.length ? `${Math.round(t4 - t3)} ms` : '-'}`)
  }
}

if (args[0] === 'pages') pages()
else checking()
