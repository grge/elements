/**
 * Every lemma is shown where it is written. The app files a `?` line on the page of the latest-defined
 * word it mentions, in that word's home chapter (useKB.ts, `owner`). So a lemma stated only in older
 * words lands on an older chapter's page, out of sight of its own chapter's reader: chapter 5's first
 * draft lost ten of its eleven that way. A lemma in a "Chapter N's debts" section is the exception:
 * a fact about an earlier chapter's figure, shown on that figure's page by design.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseGeoFile, type Lemma } from '../src/language/parser'

const dirs = ['../src/language/book/', '../src/language/extra/'].map(d => resolve(__dirname, d))
const loaded = dirs.flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.geo')).sort().map(f => {
  const source = readFileSync(resolve(dir, f), 'utf8')
  return { id: f.replace(/\.geo$/, ''), source, items: parseGeoFile(source, f) }
}))

// As useKB.ts: where each word is first defined, and the chapter that is its home.
const definedAt = new Map<string, number>(), homeOf = new Map<string, string>()
loaded.forEach((c, ci) => c.items.forEach((item, ii) => {
  if (item.kind === 'rule' && !definedAt.has(item.rule.head.name)) {
    definedAt.set(item.rule.head.name, ci * 100_000 + ii)
    homeOf.set(item.rule.head.name, c.id)
  }
}))
const owner = (l: Lemma) => {
  const mentioned = [l.head, ...l.hypotheses].map(p => p.name).filter(n => definedAt.has(n))
  return mentioned.reduce((best, n) => definedAt.get(n)! > definedAt.get(best)! ? n : best, mentioned[0] ?? l.head.name)
}

describe('every lemma is shown in its own chapter', () => {
  for (const c of loaded) {
    it(c.id, () => {
      // The first line of a debts section, if the chapter has one: lemmas after it may be shown elsewhere.
      const debts = c.source.split('\n').findIndex(line => /^# ══ Chapter \d+'s debts/.test(line)) + 1
      const away = c.items.flatMap(item => {
        if (item.kind !== 'lemma') return []
        const home = homeOf.get(owner(item.lemma))
        if (home === c.id) return []
        if (debts > 0 && (item.sourceRef?.startLine ?? 0) > debts) return []
        return [`? ${item.lemma.head.name} ${item.lemma.head.args.join(' ')}: shown on ${owner(item.lemma)}'s page (${home})`]
      })
      expect(away).toEqual([])
    })
  }
})
