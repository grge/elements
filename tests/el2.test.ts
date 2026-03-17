/**
 * EL2 TypeScript port — test suite.
 * Run with: npx vitest run
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { tokenize, TokenType } from '../src/language/lexer'
import { parseSource, parseRules, parseGoals } from '../src/language/parser'
import { KnowledgeBase, prove, expandUnique, forwardClosure, NoRuleError, AmbiguousExpansion } from '../src/kb/inference'
import { extractProblem } from '../src/geometry/extraction'
import { canonicalise } from '../src/geometry/canonicalization'
import { solve } from '../src/geometry/solver'
import { plan, executePlan, extractParams } from '../src/geometry/planner'

const basicGeo = readFileSync(resolve(__dirname, '../src/language/basic.geo'), 'utf8')
const foundationRules = parseRules(basicGeo)
const kb = new KnowledgeBase(foundationRules)

// ── Lexer ──────────────────────────────────────────────────────────────

describe('lexer', () => {
  it('tokenizes identifiers and colons', () => {
    const toks = tokenize('foo a b: bar c')
    const types = toks.map(t => t.type)
    expect(types).toContain(TokenType.IDENTIFIER)
    expect(types).toContain(TokenType.COLON)
  })

  it('emits EOF as last token', () => {
    const toks = tokenize('x')
    expect(toks[toks.length - 1].type).toBe(TokenType.EOF)
  })

  it('handles question token for lemmas', () => {
    const toks = tokenize('? foo a')
    expect(toks[0].type).toBe(TokenType.QUESTION)
  })
})

// ── Parser ─────────────────────────────────────────────────────────────

describe('parser', () => {
  it('parses a Horn clause', () => {
    const items = parseSource('collinear a b c: between a b c')
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('rule')
    if (items[0].kind === 'rule') {
      expect(items[0].rule.head.name).toBe('collinear')
      expect(items[0].rule.body).toHaveLength(1)
      expect(items[0].rule.body[0].name).toBe('between')
    }
  })

  it('parses an axiom (no body)', () => {
    const items = parseSource('eq-lines a b b a: -')
    expect(items[0].kind).toBe('rule')
    if (items[0].kind === 'rule') {
      expect(items[0].rule.body).toHaveLength(0)
    }
  })

  it('parses a bare goal', () => {
    const items = parseSource('eq-triangle a b c')
    expect(items[0].kind).toBe('goal')
    if (items[0].kind === 'goal') {
      expect(items[0].pred.name).toBe('eq-triangle')
      expect(items[0].pred.args).toEqual(['a', 'b', 'c'])
    }
  })

  it('parses a lemma with hypotheses', () => {
    const items = parseSource('? collinear a b c: between a b c')
    expect(items[0].kind).toBe('lemma')
    if (items[0].kind === 'lemma') {
      expect(items[0].lemma.head.name).toBe('collinear')
      expect(items[0].lemma.hypotheses).toHaveLength(1)
    }
  })

  it('loads 20 rules from basic.geo', () => {
    expect(foundationRules.length).toBe(20)
  })
})

// ── Inference ──────────────────────────────────────────────────────────

describe('inference', () => {
  it('proves collinear from between fact', () => {
    const goal = { name: 'collinear', args: ['a','b','c'] }
    const facts = new Set(['between(a,b,c)'])
    expect(prove(goal, kb, facts)).toBe(true)
  })

  it('fails to prove with no facts', () => {
    const goal = { name: 'collinear', args: ['a','b','c'] }
    expect(prove(goal, kb)).toBe(false)
  })

  it('proves axiom directly', () => {
    const goal = { name: 'eq-lines', args: ['a','b','b','a'] }
    expect(prove(goal, kb)).toBe(true)
  })

  it('throws NoRuleError for unknown predicate', () => {
    const goal = { name: 'nonexistent', args: ['a'] }
    expect(() => expandUnique(goal, kb)).toThrow(NoRuleError)
  })

  it('expands eq-triangle to circle leaves', () => {
    const goal = { name: 'eq-triangle', args: ['a','b','c'] }
    const leaves = expandUnique(goal, kb, new Set(), p => p.name === 'circle')
    expect([...leaves]).toContain('circle(a,b,c)')
    expect([...leaves]).toContain('circle(b,a,c)')
  })

  it('forward closure derives eq-point from eq-lines axiom', () => {
    const seed = [{ name: 'eq-lines', args: ['a','b','c','c'] }]
    const facts = forwardClosure(kb, seed)
    const names = facts.map(f => f.name)
    expect(names).toContain('eq-point')
  })
})

// ── Geometry pipeline ──────────────────────────────────────────────────

function solveGoal(goalStr: string) {
  const goals = parseGoals(goalStr)
  const problem = { points: new Set<string>(), constraints: [] as any[], lines: [] as any[], circles: [] as any[] }
  for (const g of goals) {
    const p = extractProblem(g, kb)
    p.points.forEach(pt => problem.points.add(pt))
    problem.constraints.push(...p.constraints)
  }
  canonicalise(problem)
  return { problem, witness: solve(problem) }
}

/** Run solveGoal multiple times and expect at least `minPasses` successes */
function reliableSolve(goalStr: string, minPasses = 4, runs = 5) {
  let passes = 0
  for (let i = 0; i < runs; i++) {
    const { witness } = solveGoal(goalStr)
    if (witness.energy < 0.05) passes++
  }
  return passes >= minPasses
}

describe('geometry extraction', () => {
  it('eq-triangle extracts 2 circles', () => {
    const { problem } = solveGoal('eq-triangle a b c')
    expect(problem.circles.length).toBe(2)
    expect(problem.lines.length).toBe(0)
  })

  it('line-line-intersection extracts 2 lines', () => {
    const { problem } = solveGoal('line-line-intersection a b c d i')
    expect(problem.lines.length).toBe(2)
  })
})

describe('geometry solver', () => {
  it('eq-triangle solves reliably', () => {
    expect(reliableSolve('eq-triangle a b c', 5, 5)).toBe(true)
  })

  it('copy-segment solves reliably', () => {
    expect(reliableSolve('copy-segment a b c d', 5, 5)).toBe(true)
  })

  it('circle-circle-intersection solves reliably', () => {
    expect(reliableSolve('circle-circle-intersection o a p b i', 5, 5)).toBe(true)
  })

  it('line-line-intersection solves reliably', () => {
    expect(reliableSolve('line-line-intersection a b c d i', 5, 5)).toBe(true)
  })

  it('circle-line-intersection solves reliably', () => {
    expect(reliableSolve('circle-line-intersection o a b c i', 5, 5)).toBe(true)
  })

  it('witness has all expected points', () => {
    const { witness } = solveGoal('eq-triangle a b c')
    expect(witness.coords.has('a')).toBe(true)
    expect(witness.coords.has('b')).toBe(true)
    expect(witness.coords.has('c')).toBe(true)
  })

  it('circle points equidistant from center', () => {
    // Solve 5 times, check best
    let best = Infinity
    for (let i = 0; i < 5; i++) {
      const { problem, witness } = solveGoal('eq-triangle a b c')
      if (witness.energy < best) {
        best = witness.energy
        // Check circle constraint
        for (const circle of problem.circles) {
          const [cx, cy] = witness.coords.get(circle.center)!
          const radii = [...circle.points].map(p => {
            const [x, y] = witness.coords.get(p)!
            return Math.hypot(x - cx, y - cy)
          })
          const mean = radii.reduce((a, b) => a + b) / radii.length
          for (const r of radii) {
            expect(Math.abs(r - mean)).toBeLessThan(0.1)
          }
        }
      }
    }
  })
})

// ── Construction Planner ───────────────────────────────────────────────

describe('construction planner', () => {
  it('produces a plan for eq-triangle', () => {
    const { problem, witness } = solveGoal('eq-triangle a b c')
    const result = plan(problem, witness)
    expect(result).not.toBeNull()
    if (result) {
      expect(result.plan.length).toBe(3)
      expect(result.totalDOF).toBeGreaterThanOrEqual(0)
    }
  })

  it('executes a plan and recovers all points', () => {
    const { problem, witness } = solveGoal('eq-triangle a b c')
    const result = plan(problem, witness)
    expect(result).not.toBeNull()
    if (result) {
      const params = extractParams(result.plan, witness, problem)
      const coords = executePlan(result.plan, params, problem)
      expect(coords).not.toBeNull()
      if (coords) {
        expect(coords.has('a')).toBe(true)
        expect(coords.has('b')).toBe(true)
        expect(coords.has('c')).toBe(true)
      }
    }
  })

  it('plan covers all points in problem', () => {
    const { problem, witness } = solveGoal('copy-segment a b c d')
    const result = plan(problem, witness)
    expect(result).not.toBeNull()
    if (result) {
      const plannedPoints = new Set(result.plan.map(s => s.point))
      for (const pt of problem.points) {
        expect(plannedPoints.has(pt)).toBe(true)
      }
    }
  })
})
