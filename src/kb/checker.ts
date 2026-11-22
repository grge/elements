import type { Lemma, Predicate, Rule } from '../language/parser'
import { Configuration } from './configuration'
import { groundKey, unfold, KnowledgeBase, type GroundPredicate } from './inference'
import { saturate } from './saturate'
import { FreshNames, displayName } from './names'
import { replay, type Proof } from './proof'
import { showRule } from './rules'
import { Saturation, prepare } from './saturate'

/**
 * verified: the goal follows. vacuous: the hypotheses (or the configuration) are contradictory, i.e.
 * they derive the reserved 0-ary predicate `false`. not-provable: the closure is complete and the goal
 * is not in it. out-of-budget: the search stopped at its budget of derivations without the goal, so it
 * may still follow. A contradiction takes precedence over the goal:
 * anything follows from it, so a ✓ would hide what the author needs to know. unshown: the goal
 * follows, but the hypotheses were not shown consistent (no witness, and the search for a
 * contradiction ran out of budget).
 *
 * Once the goal is derived, the hypotheses must be shown consistent. A caller that has a witness (a
 * figure in which every hypothesis holds: geometry/evidence.ts) says so through `consistent`, and the
 * search for a contradiction is skipped. The logic knows nothing of figures; it only takes the answer.
 */
export type CheckResult = 'verified' | 'vacuous' | 'not-provable' | 'out-of-budget' | 'invalid-query' | 'unshown'

const FALSE: GroundPredicate = { name: 'false', args: [] }


export interface CheckResponse {
  result: CheckResult
  facts: GroundPredicate[]
  message?: string
  /** The hypotheses were shown consistent by a witness rather than by a search. */
  witnessed?: boolean
  /** Verified only under the non-degeneracy convention: for figures whose points are all apart. */
  apart?: boolean
  /** Why it follows, when verified and asked for (`CheckOptions.explain`): proof.ts. */
  proof?: Proof
}

export interface CheckOptions {
  /** Are the hypotheses consistent? Asked once the goal is derived; true skips the search for `false`. */
  consistent?: () => boolean
  /** When the search for `false` runs out of budget, say so (`unshown`) rather than ✓. */
  strict?: boolean
  /**
   * The non-degeneracy convention: different names are different points, as in the figure. Every two
   * points of the unfolded hypotheses and the claim, named or introduced by a definition, are
   * `distinct`, unless the lemma itself relates them by `eq-point` (in a hypothesis or its claim,
   * directly or through others). A ✓ under it holds of figures whose points are all apart, as
   * Euclid's figures are (`apart`). Should the hypotheses force two points together, the convention
   * contradicts them, and the verdict names the two.
   *
   * The convention only adds hypotheses, so what follows without it follows with it: a lemma is
   * checked without it first, and a ✓ there is the stronger result (it holds of degenerate figures
   * too). Only a lemma that does not follow is checked again under the convention.
   */
  distinctNames?: boolean
  /** Return the proof the search found, with a verified result (`CheckResponse.proof`). */
  explain?: boolean
}

const EQUAL = 'eq-point'

/**
 * `distinct` for every two points of the facts and the goal, except those the facts or goal say are
 * one point (by `eq-point`, through any chain of them).
 */
function nonDegeneracy(facts: readonly GroundPredicate[], goal: GroundPredicate, exclude?: ReadonlySet<string>): GroundPredicate[] {
  const points = [...new Set([...facts, goal].flatMap(f => f.args))].filter(p => !exclude?.has(p))
  const parent = new Map(points.map(p => [p, p]))
  const find = (p: string): string => { const q = parent.get(p)!; if (q === p) return p; const r = find(q); parent.set(p, r); return r }
  for (const f of [...facts, goal]) if (f.name === EQUAL && f.args.length === 2) parent.set(find(f.args[0]), find(f.args[1]))
  const out: GroundPredicate[] = []
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (find(points[i]) !== find(points[j])) out.push({ name: 'distinct', args: [points[i], points[j]] })
  }
  return out
}

/** Two different names the closure made one point: why the convention contradicts the hypotheses. */
function forcedTogether(facts: readonly GroundPredicate[], assumed: readonly GroundPredicate[]): string | undefined {
  const apart = new Set(assumed.map(f => f.args.join(' ')))
  const f = facts.find(f => f.name === EQUAL && f.args[0] !== f.args[1] &&
    (apart.has(f.args.join(' ')) || apart.has([...f.args].reverse().join(' '))))
  if (!f) return undefined
  const [a, b] = f.args.map(displayName)
  return `the hypotheses make ${a} and ${b} one point, so they cannot be taken as different points`
}

function toGroundPredicate(pred: Predicate): GroundPredicate {
  return { name: pred.name, args: pred.args }
}

function dedupeFacts(facts: readonly GroundPredicate[]): GroundPredicate[] {
  const out = new Map<string, GroundPredicate>()
  for (const fact of facts) out.set(groundKey(fact), fact)
  return [...out.values()]
}

/**
 * Could facts of these predicates lead to `target` at all? Fires rules at the level of predicate
 * names only (a rule applies once every predicate in its body is reachable): an over-approximation,
 * so a "no" is certain.
 */
function mayDerive(kb: KnowledgeBase, seeds: readonly GroundPredicate[], target: string): boolean {
  const reachable = new Set(seeds.map(s => s.name))
  for (let grew = true; grew && !reachable.has(target);) {
    grew = false
    for (const rule of kb.allRules()) {
      if (!reachable.has(rule.head.name) && rule.body.every(b => reachable.has(b.name))) {
        reachable.add(rule.head.name)
        grew = true
      }
    }
  }
  return reachable.has(target)
}

function runCheckPipeline(
  goal: GroundPredicate,
  seeds: readonly GroundPredicate[],
  kb: KnowledgeBase,
  maxDerivations: number,
  options: CheckOptions = {},
): CheckResponse {
  // One supply of fresh names for the whole check, so auxiliaries of different hypotheses stay distinct.
  const fresh = new FreshNames()
  const unfolded = dedupeFacts(seeds.flatMap(seed => unfold(seed, kb, new Set(), { fresh }).frontier))
  return checkFrom(goal, unfolded, kb, maxDerivations, options)
}

/** The pipeline from facts already unfolded; `exclude` are points the convention does not cover. */
function checkFrom(
  goal: GroundPredicate,
  unfolded: readonly GroundPredicate[],
  kb: KnowledgeBase,
  maxDerivations: number,
  options: CheckOptions = {},
  exclude?: ReadonlySet<string>,
): CheckResponse {
  const assumed = options.distinctNames ? nonDegeneracy(unfolded, goal, exclude) : []
  const frontier = [...unfolded, ...assumed]
  const budget = { maxDerivations }
  const sat = saturate(kb, frontier, { goal, ...budget })
  const facts = sat.allFacts()
  const vacuous = (found: readonly GroundPredicate[]): CheckResponse => {
    const message = assumed.length ? forcedTogether(found, assumed) : undefined
    return { result: 'vacuous', facts, ...(message ? { message } : {}) }
  }
  if (!sat.holds(goal)) {
    return sat.holds(FALSE) ? vacuous(facts) : { result: sat.exhausted ? 'out-of-budget' : 'not-provable', facts }
  }
  // The goal follows; the hypotheses must also be consistent, or the ✓ would hide a contradiction.
  // Nothing to fear if `false` cannot be derived at all from these kinds of facts; a witness shows
  // it at once (a figure has its points apart, so it witnesses the convention too); otherwise the
  // search is carried on to the end, looking for `false`.
  if (sat.holds(FALSE)) return vacuous(facts)
  // The proof the search found, before any other search on these facts carries it on.
  const proof = options.explain ? sat.explain(goal, frontier) ?? undefined : undefined
  const verified = (extra: Partial<CheckResponse> = {}): CheckResponse => ({ result: 'verified', facts, ...(proof ? { proof } : {}), ...extra })
  if (!mayDerive(kb, frontier, FALSE.name)) return verified()
  if (options.consistent?.()) return verified({ witnessed: true })
  const search = saturate(kb, frontier, { goal: FALSE, ...budget })
  if (search.holds(FALSE)) return vacuous(search.allFacts())
  return search.exhausted && options.strict ? { result: 'unshown', facts } : verified()
}

function withMissingHeadObjects(seeds: readonly GroundPredicate[], lemma: Lemma): GroundPredicate[] {
  const seenObjects = new Set(seeds.flatMap(seed => seed.args))
  const missing = lemma.head.args.filter(arg => !seenObjects.has(arg))
  if (missing.length === 0) return [...seeds]
  return [
    ...seeds,
    ...missing.map(obj => ({ name: '__object__', args: [obj] } satisfies GroundPredicate)),
  ]
}

export function checkLemma(
  lemma: Lemma,
  kb: KnowledgeBase,
  maxDerivations = 2_000_000,   // a safety valve: the budget of work binds (saturate.ts MAX_WORK)
  options: CheckOptions = {},
): CheckResponse {
  const seeds = withMissingHeadObjects(
    lemma.hypotheses.map(toGroundPredicate),
    lemma,
  )
  const goal = toGroundPredicate(lemma.head)
  const plain = runCheckPipeline(goal, seeds, kb, maxDerivations, { ...options, distinctNames: false })
  if (!options.distinctNames || plain.result === 'verified' || plain.result === 'vacuous' || plain.result === 'unshown') return plain
  const apart = runCheckPipeline(goal, seeds, kb, maxDerivations, options)
  return apart.result === 'verified' ? { ...apart, apart: true } : apart
}

export function checkGroundQuery(
  pred: Predicate,
  kb: KnowledgeBase,
  configuration: Configuration,
  maxDerivations = 200_000,
): CheckResponse {
  const missing = pred.args.filter(arg => !configuration.universe.has(arg))
  if (missing.length > 0) {
    return {
      result: 'invalid-query',
      facts: configuration.allFacts(),
      message: `mentions ${missing.join(', ')}, which no fact on this page introduces`,
    }
  }
  return runCheckPipeline(toGroundPredicate(pred), configuration.allFacts(), kb, maxDerivations)
}

/**
 * Check a lemma by replaying a proof kept from an earlier check, with no search: the proof must start
 * from the lemma's hypotheses as the knowledge base unfolds them now (plain, or under the convention
 * if the proof was found so), each of its rule steps must be an instance of a rule the knowledge base
 * still has (`rules`, by the rule's text), and the replay must hold. Consistency is still asked
 * (`options.consistent`): a proof shows the goal follows, not that the hypotheses can hold. Returns
 * null when the proof cannot be used, and the caller searches.
 */
export function checkByReplay(
  lemma: Lemma,
  kb: KnowledgeBase,
  kept: { proof: Proof; apart: boolean },
  ruleText: (r: Rule) => string,
  options: CheckOptions = {},
): CheckResponse | null {
  const goal = toGroundPredicate(lemma.head)
  if (groundKey(goal) !== groundKey(kept.proof.goal)) return null
  const seeds = withMissingHeadObjects(lemma.hypotheses.map(toGroundPredicate), lemma)
  const fresh = new FreshNames()
  const unfolded = dedupeFacts(seeds.flatMap(seed => unfold(seed, kb, new Set(), { fresh }).frontier))
  const frontier = [...unfolded, ...(kept.apart ? nonDegeneracy(unfolded, goal) : [])]
  const now = new Set(frontier.map(groundKey)), then = new Set(kept.proof.hypotheses.map(groundKey))
  if (now.size !== then.size || [...now].some(k => !then.has(k))) return null
  // Rules by their text, as the knowledge base has them now.
  const byText = new Map(kb.allRules().map(r => [ruleText(r), r]))
  const steps = kept.proof.steps.map(st => {
    if (st.by.kind !== 'rule') return st
    const r = byText.get(ruleText(st.by.rule))
    return r ? { ...st, by: { kind: 'rule' as const, rule: r } } : null
  })
  if (steps.some(st => st === null)) return null
  const proof = { ...kept.proof, hypotheses: frontier, steps: steps as Proof['steps'] }
  const prep = prepare(kb)
  if (replay(proof, () => new Saturation(prep, {}), prep.structure.equality) !== -1) return null
  // As the pipeline asks it, but with no search for `false`: without a witness, the caller searches.
  const witnessed = mayDerive(kb, frontier, FALSE.name)
  if (witnessed && !options.consistent?.()) return null
  return { result: 'verified', facts: [], proof, ...(witnessed ? { witnessed: true } : {}), ...(kept.apart ? { apart: true } : {}) }
}

// ── written proofs ──

/**
 * Proved lemmas as rules a step may cite (tools.md, option A): each lemma's hypotheses unfolded to
 * primitives as the body, its head as the head, so that no definition gains a clause (engine.md:
 * lemmas join after unfolding). A lemma whose head is defined joins only if its head unfolds to
 * primitives over the lemma's own points, one rule for each.
 */
function citable(lemmas: readonly Lemma[], kb: KnowledgeBase): Rule[] {
  const key = lemmas.map(l => `${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`).join('\n')
  let byKey = citableRules.get(kb)
  if (!byKey) citableRules.set(kb, byKey = new Map())
  const hit = byKey.get(key)
  if (hit) return hit
  const out: Rule[] = []
  for (const l of lemmas) {
    const fresh = new FreshNames()
    const body = dedupeFacts(l.hypotheses.flatMap(h => unfold(toGroundPredicate(h), kb, new Set(), { fresh }).frontier))
    const heads = unfold(toGroundPredicate(l.head), kb, new Set(), { fresh: new FreshNames() }).frontier
    if (heads.some(h => h.args.some(a => !l.head.args.includes(a)))) continue
    for (const head of heads) {
      const rule = { head: { name: head.name, args: [...head.args] }, body: body.map(b => ({ name: b.name, args: [...b.args] })) }
      citedFrom.set(rule, l)
      out.push(rule)
    }
  }
  byKey.set(key, out)
  return out
}
const citableRules = new WeakMap<KnowledgeBase, Map<string, Rule[]>>()
const citedFrom = new WeakMap<Rule, Lemma>()
/** The lemma a proof's rule step cites, if it is one (a lemma joined as a rule, by `citable`). */
export const citedLemma = (rule: Rule): Lemma | undefined => citedFrom.get(rule)

/** The knowledge base with the cited lemmas that conclude what this step needs: none, mostly. */
function withCited(kb: KnowledgeBase, cited: readonly Rule[], goal: GroundPredicate): KnowledgeBase {
  if (!cited.length) return kb
  const wanted = new Set(unfold(goal, kb, new Set(), { fresh: new FreshNames() }).frontier.map(f => f.name))
  const use = cited.filter(r => wanted.has(r.head.name))
  if (!use.length) return kb
  const key = use.map(showRule).join('\n')
  let byKey = citedKbs.get(kb)
  if (!byKey) citedKbs.set(kb, byKey = new Map())
  let out = byKey.get(key)
  if (!out) byKey.set(key, out = new KnowledgeBase([...kb.allRules(), ...use]))
  return out
}
const citedKbs = new WeakMap<KnowledgeBase, Map<string, KnowledgeBase>>()

/**
 * What the figures say of a construction step (geometry/constructionStep.ts): the logic knows nothing
 * of figures, so the caller answers. `ok` when its new points are built from the points above, in
 * every sampled figure; `apart` when each new point stands apart from every other point in every one
 * of them (only then does the convention cover it); `determined` when the figure's freedom is
 * unchanged; `existence` from the planner's step that places each new point.
 */
export interface ConstructionCheck {
  ok: boolean
  apart: boolean
  determined: boolean
  existence: 'unconditional' | 'witnessed'
  /** Why not, when not ok. */
  why?: string
}

/** Check a construction: the step, what is drawn above it (hypotheses and earlier constructions), its new points. */
export type Construct = (step: Predicate, above: readonly Predicate[], newPoints: readonly string[]) => ConstructionCheck

export interface StepResult {
  /** The step's line (1-based). */
  line: number
  step: Predicate
  /**
   * follows: shown from what is above it; not-shown: a short search did not find it (it is taken
   * as given below, so later steps are still checked); constructed: a construction the figures
   * allow; refused: a construction they do not.
   */
  result: 'follows' | 'not-shown' | 'constructed' | 'refused'
  /** Shown only under the convention, for figures whose points are all apart. */
  apart?: boolean
  proof?: Proof
  newPoints?: string[]
  construction?: ConstructionCheck
}

export interface WrittenCheck {
  steps: StepResult[]
  /** The head, from the hypotheses and every step. */
  head: CheckResponse
}

/** A step's search: enough for one rule or a few, not a lemma's whole search (engine.md, *How a step is checked*). */
export const STEP_WORK = 300_000

/**
 * Check a lemma's written proof (engine.md, *Writing a proof*): each `?` step from the hypotheses and
 * the steps above it, in order, then the head from all of them.
 * - A step naming points not above it is a construction, checked on the figures (`construct`); its
 *   facts, unfolded, join what is known, its new points named. The convention covers them only if
 *   the figures show them apart.
 * - Any other step is searched for from what is known, with a step's budget (`stepWork`): plain
 *   first, then under the convention (`distinctNames`). A step not found is still taken as given
 *   below, so one gap does not hide the rest; the lemma is then not ✓.
 * - The head is checked as a lemma is (`checkLemma`), from everything known, with `options`. Its
 *   `consistent` should answer for the hypotheses with the constructions.
 */
export function checkWrittenProof(
  lemma: Lemma,
  kb: KnowledgeBase,
  options: CheckOptions & { construct?: Construct; stepWork?: number; lemmas?: readonly Lemma[] } = {},
  maxDerivations = 2_000_000,
): WrittenCheck {
  const fresh = new FreshNames()
  const unfoldAll = (ps: readonly Predicate[]) => ps.flatMap(p => unfold(toGroundPredicate(p), kb, new Set(), { fresh }).frontier)
  const hypotheses = lemma.hypotheses.map(toGroundPredicate)
  let known = dedupeFacts(unfoldAll(lemma.hypotheses))
  const above = new Set(hypotheses.flatMap(h => h.args))
  const drawn: Predicate[] = [...lemma.hypotheses]
  const notApart = new Set<string>()
  const stepWork = options.stepWork ?? STEP_WORK
  const cited = citable(options.lemmas ?? [], kb)
  const steps: StepResult[] = []
  const addFacts = (p: Predicate, notCovered: boolean) => {
    const facts = unfoldAll([p])
    if (notCovered) for (const f of facts) for (const a of f.args) if (!above.has(a)) notApart.add(a)
    known = dedupeFacts([...known, ...facts])
    for (const a of p.args) above.add(a)
  }

  for (const { pred, line } of lemma.steps ?? []) {
    const newPoints = [...new Set(pred.args.filter(a => !above.has(a)))]
    if (newPoints.length) {
      const construction: ConstructionCheck = options.construct?.(pred, drawn, newPoints)
        ?? { ok: false, apart: false, determined: false, existence: 'witnessed', why: 'constructions are checked on figures, and there are none here' }
      steps.push({ line, step: pred, result: construction.ok ? 'constructed' : 'refused', newPoints, construction })
      if (construction.ok) { drawn.push(pred); addFacts(pred, !construction.apart) }
      else for (const a of newPoints) { above.add(a); notApart.add(a) }
      continue
    }
    const goal = toGroundPredicate(pred)
    const stepKb = withCited(kb, cited, goal)
    const attempt = (convention: boolean) => {
      const frontier = [...known, ...(convention ? nonDegeneracy(known, goal, notApart) : [])]
      const sat = saturate(stepKb, frontier, { goal, maxWork: stepWork, maxDerivations })
      return sat.holds(goal) ? sat.explain(goal, frontier) ?? undefined : null
    }
    let proof = attempt(false), apart = false
    if (proof === null && options.distinctNames) { proof = attempt(true); apart = proof !== null }
    steps.push({ line, step: pred, result: proof === null ? 'not-shown' : 'follows', ...(apart ? { apart } : {}), ...(proof ? { proof } : {}) })
    addFacts(pred, false)
  }

  // The head, from everything known, as a lemma's head is checked: plain first, then the convention.
  const goal = toGroundPredicate(lemma.head)
  const missing = lemma.head.args.filter(a => !above.has(a)).map(a => ({ name: '__object__', args: [a] }))
  const facts = dedupeFacts([...known, ...missing])
  const headKb = withCited(kb, cited, goal)
  const plain = checkFrom(goal, facts, headKb, maxDerivations, { ...options, distinctNames: false })
  if (!options.distinctNames || plain.result === 'verified' || plain.result === 'vacuous' || plain.result === 'unshown') return { steps, head: plain }
  const apart = checkFrom(goal, facts, headKb, maxDerivations, options, notApart)
  return { steps, head: apart.result === 'verified' ? { ...apart, apart: true } : apart }
}
