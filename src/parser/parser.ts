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

  switch (token.type) {
    case 'Term':
      const name = token.name
      const vars: Array<Variable> = []

      while (tokens && tokens[0].type === 'Term') {
        vars.push(parse_variable(tokens))
      }

      token = tokens.shift()

      switch (token.type) {
        case 'Colon':
          token = tokens.shift()
          if (token.type !== 'Indent') {
            throw 'Parse error: Expected indent, got ' + token.type
          };
          const conj = parse_conjunction(tokens)
          token = tokens.shift()
          if (token.type !== 'EOF' && token.type !== 'Dedent') {
            throw 'Parse error: Expected dedent, got ' + token.type
          };
          return { name: name, vars: vars, conj: conj }
        case 'Newline':
        case 'EOF':
          return { name: name, vars: vars }
        default:
          throw 'Parse error: Unexpected token' + token.type
      }
    default:
      throw 'Parse error: Expected Term, got ' + token.type
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

// Expand a single relation against an in-scope definition
var expand = function(rel, scope) {
    var def = get_def(rel.name, scope);
    if (!def) { return rel; }

    var names = function(vars) { return _.map(vars, function(v) { return v.name })};

    // for variables in the projection, we use substitions
    var lookup = _.object(_.zip(names(def.variables), rel.variables))

    // for variables that are not in the projection, we use "fresh" vars with a random number
    _.each(def.conjunction.relations, function(r) {
        _.each(r.variables, function(v) {
            if (!lookup[v.name]) {
                lookup[v.name] = parser.variable("fresh-" + Math.random());
            }
        })
    });

    var rels = _.map(def.conjunction.relations, function(r) {
        return parser.relation(r.name, _.map(r.variables, function(v) { return lookup[v.name] }));
    })

    return rels;
}

var extend_scope = function(scope, defs) {
    return _.extend(_.clone(scope), _.object(_.map(defs, function(d) { return [d.name, d] })));
}

var expand_all = function(conj, scope) {
    if (scope === undefined) { scope = {}}
    scope = extend_scope(scope, conj.definitions);
    var flat_defs = _.map(conj.definitions, function(d) {
        return parser.definition(d.name, d.variables, expand_all(d.conjunction, scope));
    })

    var rels = _.flatten(_.map(conj.relations, function(r) {
        return expand(r, extend_scope(scope, flat_defs))
    }), true);

    return parser.conjunction(rels, []);
}
exports.expand_all = expand_all

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
