/**
 * EL2 Parser — parses tokens into Rules and Goals.
 * Port of el2/parser.py
 *
 * Syntax:
 *   Horn clause (inline):  head args: body1 args, body2 args
 *   Horn clause (indented): head args:\n  body1 args\n  body2 args
 *   Axiom (no body):       head args: -
 *   Goal (bare):           pred args
 *   Lemma (inline):        ? head args: body1, body2
 *   Lemma (indented):      ? head args:\n  body1 args
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

export type TopLevel =
  | { kind: 'rule';  rule: Rule }
  | { kind: 'goal';  pred: Predicate }
  | { kind: 'lemma'; lemma: Lemma }

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
    while (this.current.type !== TokenType.EOF) {
      this.consume(TokenType.NEWLINE, TokenType.INDENT, TokenType.DEDENT)
      if (this.current.type === TokenType.EOF) break

      if (this.current.type === TokenType.QUESTION) {
        this.advance()
        result.push({ kind: 'lemma', lemma: this.parseLemma() })
      } else if (this.current.type === TokenType.IDENTIFIER) {
        result.push(this.parseRuleOrGoal())
      } else {
        this.advance()
      }
    }
    return result
  }

  private parseRuleOrGoal(): TopLevel {
    const head = this.parsePredicate()

    if (this.current.type === TokenType.COLON) {
      this.advance()
      const body = this.parseBody()
      return { kind: 'rule', rule: { head, body } }
    } else {
      // No colon — it's a bare goal
      return { kind: 'goal', pred: head }
    }
  }

  private parseLemma(): Lemma {
    const head = this.parsePredicate()

    if (this.current.type === TokenType.COLON) {
      this.advance()
      const hypotheses = this.parseBody()
      return { head, hypotheses }
    }
    return { head, hypotheses: [] }
  }

  private parseBody(): Predicate[] {
    // Explicit empty body
    if (this.current.type === TokenType.DASH) {
      this.advance()
      return []
    }

    // Skip newline to see what's next
    if (this.current.type === TokenType.NEWLINE) {
      this.advance()
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
      if (this.current.type === TokenType.COMMA) this.advance()
    }
    return body
  }

  private parseMultiLineBody(): Predicate[] {
    const body: Predicate[] = []
    while (true) {
      this.consume(TokenType.NEWLINE)
      if (this.current.type === TokenType.DEDENT || this.current.type === TokenType.EOF) break
      this.consume(TokenType.INDENT)
      if (this.current.type !== TokenType.IDENTIFIER) break
      body.push(this.parsePredicate())
      while (this.current.type === TokenType.COMMA) {
        this.advance()
        if (this.current.type === TokenType.IDENTIFIER) body.push(this.parsePredicate())
      }
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

    while (this.current.type === TokenType.IDENTIFIER && !this.atBoundary()) {
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

  private atBoundary(): boolean {
    return [
      TokenType.COLON, TokenType.COMMA, TokenType.NEWLINE,
      TokenType.DASH, TokenType.DEDENT, TokenType.EOF, TokenType.QUESTION,
    ].includes(this.current.type)
  }
}

// ── Public API ────────────────────────────────────────────────────────

export function parseSource(text: string): TopLevel[] {
  return new Parser(tokenize(text)).parse()
}

/** Extract only Rules from a source string (e.g. loading basic.geo) */
export function parseRules(text: string): Rule[] {
  return parseSource(text)
    .filter((t): t is { kind: 'rule'; rule: Rule } => t.kind === 'rule')
    .map(t => t.rule)
}

/** Extract only goal predicates from a source string */
export function parseGoals(text: string): Predicate[] {
  return parseSource(text)
    .filter((t): t is { kind: 'goal'; pred: Predicate } => t.kind === 'goal')
    .map(t => t.pred)
}
