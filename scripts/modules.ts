/**
 * The book's modules (src/kb/modules.ts): which words each owns, which modules it uses, the rules that
 * cross into another module's words, and any problems (a word with two homes or none, a cycle).
 *
 *   npx vite-node scripts/modules.ts [--crossings]
 */

import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseRules } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { inModule, showProblem } from '../src/kb/modules'
import { modulesOf, prepare } from '../src/kb/saturate'
import { showRule } from '../src/kb/rules'

const bookDir = resolve(__dirname, '../src/language/book')
const files = readdirSync(bookDir).filter(f => f.endsWith('.geo')).sort()
const rules = files.flatMap(f => inModule(parseRules(readFileSync(resolve(bookDir, f), 'utf8')), f.replace(/\.geo$/, '')))
const kb = new KnowledgeBase(rules), prep = prepare(kb)
const a = modulesOf(kb)

for (const m of a.modules) {
  const owns = [...a.owner].filter(([, o]) => o === m).map(([w]) => w)
  const words = owns.filter(w => !prep.defined.has(w)), defined = owns.filter(w => prep.defined.has(w))
  const crossings = a.crossings.filter(c => c.module === m)
  console.log(m)
  console.log(`  owns     ${words.join(' ') || '-'}`)
  if (defined.length) console.log(`  defines  ${defined.join(' ')}`)
  console.log(`  uses     ${[...a.uses.get(m)!].join(', ') || '-'}`)
  if (crossings.length) {
    const byWord = new Map<string, number>()
    for (const c of crossings) byWord.set(`${c.word} (${c.owner})`, (byWord.get(`${c.word} (${c.owner})`) ?? 0) + 1)
    console.log(`  crosses  ${[...byWord].map(([w, n]) => n > 1 ? `${w} ×${n}` : w).join(', ')}`)
    if (process.argv.includes('--crossings')) for (const c of crossings) console.log(`             ${showRule(c.rule)}`)
  }
}
console.log(a.problems.length ? `problems:\n${a.problems.map(p => `  ${showProblem(p)}`).join('\n')}` : 'no problems')
