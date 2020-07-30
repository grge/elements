import { Relation, Conjunction } from '../parser/parser'
import * as geom from './geom'

/* Much of the code below makes references to a directed graph analogy:
   The planner needs to determine a viable method of constructing all of the
   geoms in a given conjunction, given a limited set of allowable pathways.
   In this analogy, each Geom is a node in the graph, while all possible
   GeomConstructors are represented by zero or more edges, i.e. the list of Geoms
   that are inputs to the constructor in question.

   Each construction pathway has an associated "cost", i.e. the dimension in the
   Hilbert sense, i.e., the degrees of freedom.

   The goal of the planner is to span the graph (visit each node) within a given
   dimension budget.
*/

// The Edgeset inferface represents a single viable pathway for the planner.
// I.e., it describes one possible geom construction and the requirements.
// Since a GeomConstructor may require multiple input geoms, the constrction
// represents an "EdgeSet" rather than just a single edge.
interface EdgeSet {
    out_node: string;
    in_nodes: Array<string>;
    constructor: geom.GeomConstructor;
}

interface Node {
    name: string;
    type: string; // This names Geom subtype. Is there a typescripty way to do it?
    edge_sets: Array<EdgeSet>;
}

interface Graph {
    [name: string]: Node;
}

type Plan = Array<EdgeSet>

function merge_graph (g1: Graph, g2: Graph): Graph {
  const out = { ...g1 }

  for (const v in g2) {
    if (v in out) {
      g2[v].edge_sets.forEach((e1) => {
        // look for any matching methods already in out
        const x = out[v].edge_sets.filter((e2) => {
          return (e1.constructor.name === e2.constructor.name &&
                        e1.in_nodes.join(' ') === e2.in_nodes.join(' '))
        })
        // if none exist, add one
        if (x.length === 0) {
          out[v].edge_sets.push(e1)
        }
      })
    } else {
      out[v] = g2[v]
    }
  }
  return out
}

function build_graph_from_circle_relation (r: Relation): Graph {
  const var_names = r.vars.map((v) => (v.name))
  const name = r.name + '-' + var_names.join('')
  const type = r.name
  const g: Graph = {}
  g[name] = { name: name, type: type, edge_sets: [] }
  for (let i = 0; i < var_names.length; i++) {
    const pi = 'point-' + var_names[i]

    if (!(pi in g)) {
      g[pi] = {
        name: pi,
        type: 'point',
        edge_sets: [
          { constructor: geom.point, in_nodes: [], out_node: pi }
        ]
      }
    }

    if (i === 0) {
      g[name].edge_sets.push(
        { constructor: geom.circle_from_center_and_radius, in_nodes: [pi], out_node: name }
      )
      g[pi].edge_sets.push(
        { constructor: geom.point_from_circle_center, in_nodes: [name], out_node: pi }
      )
      for (let j = i; j < var_names.length; j++) {
        if (i !== j) {
          const pj = 'point-' + var_names[j]
          g[name].edge_sets.push(
            { constructor: geom.circle_from_two_points, in_nodes: [pi, pj], out_node: name }
          )
        }
      }
    } else {
      g[pi].edge_sets.push(
        { constructor: geom.point_on_circle, in_nodes: [name], out_node: pi }
      )
    }
  }
  return g
}

function build_graph_from_line_relation (r: Relation): Graph {
  const var_names = r.vars.map((v) => (v.name))
  const name = r.name + '-' + var_names.join('')
  const type = r.name
  const g: Graph = {}
  g[name] = { name: name, type: type, edge_sets: [] }
  for (let i = 0; i < var_names.length; i++) {
    const pi = 'point-' + var_names[i]

    if (!(pi in g)) {
      g[pi] = {
        name: pi,
        type: 'point',
        edge_sets: [
          { constructor: geom.point, in_nodes: [], out_node: pi }
        ]
      }
    }

    g[pi].edge_sets.push(
      { constructor: geom.point_on_line, in_nodes: [name], out_node: pi }
    )

    for (let j = i; j < var_names.length; j++) {
      if (i !== j) {
        const pj = 'point-' + var_names[j]
        g[name].edge_sets.push(
          { constructor: geom.line_from_two_points, in_nodes: [pi, pj], out_node: name }
        )
      }
    }
  }
  return g
}

function build_graph_from_relation (r: Relation): Graph {
  switch (r.name) {
    case 'circle':
      return build_graph_from_circle_relation(r)
    case 'line':
      return build_graph_from_line_relation(r)
    default:
      throw Error('Unknown relation ' + r.name + '. No construction methods known.')
  }
}

function build_graph_intersections (g: Graph): Graph {
  for (const node in g) {
    if (g[node].type === 'point') {
      const es = g[node].edge_sets
      for (let i = 0; i < es.length; i++) {
        for (let j = i; j < es.length; j++) {
          if (i !== j) {
            if (es[i].constructor.name === 'point_on_circle' &&
                            es[j].constructor.name === 'point_on_circle') {
              g[node].edge_sets.push({
                constructor: geom.circle_circle_intersection,
                in_nodes: [es[i].in_nodes[0], es[j].in_nodes[0]],
                out_node: node
              })
            } else if (es[i].constructor.name === 'point_on_line' &&
                                 es[j].constructor.name === 'point_on_circle') {
              g[node].edge_sets.push({
                constructor: geom.circle_line_intersection,
                in_nodes: [es[j].in_nodes[0], es[i].in_nodes[0]],
                out_node: node
              })
            } else if (es[i].constructor.name === 'point_on_circle' &&
                                 es[j].constructor.name === 'point_on_line') {
              g[node].edge_sets.push({
                constructor: geom.circle_line_intersection,
                in_nodes: [es[i].in_nodes[0], es[j].in_nodes[0]],
                out_node: node
              })
            } else if (es[i].constructor.name === 'point_on_line' &&
                                 es[j].constructor.name === 'point_on_line') {
              g[node].edge_sets.push({
                constructor: geom.line_line_intersection,
                in_nodes: [es[i].in_nodes[0], es[j].in_nodes[0]],
                out_node: node
              })
            }
          }
        }
      }
    }
  }
  return g
}

export function graph_from_conjunction (c: Conjunction): Graph {
  const cms = c.rels.map(build_graph_from_relation).reduce(merge_graph, {})
  return build_graph_intersections(cms)
}

export function make_plan__least_cost_first (g: Graph, budget = 10): Plan {
  const geoms = Object.keys(g)
  const plan = []

  for (let i = 0; i < geoms.length; i++) {
    const constructed = plan.map((es) => (es.out_node))
    // eslint-disable-next-line no-labels
    innerLoop: for (let dim = 0; dim <= budget; dim++) {
      for (const geom in g) {
        if (!constructed.includes(geom) && geoms.includes(geom)) {
          for (const es of g[geom].edge_sets) {
            // If this edge has the right dimension cost
            if (es.constructor.dimension === dim) {
              // If all required nodes have been constructed
              if (es.in_nodes.map((a) => constructed.includes(a)).every((a) => (a === true))) {
                plan.push(es)
                budget -= dim
                // eslint-disable-next-line no-labels
                break innerLoop
              }
            }
          }
        }
      }
    }
    if (plan.length - 1 < i) {
      throw Error("Couldn't complete plan")
    }
  }
  return plan
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

export function execute_plan (p: Plan): Record<string, geom.Geom> {
  const geoms = {}

  for (const es of p) {
    const params = es.constructor.param_types.map(get_random_param)
    const in_geoms = es.in_nodes.map((n) => geoms[n])
    geoms[es.out_node] = es.constructor(in_geoms, params)
  }
  return geoms
}
