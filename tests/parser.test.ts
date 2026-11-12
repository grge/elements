/** Lexer and parser. */

import { describe, it, expect } from 'vitest'
import { tokenize, TokenType } from '../src/language/lexer'
import { bookRules } from './book'
import { parseSource, parseRules, parseGeoFile, validateConsistentArities } from '../src/language/parser'

const foundationRules = bookRules

// ── Lexer ──────────────────────────────────────────────────────────────

describe('lexer', () => {
  it('tokenizes identifiers and colons', () => {
    const toks = tokenize('foo a b: bar c')
    const types = toks.map(t => t.type)
    expect(types).toContain(TokenType.IDENTIFIER)
    expect(types).toContain(TokenType.COLON)
  })

  it('emits EOF as last token', () => {
    const toks = tokenize('x')
    expect(toks[toks.length - 1].type).toBe(TokenType.EOF)
  })

  it('handles question token for queries', () => {
    const toks = tokenize('? foo a')
    expect(toks[0].type).toBe(TokenType.QUESTION)
  })
})

// ── Parser ─────────────────────────────────────────────────────────────

describe('parser', () => {
  it('parses a Horn clause', () => {
    const items = parseSource('collinear a b c: between a b c')
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('rule')
    if (items[0].kind === 'rule') {
      expect(items[0].rule.head.name).toBe('collinear')
      expect(items[0].rule.body).toHaveLength(1)
      expect(items[0].rule.body[0].name).toBe('between')
    }
  })

  it('parses an axiom (no body) as a rule with empty body', () => {
    const items = parseSource('eq-lines a b b a: -')
    expect(items[0].kind).toBe('rule')
    if (items[0].kind === 'rule') {
      expect(items[0].rule.body).toHaveLength(0)
    }
  })

  it('parses a bare goal', () => {
    const items = parseSource('eq-triangle a b c')
    expect(items[0].kind).toBe('goal')
    if (items[0].kind === 'goal') {
      expect(items[0].pred.name).toBe('eq-triangle')
      expect(items[0].pred.args).toEqual(['a', 'b', 'c'])
    }
  })

  it('parses a ground query distinctly from a queried clause', () => {
    const items = parseSource('? eq-lines a b a c')
    expect(items[0].kind).toBe('ground-query')
    if (items[0].kind === 'ground-query') {
      expect(items[0].pred.name).toBe('eq-lines')
      expect(items[0].pred.args).toEqual(['a', 'b', 'a', 'c'])
    }
  })

  it('parses a lemma with hypotheses', () => {
    const items = parseSource('? collinear a b c: between a b c')
    expect(items[0].kind).toBe('lemma')
    if (items[0].kind === 'lemma') {
      expect(items[0].lemma.head.name).toBe('collinear')
      expect(items[0].lemma.hypotheses).toHaveLength(1)
    }
  })

  it('parses a theorem as a lemma with empty hypotheses', () => {
    const items = parseSource('? collinear a a a: -')
    expect(items[0].kind).toBe('lemma')
    if (items[0].kind === 'lemma') {
      expect(items[0].lemma.hypotheses).toHaveLength(0)
    }
  })

  it('attaches preceding comment-only lines as a doc comment', () => {
    const items = parseSource(`# about foo\n# second line\nfoo a: bar a # inline note`)
    expect(items[0].docComment).toBe('about foo\nsecond line')
    expect(items[0].otherComments).toEqual(['inline note'])
  })

  it('does not attach doc comments across blank lines', () => {
    const items = parseSource(`# far away\n\nfoo a: -`)
    expect(items[0].docComment).toBeUndefined()
  })

  it('attaches comments appearing inside an indented body block as otherComments', () => {
    const items = parseSource(`foo a:\n    bar a # body comment`, 'block.geo')
    expect(items[0].otherComments).toEqual(['body comment'])
    expect(items[0].sourceRef).toEqual({ sourceName: 'block.geo', startLine: 1, endLine: 2 })
  })

  it('rejects commas in indented bodies', () => {
    expect(() => parseSource(`eq-triangle a b c:\n    circle a b c, circle b a c`)).toThrow(/Indented bodies/)
  })

  it('rejects ground facts in .geo validation', () => {
    expect(() => parseGeoFile('circle a b c', 'test.geo')).toThrow(/ground facts/)
  })

  it('rejects ground queries in .geo validation', () => {
    expect(() => parseGeoFile('? circle a b c', 'test.geo')).toThrow(/ground queries/)
  })

  it('tells ground queries from queried clauses', () => {
    const kinds = parseSource('? foo a\n? bar a b\n? baz a: qux a').map(i => i.kind)
    expect(kinds).toEqual(['ground-query', 'ground-query', 'lemma'])
  })

  it('loads the book', () => {
    expect(foundationRules.length).toBeGreaterThan(0)
    const names = new Set(foundationRules.map(r => r.head.name))
    expect(names.has('collinear')).toBe(true)
    expect(names.has('eq-triangle')).toBe(true)
    expect(names.has('circle')).toBe(true)
  })

  it('validates consistent arities across multiple sources', () => {
    const a = parseGeoFile('foo x y: -', 'a.geo')
    const b = parseGeoFile('bar q: foo a b', 'b.geo')
    expect(() => validateConsistentArities([
      { sourceName: 'a.geo', items: a },
      { sourceName: 'b.geo', items: b },
    ])).not.toThrow()
  })

  it('rejects inconsistent arities across multiple sources', () => {
    const a = parseGeoFile('foo x y: -', 'a.geo')
    const b = parseGeoFile('foo q: -', 'b.geo')
    expect(() => validateConsistentArities([
      { sourceName: 'a.geo', items: a },
      { sourceName: 'b.geo', items: b },
    ])).toThrow(/arity 1.*previously seen with arity 2|arity 2.*previously seen with arity 1/)
  })
})
