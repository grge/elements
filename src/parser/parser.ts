import { Token, tokenize } from './tokens'

export interface Definition {
    name: string;
    vars: Array<Variable>;
    conj: Conjunction;
}

export interface Conjunction {
    rels: Array<Relation>;
    defs: Array<Definition>;
}

export interface Relation {
    name: string;
    vars: Array<Variable>;
}

export interface Variable {
    name: string;
}

export function parse_variable (tokens: Array<Token>): Variable {
  const token = tokens.shift()
  if (token.type === 'Term') {
    return { name: token.name }
  }
}

export function parse_relation_or_definition (tokens: Array<Token>): Relation|Definition {
  let token = tokens.shift()

  const name = token.name
  const vars: Array<Variable> = []
  switch (token.type) {
    case 'Term':

      // eslint-disable-next-line no-unmodified-loop-condition
      while (tokens && tokens[0].type === 'Term') {
        vars.push(parse_variable(tokens))
      }

      token = tokens.shift()

      switch (token.type) {
        case 'Colon':
          token = tokens.shift()
          if (token.type !== 'Indent') {
            throw Error('Parse error: Expected indent, got ' + token.type)
          };
          // eslint-disable-next-line
          const conj = parse_conjunction(tokens)
          token = tokens.shift()
          if (token.type !== 'EOF' && token.type !== 'Dedent') {
            throw Error('Parse error: Expected dedent, got ' + token.type)
          };
          return { name: name, vars: vars, conj: conj }
        case 'Newline':
        case 'EOF':
          return { name: name, vars: vars }
        default:
          throw Error('Parse error: Unexpected token' + token.type)
      }
    default:
      throw Error('Parse error: Expected Term, got ' + token.type)
  }
}

export function parse_conjunction (tokens: Array<Token>): Conjunction {
  const rels: Array<Relation> = []
  const defs: Array<Definition> = []

  while (tokens.length && tokens[0].type !== 'EOF' && tokens[0].type !== 'Dedent') {
    if (tokens[0].type === 'Indent') { tokens.pop() }
    const x = parse_relation_or_definition(tokens)

    if ((x as Definition).conj) {
      defs.push(x as Definition)
    } else {
      rels.push(x as Relation)
    }
  }
  return { rels: rels, defs: defs }
}

export function parse (source: string): Conjunction {
  return parse_conjunction(tokenize(source))
}

/* Code needs repair:

var collect_variables = function(conjunction) {
    vars = {};
    _.each(conjunction.relations, function(r) {
        _.each(r.variables, function(v) {
            if(!vars[v.name]) {
                vars[v.name] = [];
            }
            vars[v.name].push(r)
        })
    });
    return vars;
}
exports.collect_variables = collect_variables

*/
