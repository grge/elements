/** The bundled book and the test fixtures, read from disk for the test suites. */

import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseLemmas, parseRules } from '../src/language/parser'
import { inModule } from '../src/kb/modules'

const bookDir = resolve(__dirname, '../src/language/book')

export const chapterFiles = readdirSync(bookDir).filter(f => f.endsWith('.geo')).sort()
export const chapterSource = (file: string) => readFileSync(resolve(bookDir, file), 'utf8')
/** The book's rules, each file a module (kb/modules.ts), as the app loads them. */
export const bookRules = chapterFiles.flatMap(f => inModule(parseRules(chapterSource(f)), f.replace(/\.geo$/, '')))
export const bookLemmas = chapterFiles.flatMap(f => parseLemmas(chapterSource(f)))

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')
/**
 * Book lemmas that run past the budget of work with the whole book's rules, left out of the suites
 * that check them until it is fixed, not hidden by checking with fewer rules. None since November
 * 2026: the windmill's two came back when `inside` was read as a definition again.
 */
export const overBudget = new Set<string>([])

export const regressionLemmas = parseLemmas(fixture('regression.geo'))
/** Euclid I.2 and I.3, kept as test constructions. */
export const fixtureRules = parseRules(fixture('constructions.geo'))
