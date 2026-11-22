/**
 * The book's lemmas, for code that must not pull in the workspace (the checking worker): every `?`
 * lemma of src/language/book, in chapter order. All are ✓ (the tests require it), so a written proof
 * may cite them (tools.md, option A).
 */
import { parseLemmas, type Lemma } from './parser'

const sources = import.meta.glob('./book/*.geo', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const byChapter = Object.entries(sources)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, source]) => parseLemmas(source))

export const bookLemmas: Lemma[] = byChapter.flat()
/** The chapter (1 for the first) each of `bookLemmas` is written in. */
export const bookLemmaChapters: number[] = byChapter.flatMap((ls, i) => ls.map(() => i + 1))
