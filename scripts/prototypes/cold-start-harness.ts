// Cold-start experiments (review-notes.md, *Cold-start search*). Needs cold-start.patch applied.
//   npx vite-node scripts/prototypes/cold-start-harness.ts --book [--idx --eqidx --headcheck --parity] [--work=N]
//   npx vite-node scripts/prototypes/cold-start-harness.ts "<part of a lemma>" ... [--full] [--distinct-instances]
// Cold-start experiments: a set of heavy lemmas, searched as the checker does, with switches.
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseLemmas, parseRules, type Lemma } from '../../src/language/parser'
import { KnowledgeBase, unfold, type GroundPredicate } from '../../src/kb/inference'
import { FreshNames } from '../../src/kb/names'
import { showRule } from '../../src/kb/rules'
import { Saturation, prepare, relevant, FLAGS, FLAGS_DISTINCT } from '../../src/kb/saturate'
const dir = resolve(__dirname, '../../src/language')
const files = readdirSync(dir + '/book').filter(f => f.endsWith('.geo')).sort().map(f => dir + '/book/' + f)
files.push(dir + '/extra/beyond.geo')
export const kb = new KnowledgeBase(files.flatMap(f => parseRules(readFileSync(f, 'utf8'))))
export const lemmas = files.flatMap(f => parseLemmas(readFileSync(f, 'utf8')).map(l => ({ l, file: f.split('/').pop()! })))
export const show = (l: Lemma) => `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => h.name + ' ' + h.args.join(' ')).join(', ')}`
const args = process.argv.slice(2)
for (const f of ['idx', 'eqidx', 'headcheck', 'parity'] as const) if (args.includes('--' + f)) FLAGS[f] = true
if (args.includes('--distinct-instances')) FLAGS_DISTINCT.on = true
const drop = args.filter(a => a.startsWith('--drop=')).map(a => a.slice(7))
const maxWork = Number(args.find(a => a.startsWith('--work='))?.slice(7) ?? 3_000_000)
const full = args.includes('--full')
const picks = args.filter(a => !a.startsWith('--'))

export function search(l: Lemma, opts: { maxWork: number; full?: boolean }) {
  const fresh = new FreshNames()
  const unfolded = l.hypotheses.flatMap(h => unfold({ name: h.name, args: h.args }, kb, new Set(), { fresh }).frontier)
  const goal = { name: l.head.name, args: l.head.args }
  const missing = goal.args.filter(a => !unfolded.some(f => f.args.includes(a)))
  const base: GroundPredicate[] = [...unfolded, ...missing.map(a => ({ name: '__object__', args: [a] }))]
  let total = { ms: 0, work: 0, fired: 0 }
  for (const apart of [false, true]) {
    const pts = [...new Set([...unfolded, goal].flatMap(f => f.args))]
    const extra: GroundPredicate[] = []
    if (apart) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) extra.push({ name: 'distinct', args: [pts[i], pts[j]] })
    let prep = relevant(prepare(kb), FLAGS.parity ? [goal.name, 'supp'] : [goal.name])
    if (FLAGS.parity) {
      const structural = ['supp d e f a b c: supp a b c d e f', 'supp c b a d e f: supp a b c d e f', 'supp a b c g h i: supp a b c d e f, eq-angle d e f g h i', 'eq-angle d e f g h i: supp a b c d e f, supp a b c g h i']
      prep = { ...prep, rules: prep.rules.filter(r => !structural.includes(showRule(r))) }
    }
    if (drop.length) prep = { ...prep, rules: prep.rules.filter(r => !drop.some(d => showRule(r).startsWith(d))) }
    const sat = new Saturation(prep, { goal: opts.full ? undefined : goal, maxDerivations: 50_000_000, maxWork: opts.maxWork })
    const t = performance.now()
    for (const f of [...base, ...extra]) sat.assert(f)
    sat.run()
    total = { ms: total.ms + performance.now() - t, work: total.work + sat.work, fired: total.fired + sat.fired }
    const holds = sat.holds(goal)
    if (FLAGS_DISTINCT.on) console.log(`   rounds ${sat.roundsRun}, matches ${sat.fired}, distinct instances ${sat.instances.size}`)
    if (holds || apart) return { holds, apart, exhausted: sat.exhausted, facts: sat.allFacts().length, ...total }
  }
  throw new Error()
}

if (picks.length || args.includes('--book')) {
  const chosen = args.includes('--book') ? lemmas.filter(x => !x.file.startsWith('beyond')) : lemmas.filter(x => picks.some(p => show(x.l).includes(p)))
  let T = 0, W = 0, P = 0
  for (const { l } of chosen) {
    const r = search(l, { maxWork, full })
    T += r.ms; W += r.work; if (r.holds) P++
    if (!args.includes('--book') || r.ms > 1000) console.log(`${r.holds ? 'proved' : 'NOT   '}${r.apart ? ' apart' : '      '} ${String(Math.round(r.ms)).padStart(7)} ms  work ${String(r.work).padStart(9)}  matches ${String(r.fired).padStart(8)}  facts ${String(r.facts).padStart(6)}${r.exhausted ? ' (budget)' : ''}  ${show(l).slice(0, 60)}`)
  }
  console.log(`total ${(T / 1000).toFixed(1)} s, work ${W}, proved ${P}/${chosen.length}  flags ${JSON.stringify(FLAGS)} drop ${drop.length}`)
}
