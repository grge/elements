/**
 * The book's lemmas, for code that must not pull in the workspace (the checking worker): every `?`
 * lemma of src/language/book, in chapter order. All are ✓ (the tests require it), so a written proof
 * may cite them (tools.md, option A).
 */
import { parseLemmas, type Lemma } from './parser'

const sources = import.meta.glob('./book/*.geo', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const bookLemmas: Lemma[] = Object.entries(sources)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, source]) => parseLemmas(source))
