/**
 * Checking a page: a verdict for each of its `?` lines, as the page shows them. The checking worker
 * runs this off the main thread; the tests run the same function, so what they check is what a reader
 * sees (tests/pageChecks.test.ts).
 *
 * - A lemma's verdict combines the search with numeric evidence (evidence.ts, verdict.ts): a lemma not
 *   derived but failing in a sampled figure is false; holding in every sample, probably true; derived
 *   yet failing in a sample, an alarm (a false axiom or a bug). Evidence comes first: its figures also
 *   witness that the hypotheses are consistent, which spares the checker its search for a contradiction.
 * - A lemma with a written proof has a verdict for each step, then one for itself (checker.ts,
 *   `checkWrittenProof`; constructions on the figures, constructionStep.ts).
 * - On a book page, a lemma is checked in the book's order: with the rules of the chapter it is written
 *   in and those before, citing only lemmas of those chapters (kb/bookScope.ts).
 * - A lemma once found ✓ keeps its proof (`KeptProofs`); a later check replays it before it searches.
 *
 * The verdicts carry the proofs found, for the cache and for tests. The page shows verdicts only:
 * what a reader should see of a proof is a question for the book's reorganisation (consolidation.md).
 */

import { parseSource, type Lemma, type Predicate, type Rule } from '../language/parser'
import { buildRuntimeState } from '../kb/runtime'
import { KnowledgeBase } from '../kb/inference'
import { checkByReplay, checkGroundQuery, checkLemma, checkWrittenProof } from '../kb/checker'
import { showRule } from '../kb/rules'
import type { Proof } from '../kb/proof'
import { ScopedBases, type RuleChapters } from '../kb/bookScope'
import { bookLemmas, bookLemmaChapters } from '../language/bookLemmas'
import { checkConstruction } from './constructionStep'
import { numericEvidence, type Evidence } from './evidence'
import { verdict, writtenVerdicts, type Verdict } from './verdict'

export interface PageCheckRequest {
  text: string
  rules: readonly Rule[]
  /**
   * For a book page: the chapter of each rule (null for one of no book chapter), and the chapter each
   * line of the text is written in (null for none). A lemma whose first line has a chapter is checked
   * in the book's order.
   */
  ruleChapters?: RuleChapters
  lineChapters?: readonly (number | null)[]
}

/** A verdict for one line of the page (0-based), or for a lemma spanning lines up to `endLine`. */
export interface PageMark extends Verdict {
  line: number
  endLine?: number
  /** Show the message under the line even with a ✓ (a written proof's construction step). */
  note?: boolean
  /** The proof found, for a ✓ that has one. */
  proof?: Proof
}

/**
 * Proofs kept from earlier checks, by the lemma's text and scope, the most recent last: a later check
 * replays one before it searches (checker.ts, `checkByReplay`), so an edit elsewhere on the page, which
 * changes the knowledge base, does not send every lemma back to its search.
 */
export class KeptProofs {
  private kept = new Map<string, { proof: Proof; apart: boolean }>()
  constructor(private limit = 200) {}
  get(key: string) { return this.kept.get(key) }
  set(key: string, value: { proof: Proof; apart: boolean }) {
    this.kept.delete(key)
    this.kept.set(key, value)
    if (this.kept.size > this.limit) this.kept.delete(this.kept.keys().next().value!)
  }
}

const lemmaKey = (l: Lemma, scope: number | null) =>
  `${scope ?? 'all'}| ${l.head.name} ${l.head.args.join(' ')}: ${l.hypotheses.map(h => `${h.name} ${h.args.join(' ')}`).join(', ')}`

/** Check every `?` line of the page, calling `emit` with each verdict as it is decided. */
export function checkPage(request: PageCheckRequest, kept: KeptProofs, emit: (mark: PageMark) => void): void {
  const { text, rules, ruleChapters, lineChapters } = request
  const parsed = parseSource(text)
  const runtime = buildRuntimeState(new KnowledgeBase([...rules]), parsed)

  // A book lemma's own scope: its chapter's rules and those before. Not the page's rules, which on a
  // word's page may come from later chapters; the book's rules include them.
  const scoped = ruleChapters ? new ScopedBases(rules, ruleChapters) : null

  // Lemmas a written proof may cite (tools.md, option A): the book's, which are all ✓, and this page's
  // own as they are found ✓, those above the proof; for a book lemma, only those of its chapter and
  // before. Each with its chapter (Infinity for none).
  const citable: { lemma: Lemma; chapter: number }[] = bookLemmas.map((lemma, i) => ({ lemma, chapter: bookLemmaChapters[i] }))

  for (const item of parsed) {
    if (item.kind !== 'lemma' && item.kind !== 'ground-query') continue
    const line = (item.sourceRef?.startLine ?? 1) - 1
    // A written proof's steps have marks of their own: the lemma's reason goes under its first line.
    const endLine = item.kind === 'lemma' && item.lemma.steps ? line : (item.sourceRef?.endLine ?? line + 1) - 1
    try {
      if (item.kind === 'ground-query') {
        emit({ line, endLine, ...verdict(checkGroundQuery(item.pred, runtime.kb, runtime.configuration), null) })
        continue
      }
      const lemma = item.lemma
      const scope = scoped ? lineChapters?.[line] ?? null : null
      const kb = scope != null ? scoped!.upTo(scope) : runtime.kb
      let ev: Evidence | null = null
      try { ev = numericEvidence(lemma, kb) } catch { ev = null }

      let v: Verdict, proof: Proof | undefined
      if (lemma.steps) {
        // The hypotheses' figure, with the constructions, witnesses that they are consistent; the
        // lemma's own is the evidence.
        const built: Predicate[] = []
        const written = checkWrittenProof(lemma, kb, {
          strict: true, distinctNames: true,
          construct: (step, above, newPoints) => {
            const c = checkConstruction(kb, step, above, newPoints)
            if (c.ok) built.push(step)
            return c
          },
          lemmas: citable.filter(c => scope == null || c.chapter <= scope).map(c => c.lemma),
          consistent: () => {
            if (!built.length) return !!ev?.witness
            try { return !!numericEvidence({ head: lemma.head, hypotheses: [...lemma.hypotheses, ...built] }, kb).witness } catch { return false }
          },
        })
        const vs = writtenVerdicts(written, ev)
        written.steps.forEach((s, i) => emit({ ...vs.steps[i], line: s.line - 1, ...(s.proof ? { proof: s.proof } : {}) }))
        v = vs.head
        proof = written.head.proof
      } else {
        const options = { consistent: () => !!ev?.witness, strict: true, distinctNames: true, explain: true }
        const key = lemmaKey(lemma, scope)
        const keptProof = kept.get(key)
        const check = (keptProof && checkByReplay(lemma, kb, keptProof, showRule, options)) ?? checkLemma(lemma, kb, undefined, options)
        if (check.result === 'verified' && check.proof) kept.set(key, { proof: check.proof, apart: !!check.apart })
        v = verdict(check, ev)
        proof = check.proof
      }
      if (v.type === 'verified') citable.push({ lemma, chapter: scope ?? Infinity })
      emit({ line, endLine, ...v, ...(v.type === 'verified' && proof ? { proof } : {}) })
    } catch (error) {
      emit({ line, endLine, type: 'unproven', message: `could not be checked: ${error}` })
    }
  }
}
