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
export const regressionLemmas = parseLemmas(fixture('regression.geo'))
/** Euclid I.2 and I.3, kept as test constructions. */
export const fixtureRules = parseRules(fixture('constructions.geo'))
