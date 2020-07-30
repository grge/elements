export interface Token {
    type: string;
    name: string;
}

enum State {
    Start,
    Term,
    Whitespace,
    Indent
}

interface Parser {
    name: string;
    rx: RegExp;
}

interface GlobalState {
    tokens: Array<Token>;
    current_term: string;
    indent_level: number;
    indent_stack: Array<number>;
}

type Action = (input: string, data: GlobalState) => void

interface Rule {
    start: State;
    parser: Parser;
    end: State;
    actions: Array<Action>;
}

const parsers = {
  Space: { name: 'space', rx: / / },
  Letter: { name: 'letter', rx: /[\w-]/ },
  Colon: { name: 'colon', rx: /:/ },
  Endline: { name: 'endline', rx: /[\n\r\f]/ }
}

const increase_indent: Action = (input, data) => { data.indent_level++ }

const reset_indent: Action = (input, data) => { data.indent_level = 0 }

const reset_current_term: Action = (input, data) => { data.current_term = '' }

const build_term: Action = (input, data) => { data.current_term += input }

const emit_term: Action = (input, data) => { data.tokens.push({ type: 'Term', name: data.current_term }) }

const emit_colon: Action = (input, data) => { data.tokens.push({ type: 'Colon', name: null }) }

const emit_newline: Action = (input, data) => { data.tokens.push({ type: 'Newline', name: null }) }

const emit_indent_or_dedent: Action = (input, data) => {
  const stack_size = data.indent_stack.length
  let expected_indent = stack_size ? data.indent_stack[stack_size - 1] : 0

  // We're still on the same block as the previous line
  if (data.indent_level !== expected_indent) {
    // We're on a new indent level. So emit a token and push the stack.
    if (data.indent_level > expected_indent) {
      data.tokens.push({ type: 'Indent', name: null })
      data.indent_stack.push(data.indent_level)
    } else {
      // We've dropped down an indent, pop the stack until we find the right level.
      while (data.indent_stack.length && data.indent_level < expected_indent) {
        expected_indent = data.indent_stack.pop()
        data.tokens.push({ type: 'Dedent', name: null })
      }
    }
  }
}

const rules: Array<Rule> = [
  {
    start: State.Start,
    parser: parsers.Endline,
    end: State.Start,
    actions: []
  },

  {
    start: State.Start,
    parser: parsers.Letter,
    end: State.Term,
    actions: [reset_current_term, build_term, reset_indent, emit_indent_or_dedent]
  },

  {
    start: State.Start,
    parser: parsers.Space,
    end: State.Indent,
    actions: [reset_current_term, reset_indent, increase_indent]
  },

  {
    start: State.Term,
    parser: parsers.Letter,
    end: State.Term,
    actions: [build_term]
  },

  {
    start: State.Term,
    parser: parsers.Colon,
    end: State.Whitespace,
    actions: [emit_term, reset_current_term, emit_colon]
  },

  {
    start: State.Term,
    parser: parsers.Space,
    end: State.Whitespace,
    actions: [emit_term, reset_current_term]
  },

  {
    start: State.Term,
    parser: parsers.Endline,
    end: State.Start,
    actions: [emit_term, reset_current_term, emit_newline]
  },

  {
    start: State.Whitespace,
    parser: parsers.Colon,
    end: State.Whitespace,
    actions: [emit_colon]
  },

  {
    start: State.Whitespace,
    parser: parsers.Endline,
    end: State.Start,
    actions: []
  },

  {
    start: State.Whitespace,
    parser: parsers.Letter,
    end: State.Term,
    actions: [build_term]
  },

  {
    start: State.Indent,
    parser: parsers.Space,
    end: State.Indent,
    actions: [increase_indent]
  },

  {
    start: State.Indent,
    parser: parsers.Letter,
    end: State.Term,
    actions: [build_term, emit_indent_or_dedent]
  },

  {
    start: State.Indent,
    parser: parsers.Endline,
    end: State.Start,
    actions: []
  }
]

function get_rule (rules: Array<Rule>, input: string, state: State): Rule {
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].start === state && rules[i].parser.rx.test(input)) {
      return rules[i]
    }
  }
  console.log(state, input)
  throw Error('Parse error at ' + input)
}

export function tokenize (input: string): Array<Token> {
  let state = State.Start

  const global_state: GlobalState = { tokens: [], indent_level: 0, indent_stack: [], current_term: '' }

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i)
    const rule = get_rule(rules, c, state)
    rule.actions.forEach((action) => { action(c, global_state) })
    state = rule.end
  }
  global_state.tokens.push({ type: 'EOF', name: null })
  return global_state.tokens
}
