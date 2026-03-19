/**
 * EL2 Parser — parses tokens into rules, goals, queried clauses, and ground queries.
 * Port of el2/parser.py
 *
 * Syntax:
 *   Horn clause (inline):  head args: body1 args, body2 args
 *   Horn clause (indented): head args:\n  body1 args\n  body2 args
 *   Axiom (no body):       head args: -
 *   Goal (bare):           pred args
 *   Ground query (bare):   ? pred args
 *   Queried clause:        ? head args: body1, body2
 *   Queried theorem:       ? head args: -
 */

import { tokenize, TokenType } from './lexer'
import type { Token } from './lexer'

// ── AST types ─────────────────────────────────────────────────────────

export interface Predicate {
  name: string
  args: string[]
}

export interface Rule {
  head: Predicate
  body: Predicate[]
}

export interface Lemma {
  head: Predicate
  hypotheses: Predicate[]
}

export interface SourceRef {
  sourceName?: string
  startLine: number
  endLine: number
}

interface BaseTopLevel {
  docComment?: string
  otherComments?: string[]
  sourceRef?: SourceRef
}

export type TopLevel =
  | ({ kind: 'rule'; rule: Rule } & BaseTopLevel)
  | ({ kind: 'goal'; pred: Predicate } & BaseTopLevel)
  | ({ kind: 'ground-query'; pred: Predicate } & BaseTopLevel)
  | ({ kind: 'lemma'; lemma: Lemma } & BaseTopLevel)

// ── Parser ────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[]
  private pos = 0
  private predicateArities: Map<string, number> = new Map()

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private get current(): Token {
    return this.tokens[this.pos] ?? { type: TokenType.EOF, value: '', line: -1 }
  }

  private advance(): Token {
    const t = this.current
    this.pos++
    return t
  }

  private consume(...types: TokenType[]): void {
    while (types.includes(this.current.type)) this.advance()
  }

  parse(): TopLevel[] {
    const result: TopLevel[] = []
    while (true) {
      this.consume(TokenType.NEWLINE, TokenType.INDENT, TokenType.DEDENT, TokenType.COMMENT)
      if (this.current.type === TokenType.EOF) break

      const startLine = this.current.line
      let item: TopLevel | null = null

      if (this.current.type === TokenType.QUESTION) {
        this.advance()
        item = this.parseQuestioned()
      } else if (this.current.type === TokenType.IDENTIFIER) {
        item = this.parseRuleOrGoal()
      } else {
        this.advance()
      }

      if (item) {
        item.sourceRef = {
          startLine,
          endLine: this.previousMeaningfulLine(startLine),
        }
        result.push(item)
      }
    }
    return result
  }

  private previousMeaningfulLine(fallback: number): number {
    let i = this.pos - 1
    while (i >= 0) {
      const t = this.tokens[i]
      if (
        t.type === TokenType.NEWLINE ||
        t.type === TokenType.COMMENT ||
        t.type === TokenType.INDENT ||
        t.type === TokenType.DEDENT
      ) {
        i--
        continue
      }
      return t.line
    }
    return fallback
  }

  private parseQuestioned(): TopLevel {
    const head = this.parsePredicate()
    if (this.current.type === TokenType.COLON) {
      this.advance()
      const hypotheses = this.parseBody()
      return { kind: 'lemma', lemma: { head, hypotheses } }
    }
    return { kind: 'ground-query', pred: head }
  }

  private parseRuleOrGoal(): TopLevel {
    const head = this.parsePredicate()

    if (this.current.type === TokenType.COLON) {
      this.advance()
      const body = this.parseBody()
      return { kind: 'rule', rule: { head, body } }
    } else {
      return { kind: 'goal', pred: head }
    }
  }

  private parseBody(): Predicate[] {
    if (this.current.type === TokenType.DASH) {
      this.advance()
      return []
    }

    if (this.current.type === TokenType.NEWLINE) {
      this.advance()
      return this.parseMultiLineBody()
    }

    if (this.current.type === TokenType.IDENTIFIER) {
      return this.parseSingleLineBody()
    }

    return this.parseMultiLineBody()
  }

  private parseSingleLineBody(): Predicate[] {
    const body: Predicate[] = []
    while (this.current.type === TokenType.IDENTIFIER) {
      body.push(this.parsePredicate())
      if ((this.current.type as TokenType) !== TokenType.COMMA) break
      this.advance()
    }
    return body
  }

  private parseMultiLineBody(): Predicate[] {
    const body: Predicate[] = []
    while (true) {
      this.consume(TokenType.NEWLINE, TokenType.COMMENT)
      if (this.current.type === TokenType.DEDENT || this.current.type === TokenType.EOF) break
      this.consume(TokenType.INDENT)
      if (this.current.type !== TokenType.IDENTIFIER) break
      body.push(this.parsePredicate())
      const current = this.current
      if (current.type === TokenType.COMMA) {
        throw new SyntaxError(`Indented bodies must have exactly one predicate per line (line ${current.line})`)
      }
      if (current.type === TokenType.COMMENT) this.advance()
    }
    this.consume(TokenType.DEDENT)
    return body
  }

  private parsePredicate(): Predicate {
    if (this.current.type !== TokenType.IDENTIFIER) {
      throw new SyntaxError(`Expected predicate name at line ${this.current.line}, got ${this.current.type}`)
    }
    const name = this.advance().value
    const args: string[] = []

    while (this.current.type === TokenType.IDENTIFIER) {
      args.push(this.advance().value)
    }

    const arity = args.length
    const known = this.predicateArities.get(name)
    if (known !== undefined && known !== arity) {
      throw new SyntaxError(
        `Predicate '${name}' used with arity ${arity} but previously seen with arity ${known}`
      )
    }
    this.predicateArities.set(name, arity)

    return { name, args }
  }
}

// ── Comment attachment ────────────────────────────────────────────────

function commentTextFromLine(line: string): string | null {
  const hash = line.indexOf('#')
  if (hash < 0) return null
  return line.slice(hash + 1).trim()
}

function isCommentOnlyLine(line: string): boolean {
  return line.trim().startsWith('#')
}

function isBlankLine(line: string): boolean {
  return line.trim() === ''
}

function attachComments(items: TopLevel[], text: string): TopLevel[] {
  const lines = text.split('\n')

  for (const item of items) {
    const start = item.sourceRef?.startLine ?? 1
    const end = item.sourceRef?.endLine ?? start

    const docLines: string[] = []
    let line = start - 1
    while (line >= 1) {
      const raw = lines[line - 1] ?? ''
      if (isBlankLine(raw)) break
      if (isCommentOnlyLine(raw)) {
        docLines.unshift(commentTextFromLine(raw) ?? '')
        line--
        continue
      }
      break
    }

    const otherComments: string[] = []
    for (let i = start; i <= end; i++) {
      const raw = lines[i - 1] ?? ''
      const comment = commentTextFromLine(raw)
      if (!comment) continue
      if (i === start && isCommentOnlyLine(raw)) continue
      otherComments.push(comment)
    }

    if (docLines.length > 0) item.docComment = docLines.join('\n')
    if (otherComments.length > 0) item.otherComments = otherComments
  }

  return items
}

function withSourceName(items: TopLevel[], sourceName?: string): TopLevel[] {
  if (!sourceName) return items
  for (const item of items) {
    if (item.sourceRef) item.sourceRef.sourceName = sourceName
  }
  return items
}

// ── Public API ────────────────────────────────────────────────────────

export function parseSource(text: string, sourceName?: string): TopLevel[] {
  return withSourceName(attachComments(new Parser(tokenize(text)).parse(), text), sourceName)
}

export function parseRules(text: string): Rule[] {
  return parseSource(text)
    .filter((t): t is { kind: 'rule'; rule: Rule } => t.kind === 'rule')
    .map(t => t.rule)
}

export function parseGoals(text: string): Predicate[] {
  return parseSource(text)
    .filter((t): t is { kind: 'goal'; pred: Predicate } => t.kind === 'goal')
    .map(t => t.pred)
}

export function parseGroundQueries(text: string): Predicate[] {
  return parseSource(text)
    .filter((t): t is { kind: 'ground-query'; pred: Predicate } => t.kind === 'ground-query')
    .map(t => t.pred)
}

export function parseLemmas(text: string): Lemma[] {
  return parseSource(text)
    .filter((t): t is { kind: 'lemma'; lemma: Lemma } => t.kind === 'lemma')
    .map(t => t.lemma)
}

export function validateGeoTopLevel(items: TopLevel[], sourceName = '.geo file'): void {
  for (const item of items) {
    if (item.kind === 'goal' || item.kind === 'ground-query') {
      throw new SyntaxError(`${sourceName} may not contain ${item.kind === 'goal' ? 'ground facts' : 'ground queries'}`)
    }
  }
}

function recordPredicateArity(
  pred: Predicate,
  arities: Map<string, number>,
  sourceName: string,
): void {
  const arity = pred.args.length
  const known = arities.get(pred.name)
  if (known !== undefined && known !== arity) {
    throw new SyntaxError(
      `Predicate '${pred.name}' used with arity ${arity} in ${sourceName} but previously seen with arity ${known}`
    )
  }
  arities.set(pred.name, arity)
}

export function validateConsistentArities(
  sources: Array<{ sourceName: string; items: TopLevel[] }>,
): void {
  const arities = new Map<string, number>()
  for (const { sourceName, items } of sources) {
    for (const item of items) {
      switch (item.kind) {
        case 'rule':
          recordPredicateArity(item.rule.head, arities, sourceName)
          item.rule.body.forEach(pred => recordPredicateArity(pred, arities, sourceName))
          break
        case 'lemma':
          recordPredicateArity(item.lemma.head, arities, sourceName)
          item.lemma.hypotheses.forEach(pred => recordPredicateArity(pred, arities, sourceName))
          break
        case 'goal':
        case 'ground-query':
          recordPredicateArity(item.pred, arities, sourceName)
          break
      }
    }
  }
}

export function parseGeoFile(text: string, sourceName = '.geo file'): TopLevel[] {
  const items = parseSource(text, sourceName)
  validateGeoTopLevel(items, sourceName)
  return items
}
