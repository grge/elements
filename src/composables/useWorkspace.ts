import { ref, computed, shallowRef, watch } from 'vue'
import { parseSource } from '../language/parser'
import { buildRuntimeState, type RuntimeState } from '../kb/runtime'
import { KnowledgeBase } from '../kb/inference'
import { GEOMETRY_FRONTIER, frontierFactsFromRuntime, geometryProblemFromFacts, seedPredicateHeadFact } from '../geometry/extraction'
import { buildModel, execute, plan as planConstruction, realise, type ConstructionModel, type ConstructionPlan, type Point } from '../geometry/construction'
import { useKB, type Namespace } from './useKB'

/** The current construction of the figure: the planned program and its parameters. */
export interface ConstructionState {
  model: ConstructionModel
  plan: ConstructionPlan
  params: number[]
  /** False when no configuration satisfying every fact was found: not constructible this way. */
  valid: boolean
}

const DEFAULT_SCRATCH = `circle a b c
eq-triangle a b c

? eq-lines a b b c: eq-triangle a b c
? eq-lines a b b c: circle a b c`

/** Clauses one per paragraph, except that a lemma without a comment of its own joins the lemmas before it. */
function joinClauses(sources: string[]): string {
  const isLemma = (src: string) => src.split('\n').find(line => !line.startsWith('#'))?.trimStart().startsWith('?') ?? false
  const together = (prev: string, cur: string) => isLemma(prev) && isLemma(cur) && !cur.startsWith('#')
  return sources.reduce((text, src, i) =>
    i === 0 ? src : text + (together(sources[i - 1], src) ? '\n' : '\n\n') + src, '')
}

/**
 * The current "page": either the scratchpad or one predicate from the knowledge base,
 * plus the runtime / geometry / plan derived from its text.
 */
export function useWorkspace() {
  const kbApi = useKB()
  const { kb, predicates, userClauses, clausesForPredicate, chapters } = kbApi

  const mode = ref<'scratchpad' | 'predicate'>('scratchpad')
  const selectedPred = ref('')
  const selectedNamespace = ref<Namespace | ''>('')
  const scratch = ref(DEFAULT_SCRATCH)
  const clause = ref('')
  const usePlanner = ref(true)

  const readOnly = computed(() =>
    mode.value === 'predicate' && selectedNamespace.value !== 'user')

  /** The text shown in (and edited by) the editor. */
  const text = computed({
    get: () => mode.value === 'scratchpad' ? scratch.value : clause.value,
    set: (v: string) => {
      if (mode.value === 'scratchpad') { scratch.value = v; return }
      clause.value = v
      if (selectedNamespace.value === 'user') {
        const uc = kbApi.userClauseFor(selectedPred.value)
        if (uc) kbApi.updateUserClause(uc.id, v)
      }
    },
  })

  function openScratchpad() {
    mode.value = 'scratchpad'
    selectedPred.value = ''
    selectedNamespace.value = ''
  }

  function openPredicate(name: string, ns: Namespace) {
    mode.value = 'predicate'
    selectedPred.value = name
    selectedNamespace.value = ns
    clause.value = joinClauses(clausesForPredicate(name, ns).map(c => c.source))
  }

  function newUserPredicate(name: string): boolean {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) return false
    kbApi.addUserClause(`${name} x y: `)
    openPredicate(name, 'user')
    return true
  }

  function deleteSelected() {
    if (mode.value !== 'predicate' || selectedNamespace.value !== 'user') return
    const uc = kbApi.userClauseFor(selectedPred.value)
    if (uc) kbApi.deleteUserClause(uc.id)
    openScratchpad()
  }

  const runtime = computed<RuntimeState | null>(() => {
    if (!kb.value) return null
    try {
      if (mode.value === 'scratchpad') return buildRuntimeState(kb.value, parseSource(scratch.value))
      if (!clause.value.trim()) return null
      const parsed = parseSource(clause.value)
      const isUser = selectedNamespace.value === 'user'
      const base = isUser
        ? new KnowledgeBase(kb.value.allRules().filter(r => r.head.name !== selectedPred.value))
        : kb.value
      const rt = buildRuntimeState(base, isUser ? parsed : parsed.filter(i => i.kind !== 'rule'))
      const firstRule = parsed.find((i): i is Extract<typeof i, { kind: 'rule' }> => i.kind === 'rule')
      if (firstRule) rt.configuration.addFacts([seedPredicateHeadFact(firstRule.rule.head)])
      return rt
    } catch (e) {
      console.warn('Runtime construction error:', e)
      return null
    }
  })

  /** Drawable facts of the figure, after unfolding definitions. */
  const facts = computed(() => {
    if (!runtime.value) return []
    try { return frontierFactsFromRuntime(runtime.value).filter(f => GEOMETRY_FRONTIER.has(f.name)) }
    catch (e) { console.warn('Geometry extraction error:', e); return [] }
  })

  // Never throw from here: the page renders from this, and a render error tears down the whole
  // page in production, editor included, which loses focus mid-typing.
  const problem = computed(() => {
    try { return geometryProblemFromFacts(facts.value) }
    catch (e) { console.warn('Geometry problem error:', e); return null }
  })

  // Positions from the last drawing: re-planning after an edit keeps points where they were.
  let lastCoords: Map<string, Point> | undefined
  const construction = shallowRef<ConstructionState | null>(null)
  watch(facts, fs => {
    if (fs.length === 0) { construction.value = null; return }
    try {
      const model = buildModel(fs)
      const cp = planConstruction(model)
      const r = realise(cp, { previous: lastCoords })
      construction.value = { model, plan: cp, params: r.params, valid: r.valid }
    } catch (e) {
      console.warn('Construction planning error:', e)
      construction.value = null
    }
  }, { immediate: true })

  /** The construction carried out with its current parameters (failure and violations included). */
  const drawing = computed(() => {
    const c = construction.value
    if (!c) return null
    try {
      const d = execute(c.plan, c.params, { previous: lastCoords })
      if (!d.failure) lastCoords = d.coords
      return d
    } catch (e) { console.warn('Construction execution error:', e); return null }
  })

  function setConstruction(c: ConstructionState) {
    construction.value = c
  }

  return {
    kb, predicates, userClauses, chapters,
    mode, selectedPred, selectedNamespace, readOnly, text, usePlanner,
    runtime, facts, problem, construction, drawing, setConstruction,
    openScratchpad, openPredicate, newUserPredicate, deleteSelected,
  }
}
