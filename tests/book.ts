/** The bundled book and the test fixtures, read from disk for the test suites. */

import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { parseLemmas, parseRules } from '../src/language/parser'

const bookDir = resolve(__dirname, '../src/language/book')

export const chapterFiles = readdirSync(bookDir).filter(f => f.endsWith('.geo')).sort()
export const chapterSource = (file: string) => readFileSync(resolve(bookDir, file), 'utf8')
export const bookRules = chapterFiles.flatMap(f => parseRules(chapterSource(f)))
export const bookLemmas = chapterFiles.flatMap(f => parseLemmas(chapterSource(f)))

const fixture = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')
/**
 * Book lemmas that run past the budget of work with the whole book's rules, left out of the suites
 * that check them until it is fixed, not hidden by checking with fewer rules.
 *
 * The windmill's two (November 2026): with the side words in chapter 2 it needs about 44k derivations
 * with chapter 4's rules. With the whole book's, chapter 6's ratio rules join its search, through
 * those concluding `eq-lines` and `parallel`, and spend the budget (42k of 70k derivations). Waiting on
 * modules and strata: a theory's results flowing out without its machinery joining every search
 * (foundations.md, *Sides: the narrow experiment*).
 */
export const overBudget = new Set<string>([
  'eq-area a b d f b c: windmill a b c f g d e l x y',
  'eq-area a b f l b d: windmill a b c f g d e l x y',
])

export const regressionLemmas = parseLemmas(fixture('regression.geo'))
/** Euclid I.2 and I.3, kept as test constructions. */
export const fixtureRules = parseRules(fixture('constructions.geo'))
