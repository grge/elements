/**
 * Checking a lemma of the book in the book's order: with the rules of its own chapter and those
 * before it, as Euclid's order has it, never a later chapter's. A page shows clauses from several
 * chapters (a word's page gathers every clause about it), so the scope is the lemma's, not the page's.
 *
 * Without it a lemma's proof may rest on a later chapter: chapter 3's parallelogram was proved through
 * chapter 6's similar triangles, though its own chapter proves it, shorter (review-notes.md, *Reading
 * the book*). A lemma with no chapter (of `extra/`, or the user's) is checked with everything.
 */

import { KnowledgeBase } from './inference'
import type { Rule } from '../language/parser'

/** A chapter for each rule (1 for the first), or null for a rule of no book chapter. */
export type RuleChapters = readonly (number | null)[]

/** The rules a lemma of chapter `n` may use: the book's, of chapters 1 to n. */
export function rulesUpTo(rules: readonly Rule[], chapters: RuleChapters, n: number): Rule[] {
  return rules.filter((_, i) => chapters[i] != null && chapters[i]! <= n)
}

/** Knowledge bases by scope, built once each for a set of rules. */
export class ScopedBases {
  private bases = new Map<number, KnowledgeBase>()
  constructor(private rules: readonly Rule[], private chapters: RuleChapters) {}
  upTo(n: number): KnowledgeBase {
    let kb = this.bases.get(n)
    if (!kb) { kb = new KnowledgeBase(rulesUpTo(this.rules, this.chapters, n)); this.bases.set(n, kb) }
    return kb
  }
}
