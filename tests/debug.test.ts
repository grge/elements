import { describe, it } from 'vitest'
import { readFileSync } from 'fs'; import { resolve } from 'path'
import { parseRules, parseGoals } from '../src/language/parser'
import { KnowledgeBase } from '../src/kb/inference'
import { extractProblem } from '../src/geometry/extraction'
import { canonicalise } from '../src/geometry/canonicalization'
import { solve } from '../src/geometry/solver'

const kb = new KnowledgeBase([
  ...parseRules(readFileSync(resolve(__dirname, '../src/language/core.geo'), 'utf8')),
  ...parseRules(readFileSync(resolve(__dirname, '../src/language/euclid.geo'), 'utf8')),
])

function run(label: string, goalStr: string, n = 8) {
  const goals = parseGoals(goalStr)
  const problem = { points: new Set<string>(), constraints: [] as any[], lines: [] as any[], circles: [] as any[] }
  for (const g of goals) {
    const p = extractProblem(g, kb)
    p.points.forEach(pt => problem.points.add(pt))
    problem.constraints.push(...p.constraints)
  }
  canonicalise(problem)
  const results = Array.from({length:n}, () => { const t0=performance.now(); const w=solve(problem); return {ms:performance.now()-t0, e:w.energy} })
  const avg = (results.reduce((s,r)=>s+r.ms,0)/n).toFixed(0)
  const pass = results.filter(r=>r.e<0.05).length
  const flag = pass===n?'✓':pass>=n*0.75?'~':'✗'
  console.log(`${flag} ${label.padEnd(45)} avg=${String(avg).padStart(4)}ms  ${pass}/${n}  energies=[${results.map(r=>r.e.toFixed(2)).join(',')}]`)
}

describe('cases', () => {
  it('all', () => {
    run('collinear a b c d e f g h i j', 'collinear a b c d e f g h i j')
    run('circle a b c', 'circle a b c')
    run('collinear + circle (shared pts)', 'collinear a b c d e f g h i j\ncircle a b c')
    run('eq-triangle', 'eq-triangle a b c')
    run('copy-segment', 'copy-segment a b c d')
    run('circle-circle-intersection', 'circle-circle-intersection o a p b i')
  })
})
