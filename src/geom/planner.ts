import { PriorityQueue } from 'buckets-js'

import { Relation, Conjunction } from '../parser/parser'
import * as geom from './geom'

interface ConstructionMethod {
    out_geom_name: string;
    in_geom_names: Array<string>;
    constructor: geom.GeomConstructor;
}

interface ConstructableGeom {
    name: string;
    type: string; // This names Geom subtype. Is there a typescripty way to do it?
    constr_methods: Array<ConstructionMethod>;
}

interface ConstructableGeomSet {
    [name: string]: ConstructableGeom;
}

type Plan = Array<ConstructionMethod>

interface GraphExtension {
  cost: number;
  out_node_id: string;
  in_node_id: string;
  constr_method: ConstructionMethod;
}

interface Node {
  id: string;
  cost: number;
  plan: Plan;
}

function merge_geom_sets (g1: ConstructableGeomSet, g2: ConstructableGeomSet): ConstructableGeomSet {
  const out = { ...g1 }

  for (const v in g2) {
    if (v in out) {
      g2[v].constr_methods.forEach((e1) => {
        // look for any matching methods already in out
        const x = out[v].constr_methods.filter((e2) => {
          return (e1.constructor.name === e2.constructor.name &&
                    e1.in_geom_names.join(' ') === e2.in_geom_names.join(' '))
        })
        // if none exist, add one
        if (x.length === 0) {
          out[v].constr_methods.push(e1)
        }
      })
    } else {
      out[v] = g2[v]
    }
  }
  return out
}

function build_geom_set_from_circle_relation (r: Relation): ConstructableGeomSet {
  const var_names = r.vars.map((v) => (v.name))
  const name = r.name + '-' + var_names.join('')
  const type = r.name
  const g: ConstructableGeomSet = {}
  g[name] = { name: name, type: type, constr_methods: [] }
  for (let i = 0; i < var_names.length; i++) {
    const pi = 'point-' + var_names[i]

    if (!(pi in g)) {
      g[pi] = {
        name: pi,
        type: 'point',
        constr_methods: [
          { constructor: geom.point, in_geom_names: [], out_geom_name: pi }
        ]
      }
    }

    if (i === 0) {
      g[name].constr_methods.push(
        { constructor: geom.circle_from_center_and_radius, in_geom_names: [pi], out_geom_name: name }
      )
      g[pi].constr_methods.push(
        { constructor: geom.point_from_circle_center, in_geom_names: [name], out_geom_name: pi }
      )
      for (let j = i; j < var_names.length; j++) {
        if (i !== j) {
          const pj = 'point-' + var_names[j]
          g[name].constr_methods.push(
            { constructor: geom.circle_from_two_points, in_geom_names: [pi, pj], out_geom_name: name }
          )
        }
      }
    } else {
      g[pi].constr_methods.push(
        { constructor: geom.point_on_circle, in_geom_names: [name], out_geom_name: pi }
      )
    }
  }
  return g
}

function build_geom_set_from_line_relation (r: Relation): ConstructableGeomSet {
  const var_names = r.vars.map((v) => (v.name))
  const name = r.name + '-' + var_names.join('')
  const type = r.name
  const g: ConstructableGeomSet = {}
  g[name] = { name: name, type: type, constr_methods: [] }
  for (let i = 0; i < var_names.length; i++) {
    const pi = 'point-' + var_names[i]

    if (!(pi in g)) {
      g[pi] = {
        name: pi,
        type: 'point',
        constr_methods: [
          { constructor: geom.point, in_geom_names: [], out_geom_name: pi }
        ]
      }
    }

    g[pi].constr_methods.push(
      { constructor: geom.point_on_line, in_geom_names: [name], out_geom_name: pi }
    )

    for (let j = i; j < var_names.length; j++) {
      if (i !== j) {
        const pj = 'point-' + var_names[j]
        g[name].constr_methods.push(
          { constructor: geom.line_from_two_points, in_geom_names: [pi, pj], out_geom_name: name }
        )
      }
    }
  }
  return g
}

function build_geom_set_from_relation (r: Relation): ConstructableGeomSet {
  switch (r.name) {
    case 'circle':
      return build_geom_set_from_circle_relation(r)
    case 'line':
      return build_geom_set_from_line_relation(r)
    default:
      throw Error('Unknown relation ' + r.name + '. No construction methods known.')
  }
}

function build_geom_set_intersections (g: ConstructableGeomSet): ConstructableGeomSet {
  for (const geom_name in g) {
    if (g[geom_name].type === 'point') {
      const es = g[geom_name].constr_methods
      for (let i = 0; i < es.length; i++) {
        for (let j = i; j < es.length; j++) {
          if (i !== j) {
            if (es[i].constructor.name === 'point_on_circle' &&
                            es[j].constructor.name === 'point_on_circle') {
              g[geom_name].constr_methods.push({
                constructor: geom.circle_circle_intersection,
                in_geom_names: [es[i].in_geom_names[0], es[j].in_geom_names[0]],
                out_geom_name: geom_name
              })
            } else if (es[i].constructor.name === 'point_on_line' &&
                                 es[j].constructor.name === 'point_on_circle') {
              g[geom_name].constr_methods.push({
                constructor: geom.circle_line_intersection,
                in_geom_names: [es[j].in_geom_names[0], es[i].in_geom_names[0]],
                out_geom_name: geom_name
              })
            } else if (es[i].constructor.name === 'point_on_circle' &&
                                 es[j].constructor.name === 'point_on_line') {
              g[geom_name].constr_methods.push({
                constructor: geom.circle_line_intersection,
                in_geom_names: [es[i].in_geom_names[0], es[j].in_geom_names[0]],
                out_geom_name: geom_name
              })
            } else if (es[i].constructor.name === 'point_on_line' &&
                                 es[j].constructor.name === 'point_on_line') {
              g[geom_name].constr_methods.push({
                constructor: geom.line_line_intersection,
                in_geom_names: [es[i].in_geom_names[0], es[j].in_geom_names[0]],
                out_geom_name: geom_name
              })
            }
          }
        }
      }
    }
  }
  return g
}

export function geom_set_from_conjunction (c: Conjunction): ConstructableGeomSet {
  const geoms = c.rels.map(build_geom_set_from_relation).reduce(merge_geom_sets, {})
  return build_geom_set_intersections(geoms)
}

export function get_random_param (param_type): number|boolean {
  switch (param_type) {
    case geom.ParamType.Real:
      return Math.random() * 20 - 10
    case geom.ParamType.NonNegativeReal:
      return Math.random() * 10
    case geom.ParamType.Angle:
      return Math.random() * Math.PI * 2
    case geom.ParamType.Boolean:
      return true
  }
}

function make_node_id_from_geom_names (geom_names: Array<string>): string {
  return geom_names.sort().join('\x1e')
}

function make_geom_names_from_node_id (node_id: string): Array<string> {
  if (node_id === '') {
    return []
  } else {
    return node_id.split('\x1e')
  }
}

function constructable_from (m: ConstructionMethod, node_id: string): boolean {
  const geoms = make_geom_names_from_node_id(node_id)
  return m.in_geom_names.map((g) => (geoms.includes(g))).every((v) => (v === true))
}

function get_extensions_from_node (node: Node, constr_methods): Array<GraphExtension> {
  const constructed_geoms = make_geom_names_from_node_id(node.id)
  const all_geoms = Object.keys(constr_methods)
  const out: Array<GraphExtension> = []
  all_geoms
    .filter((geom_name) => (!constructed_geoms.includes(geom_name)))
    .forEach((geom_name) => {
      constr_methods[geom_name].constr_methods
        .filter((m: ConstructionMethod) => (constructable_from(m, node.id)))
        .forEach((m: ConstructionMethod) => {
          out.push({
            cost: node.cost + m.constructor.dimension,
            out_node_id: make_node_id_from_geom_names([...constructed_geoms, m.out_geom_name]),
            in_node_id: node.id,
            constr_method: m
          })
        })
    })
  return out
}

export function build_construction_plan (constr_methods): Plan {
  const nodes = {}
  const q = new PriorityQueue((a, b) => (b.cost - a.cost))
  const budget = Infinity
  nodes[''] = { id: '', cost: 0, plan: [] }
  const end_node_id = make_node_id_from_geom_names(Object.keys(constr_methods))

  get_extensions_from_node(nodes[''], constr_methods).forEach(q.add)

  while (!q.isEmpty()) {
    const ext: GraphExtension = q.dequeue()

    if (ext.cost <= budget) {
      if (!(ext.out_node_id in nodes)) {
        nodes[ext.out_node_id] = {
          id: ext.out_node_id,
          cost: ext.cost,
          plan: [...nodes[ext.in_node_id].plan, ext.constr_method]
        }
      }

      if (ext.out_node_id === end_node_id) {
        return nodes[end_node_id].plan
      } else {
        get_extensions_from_node(nodes[ext.out_node_id], constr_methods).forEach(q.enqueue)
      }
    }
  }
  throw Error('Could not find a construction plan')
}

export function execute_plan (p: Plan): Record<string, geom.Geom> {
  const geoms = {}

  for (const cm of p) {
    const params = cm.constructor.param_types.map(get_random_param)
    const in_geoms = cm.in_geom_names.map((n) => geoms[n])
    geoms[cm.out_geom_name] = cm.constructor(in_geoms, params)
  }
  return geoms
}
