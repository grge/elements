/**
 * The spike's test: fastcore.ts against saturate.ts on chapters 1 to 4 without the words that need a
 * solver (eq-turn, quad-sum, eq-ratio, cyclic). For every lemma, both engines get the same prepared
 * rules and the same unfolded hypotheses, and
 *   - full: where saturate's closure completes within --full-work (default 3 million), both closures,
 *     compared fact for fact both ways (every fact of each holds in the other);
 *   - goal: the search as the checker runs it (plain, then with every two points distinct), with the
 *     same verdict required and both timed.
 *
 *   npx vite-node scripts/prototypes/fastcore-compare.ts [part of a lemma] [--full-work=N] [--goal-work=N] [--no-full]
 */
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseLemmas, parseRules, type Lemma } from '../../src/language/parser'
import { KnowledgeBase, unfold, type GroundPredicate } from '../../src/kb/inference'
import { FreshNames } from '../../src/kb/names'
import { Saturation, prepare, relevant } from '../../src/kb/saturate'
import { Core } from './fastcore'

const dir = resolve(__dirname, '../../src/language/book')
const files = readdirSync(dir).filter(f => /^0[1-4]/.test(f)).sort()
const BANNED = new Set(['eq-turn', 'quad-sum', 'eq-ratio', 'cyclic'])
const uses = (names: string[]) => names.some(n => BANNED.has(n))
const rules = files.flatMap(f => parseRules(readFileSync(resolve(dir, f), 'utf8'))).filter(r => !uses([r.head.name, ...r.body.map(b => b.name)]))
const kb = new KnowledgeBase(rules)
const lemmas = files.flatMap(f => parseLemmas(readFileSync(resolve(dir, f), 'utf8')).map(l => ({ l, chapter: Number(f.slice(0, 2)) })))
  .filter(({ l }) => !uses([l.head.name, ...l.hypotheses.map(h => h.name)]))
const show = (l: Lemma) => `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => h.name + ' ' + h.args.join(' ')).join(', ')}`
const args = process.argv.slice(2)
const num = (k: string, d: number) => Number(args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d)
const fullWork = num('full-work', 3_000_000), goalWork = num('goal-work', 3_000_000)
const pick = args.find(a => !a.startsWith('--'))
const BIG = 1e15

/** Saturate's closure as facts: stored facts, equalities, and each block with its class's root. */
function satFacts(sat: Saturation): GroundPredicate[] {
  const out = sat.allFacts()
  for (const [p, c] of (sat as any).tuples as Map<string, { parent: Map<string, string> }>) for (const k of c.parent.keys()) {
    const r = (sat as any).rootIn(c.parent, k)
    if (r !== k) out.push({ name: p, args: [...k.split('\u0001'), ...r.split('\u0001')] })
  }
  return out
}

function seedsOf(l: Lemma, apart: boolean): GroundPredicate[] {
  const fresh = new FreshNames()
  const unfolded = l.hypotheses.flatMap(h => unfold({ name: h.name, args: h.args }, kb, new Set(), { fresh }).frontier)
  const missing = l.head.args.filter(a => !unfolded.some(f => f.args.includes(a)))
  const out = [...unfolded, ...missing.map(a => ({ name: '__object__', args: [a] }))]
  if (apart) {
    const pts = [...new Set([...unfolded.flatMap(f => f.args), ...l.head.args])]
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) out.push({ name: 'distinct', args: [pts[i], pts[j]] })
  }
  return out
}

const time = <T>(f: () => T): [T, number] => { const t = performance.now(); const r = f(); return [r, performance.now() - t] }

let fullSame = 0, fullDiff = 0, fullSkipped = 0, goalSame = 0, goalDiff = 0
let satFullMs = 0, coreFullMs = 0, satGoalMs = 0, coreGoalMs = 0
const rows: string[] = []
for (const { l, chapter } of lemmas) {
  if (pick && !show(l).includes(pick)) continue
  const goal = { name: l.head.name, args: l.head.args }
  const prep = relevant(prepare(kb), [goal.name])
  const seeds = seedsOf(l, false)

  // full closures
  let fullNote = 'full skipped'
  if (!args.includes('--no-full')) {
    const [sat, ts] = time(() => { const s = new Saturation(prep, { maxDerivations: BIG, maxWork: fullWork }); seeds.forEach(f => s.assert(f)); s.run(); return s })
    if (sat.exhausted) { fullSkipped++; fullNote = `full: saturate out of ${fullWork} work` }
    else {
      const [core, tc] = time(() => { const c = new Core(prep, { maxDerivations: BIG, maxWork: BIG }); seeds.forEach(f => c.assert(f)); c.run(); return c })
      const a = satFacts(sat), b = core.allFacts()
      const missingInCore = a.filter(f => !core.holds(f)), missingInSat = b.filter(f => !sat.holds(f))
      const same = missingInCore.length === 0 && missingInSat.length === 0
      same ? fullSame++ : fullDiff++
      satFullMs += ts; coreFullMs += tc
      fullNote = `full ${same ? 'same' : `DIFFERENT (${missingInCore.length} missing in core, ${missingInSat.length} extra)`} ${a.length}/${b.length} facts; saturate ${Math.round(ts)} ms, core ${Math.round(tc)} ms (${(ts / Math.max(tc, 0.01)).toFixed(1)}×)`
      if (!same) for (const f of [...missingInCore.slice(0, 3).map(f => '-' + f.name + ' ' + f.args.join(' ')), ...missingInSat.slice(0, 3).map(f => '+' + f.name + ' ' + f.args.join(' '))]) fullNote += `\n      ${f}`
    }
  }

  // goal searches, as the checker runs them
  let satRes = '', coreRes = '', ts = 0, tc = 0
  for (const apart of [false, true]) {
    const s = seedsOf(l, apart)
    const [sh, t1] = time(() => { const x = new Saturation(prep, { goal, maxDerivations: BIG, maxWork: goalWork }); s.forEach(f => x.assert(f)); x.run(); return x.holds(goal) ? 'proved' : x.exhausted ? 'budget' : 'no' })
    const [ch, t2] = time(() => { const x = new Core(prep, { goal, maxDerivations: BIG, maxWork: BIG }); s.forEach(f => x.assert(f)); x.run(); return x.holds(goal) ? 'proved' : 'no' })
    ts += t1; tc += t2
    satRes = sh + (apart ? ' apart' : ''); coreRes = ch + (apart ? ' apart' : '')
    if (sh === 'proved' || ch === 'proved') break
  }
  const agree = satRes === coreRes || satRes.startsWith('budget')
  agree ? goalSame++ : goalDiff++
  satGoalMs += ts; coreGoalMs += tc
  rows.push(`ch${chapter} goal ${satRes.padEnd(12)}/ ${coreRes.padEnd(12)} saturate ${String(Math.round(ts)).padStart(6)} ms, core ${String(Math.round(tc)).padStart(5)} ms (${(ts / Math.max(tc, 0.01)).toFixed(1).padStart(5)}×)  ${agree ? '' : 'VERDICTS DIFFER  '}${show(l).slice(0, 60)}\n      ${fullNote}`)
  console.log(rows[rows.length - 1])
}
console.log(`\nfull closures: ${fullSame} same, ${fullDiff} different, ${fullSkipped} skipped (saturate over budget); saturate ${(satFullMs / 1000).toFixed(1)} s, core ${(coreFullMs / 1000).toFixed(1)} s (${(satFullMs / Math.max(coreFullMs, 1)).toFixed(1)}×)`)
console.log(`goal searches: ${goalSame} agree, ${goalDiff} differ; saturate ${(satGoalMs / 1000).toFixed(1)} s, core ${(coreGoalMs / 1000).toFixed(1)} s (${(satGoalMs / Math.max(coreGoalMs, 1)).toFixed(1)}×)`)
