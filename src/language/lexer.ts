/**
 * EL2 Lexer — tokenizes .geo source text.
 * Port of el2/lexer.py
 */

export type TokenType =
  | 'IDENTIFIER'
  | 'COLON'
  | 'DASH'
  | 'COMMA'
  | 'QUESTION'
  | 'COMMENT'
  | 'NEWLINE'
  | 'INDENT'
  | 'DEDENT'
  | 'EOF'

export const TokenType = {
  IDENTIFIER: 'IDENTIFIER' as const,
  COLON:      'COLON'      as const,
  DASH:       'DASH'       as const,
  COMMA:      'COMMA'      as const,
  QUESTION:   'QUESTION'   as const,
  COMMENT:    'COMMENT'    as const,
  NEWLINE:    'NEWLINE'    as const,
  INDENT:     'INDENT'     as const,
  DEDENT:     'DEDENT'     as const,
  EOF:        'EOF'        as const,
}

export interface Token {
  type: TokenType
  value: string
  line: number
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  const lines = text.split('\n')
  const indentStack: number[] = [0]

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const raw = lines[lineNum - 1]
    const hash = raw.indexOf('#')
    const content = hash >= 0 ? raw.slice(0, hash) : raw
    const comment = hash >= 0 ? raw.slice(hash + 1) : ''

    if (!content.trim()) {
      if (comment.trim()) {
        tokens.push({ type: TokenType.COMMENT, value: comment.trim(), line: lineNum })
      }
      continue
    }

    const stripped = content.trimStart()
    const indentLevel = content.length - stripped.length

    if (indentLevel > indentStack[indentStack.length - 1]) {
      indentStack.push(indentLevel)
      tokens.push({ type: TokenType.INDENT, value: '', line: lineNum })
    } else if (indentLevel < indentStack[indentStack.length - 1]) {
      while (indentStack.length > 1 && indentLevel < indentStack[indentStack.length - 1]) {
        indentStack.pop()
        tokens.push({ type: TokenType.DEDENT, value: '', line: lineNum })
      }
      if (indentStack[indentStack.length - 1] !== indentLevel) {
        throw new SyntaxError(`Indentation error at line ${lineNum}`)
      }
    }

    tokenizeLine(stripped, lineNum, tokens)
    if (comment.trim()) {
      tokens.push({ type: TokenType.COMMENT, value: comment.trim(), line: lineNum })
    }
    tokens.push({ type: TokenType.NEWLINE, value: '\n', line: lineNum })
  }

  while (indentStack.length > 1) {
    indentStack.pop()
    tokens.push({ type: TokenType.DEDENT, value: '', line: lines.length + 1 })
  }
  tokens.push({ type: TokenType.EOF, value: '', line: lines.length + 1 })
  return tokens
}

function tokenizeLine(content: string, lineNum: number, out: Token[]): void {
  let i = 0
  while (i < content.length) {
    const ch = content[i]
    if (ch === ':')  { out.push({ type: TokenType.COLON,    value: ':',  line: lineNum }); i++; continue }
    if (ch === '-')  { out.push({ type: TokenType.DASH,     value: '-',  line: lineNum }); i++; continue }
    if (ch === ',')  { out.push({ type: TokenType.COMMA,    value: ',',  line: lineNum }); i++; continue }
    if (ch === '?')  { out.push({ type: TokenType.QUESTION, value: '?',  line: lineNum }); i++; continue }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue }
    if (isIdentChar(ch)) {
      const start = i
      while (i < content.length && isIdentChar(content[i])) i++
      out.push({ type: TokenType.IDENTIFIER, value: content.slice(start, i), line: lineNum })
      continue
    }
    i++
  }
}

function isIdentChar(ch: string): boolean {
  return /[\w\-]/.test(ch)
}
