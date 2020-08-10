import { Relation, Definition, Variable, Conjunction } from '@/parser/parser'

type Scope = Array<Definition>

export function get_definition (scope: Scope, name: string): Definition {
  scope.forEach((d) => {
    if (d.name === name) {
      return d
    }
  })
  return undefined
}

export function get_fresh_var (vars: Array<Variable>): Variable {
  let i = 1;
  let name = ''
  do {
    name = '鮮' + i
    i++
  } while (vars.map((v) => v.name).includes(name))
  return { name: name }
}

export function expand_rel_in_scope (scope: Scope, rel: Relation): Array<Relation> {
  const def = get_definition(scope, rel.name)

  if (!def) { return [rel] }

  // for variables in the projection, we use substitions
  const var_map = def.vars.reduce((o, v, ix) => ({...o, [v.name]: rel.vars[ix]}), {})

  def.conj.rels.forEach((r) => {
    r.vars.forEach((v) => {
      if (var_map[v.name] !== undefined) {
        var_map[v.name] = get_fresh_var(Object.values(var_map))
      }
    })
  })

  return def.conj.rels.map((r) => ({ name: r.name, vars: r.vars.map((n) => var_map[n.name]) }))
}

export function expand_conj_in_scope (scope: Scope, conj: Conjunction): Conjunction {
  if (scope === undefined) {
    scope = []
  }

  scope.push(...conj.defs)

  const flat_defs = conj.defs.map((d) => {
    return { name: d.name, vars: d.vars, conj: expand_conj_in_scope(scope, d.conj) }
  })

  const rels = conj.rels.map((r) => (expand_rel_in_scope([...scope, ...flat_defs], r)))

  return { rels: [].concat(...rels), defs: [] }
}
