/** The bundled book and the test fixtures, read from disk for the test suites. */

import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseLemmas, parseRules, type Lemma } from '../src/language/parser'
import { ScopedBases } from '../src/kb/bookScope'

const bookDir = resolve(__dirname, '../src/language/book')

export const chapterFiles = readdirSync(bookDir).filter(f => f.endsWith('.geo')).sort()
export const chapterSource = (file: string) => readFileSync(resolve(bookDir, file), 'utf8')
const chapters = chapterFiles.map(f => ({ rules: parseRules(chapterSource(f)), lemmas: parseLemmas(chapterSource(f)) }))
export const bookRules = chapters.flatMap(c => c.rules)
export const bookLemmas = chapters.flatMap(c => c.lemmas)

/** Each book lemma's chapter, 1 for the first. */
const lemmaChapters = new Map<Lemma, number>(chapters.flatMap((c, i) => c.lemmas.map(l => [l, i + 1] as const)))
const ruleChapters = chapters.flatMap((c, i) => c.rules.map(() => i + 1))
const scoped = new ScopedBases(bookRules, ruleChapters)

/**
 * The knowledge base a book lemma is checked with, as its page checks it (bookScope.ts): the rules of
 * its own chapter and those before, never a later chapter's.
 */
export const kbOf = (lemma: Lemma) => scoped.upTo(lemmaChapters.get(lemma)!)

/** The same rules parsed again (other objects), for checking that a kept proof replays. */
const scopedAgain = new ScopedBases(structuredClone(bookRules), ruleChapters)
export const kbAgainOf = (lemma: Lemma) => scopedAgain.upTo(lemmaChapters.get(lemma)!)

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')
export const regressionLemmas = parseLemmas(fixture('regression.geo'))
/** Euclid I.2 and I.3, kept as test constructions. */
export const fixtureRules = parseRules(fixture('constructions.geo'))
