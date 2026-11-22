/**
 * The stress test (roadmap, Next, step 2): each lemma of src/language/extra/beyond.geo checked as a page
 * checks it, with what its figure takes to draw.
 *
 *   npx vite-node scripts/stress.ts [--budget N] [--distinct]
 *
 * --distinct adds `distinct` for every two points a lemma names, as the figure assumes by convention
 * (closure.ts): it measures how much of the test is blocked by non-degeneracy alone.
 *
 * For each lemma: whether its hypotheses construct (or only solve, or not at all), the numeric
 * evidence on sampled figures, and the checker's verdict with how long it took.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseSource, parseRules, parseLemmas, type Lemma } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { checkLemma, checkWrittenProof } from '../src/kb/checker'
import { checkConstruction } from '../src/geometry/constructionStep'
import { extract } from '../src/geometry/extraction'
import { buildModel, plan, realise } from '../src/geometry/construction'
import { numericEvidence, type Evidence } from '../src/geometry/evidence'
import { verdict } from '../src/geometry/verdict'
import { bookLemmas, bookRules } from '../tests/book'

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined }
const budget = Number(arg('--budget') ?? 200_000)
const distinctNames = process.argv.includes('--distinct')

/** The lemma with `distinct` for every two points it names, if asked. */
function withConvention(lemma: Lemma): Lemma {
  if (!distinctNames) return lemma
  const names = [...new Set([...lemma.hypotheses.flatMap(h => h.args), ...lemma.head.args])]
  const extra = names.flatMap((a, i) => names.slice(i + 1).map(b => ({ name: 'distinct', args: [a, b] })))
  return { ...lemma, hypotheses: [...lemma.hypotheses, ...extra] }
}

const source = readFileSync(resolve(__dirname, '../src/language/extra/beyond.geo'), 'utf8')
parseSource(source)   // fail early on a syntax error
const kb = new KnowledgeBase([...bookRules, ...parseRules(source)])
// What a written proof may cite: the book's lemmas, and this file's as they are found ✓.
const citable: Lemma[] = [...bookLemmas]

function draws(lemma: Lemma): string {
  const x = extract(kb, lemma.hypotheses.map(h => ({ name: h.name, args: h.args })))
  if (x.unread.length) return `cannot draw ${x.unread[0].name}`
  const model = buildModel(x.constraints)
  const cp = plan(model)
  const r = realise(cp)
  return r.valid ? `constructs (${model.points.length} points, ${cp.dof} dof)` : 'only by solving'
}

const describeEvidence = (ev: Evidence | null) =>
  !ev ? 'no evidence' : ev.kind === 'holds' ? `holds in ${ev.samples}` : ev.kind === 'fails' ? `FAILS: ${ev.failing}` : `none: ${ev.why}`

for (const written of parseLemmas(source)) {
  const lemma = withConvention(written)
  const text = `${lemma.head.name} ${lemma.head.args.join(' ')}`
  const figure = draws(lemma)
  let ev: Evidence | null = null
  try { ev = numericEvidence(lemma, kb) } catch (e) { ev = { kind: 'none', why: `${e}` } }
  const t0 = performance.now()
  // A written proof is checked step by step (its constructions on the figures), then its head.
  const options = { consistent: () => !!ev?.witness, strict: true, distinctNames: true }
  const steps = lemma.steps ? checkWrittenProof(lemma, kb, { ...options, construct: (s, above, np) => checkConstruction(kb, s, above, np), lemmas: citable }, budget) : null
  const check = steps ? steps.head : checkLemma(lemma, kb, budget, options)
  const gaps = steps?.steps.filter(s => s.result === 'not-shown' || s.result === 'refused').map(s => `l. ${s.line} ${s.result}`) ?? []
  const ms = performance.now() - t0
  const v = gaps.length && check.result === 'verified' ? { type: 'unproven' } : verdict(check, ev)
  if (v.type === 'verified') citable.push(lemma)
  console.log(`${v.type.padEnd(9)} ${text}${steps ? ` (written: ${steps.steps.length} steps${gaps.length ? `; ${gaps.join(', ')}` : ''})` : ''}`)
  console.log(`          figure: ${figure}; evidence: ${describeEvidence(ev)}; check: ${check.result} in ${(ms / 1000).toFixed(1)} s, ${check.facts.length} facts`)
}
