import { Relation, Conjunction } from  '../parser/parser'
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
    out_node: string,
    in_nodes: Array<string>,
    constructor: geom.GeomConstructor,
}

interface Node {
    name: string,
    type: string, // This names Geom subtype. Is there a typescripty way to do it?
    edges: Array<EdgeSet>
}

interface Graph {
    [name: string]: Node
}

function merge_graph(g1:Graph, g2:Graph):Graph {
    let out = {...g1}

    for (const v in g2) {
        if (v in out) {
            g2[v].edges.forEach((m1) => {
                // look for any matching methods already in out
                let x = out[v].edges.filter((m2) => {
                    return (m2.constructor.name == m1.constructor.name
                        && m1.in_nodes.join(' ') == m2.in_nodes.join(' '))
                })
                // if none exist, add one
                if (x.length == 0) {
                    out[v].edges.push(m1)
                } 
            })    
        }
        else {
            out[v] = cms2[v]
        }
    }
    return out;
}

function build_cms_from_circle_relation(r:Relation) {
    let var_names = r.vars.map((v) => (v.name));
    let name = r.name + '-' + var_names.join('');
    let type = r.name;
    let cms = {}
    cms[name] = {name: name, type: type, methods:[]}
    for (let i = 0; i < var_names.length; i++) {
        let pi = 'point-' + var_names[i]

        if (!(pi in cms)) {
            cms[pi] = {name: pi, type: 'point', methods:[
                {name: 'point', input_geoms: [], input_params: ['real', 'real'], cost: 2}
            ]}
        }

        if (i == 0) {
            cms[name].methods.push(
                {name:'circle-from-center-point', input_geoms:[pi], input_params: ['non-negative-real'], cost:1}
            )
            cms[pi].methods.push(
                {name: 'point-from-circle-center', input_geoms: [name], input_params: [], cost:0}
            )
            for (let j = i; j < var_names.length; j++) {
                if (i != j) {
                    let pj = 'point-' + var_names[j]
                    cms[name].methods.push(
                        {name:'circle-from-two-points', input_geoms:[pi, pj], input_params: [], cost:0}
                    )
                }
            }
        }
        else {
            cms[pi].methods.push(
                {name: 'point-on-circle', input_geoms: [name], input_params: ['angle'], cost:1}
            )
        }
    }
    return cms
}

function build_cms_from_line_relation(r:Relation) {
    let var_names = r.vars.map((v) => (v.name));
    let name = r.name + '-' + var_names.join('');
    let type = r.name;
    let cms = {}
    cms[name] = {name: name, type: type, methods:[]}
    for (let i = 0; i < var_names.length; i++) {
        let pi = 'point-' + var_names[i]

        if (!(pi in cms)) {
            cms[pi] = {name: pi, type: 'point', methods:[
                {name: 'point', input_geoms: [], input_params: ['real', 'real'], cost: 2}
            ]}
        }

        cms[pi].methods.push(
            {name: 'point-on-line', input_geoms: [name], input_params: ['real'], cost:1}
        )

        for (let j = i; j < var_names.length; j++) {
            if (i != j) {
                let pj = 'point-' + var_names[j];
                cms[name].methods.push(
                    {name: 'line-from-two-points', input_geoms: [pi, pj], input_params: [], cost: 0}
                )
            }
        }
    }
    return cms
}

function build_cms_from_relation(r:Relation) {
    switch(r.name) {
        case 'circle':
            return build_cms_from_circle_relation(r)
        case 'line':
            return build_cms_from_line_relation(r)
        default:
            throw "Unknown relation " + r.name + ". No construction methods known."
    }
}

function build_cms_intersections(cms) {
    for (const g in cms) {
        if (cms[g].type == 'point') {
            let ms = cms[g].methods;
            for (let i = 0; i < ms.length; i++) {
                for (let j = i; j < ms.length; j++) {
                    if (i != j) {
                        if (ms[i].name == 'point-on-circle' && ms[j].name == 'point-on-circle') {
                            cms[g].methods.push({
                                name: 'circle-circle-intersection',
                                input_geoms: [ms[i].input_geoms[0], ms[j].input_geoms[0]],
                                input_params: ['bool'],
                                cost:0}
                            )
                        }
                        else if (ms[i].name == 'point-on-line' && ms[j].name == 'point-on-circle') {
                            cms[g].methods.push({
                                name: 'circle-line-intersection',
                                input_geoms: [ms[j].input_geoms[0], ms[i].input_geoms[0]],
                                input_params: ['bool'],
                                cost:0}
                            )
                        }
                        else if (ms[i].name == 'point-on-circle' && ms[j].name == 'point-on-line') {
                            cms[g].methods.push({
                                name: 'circle-line-intersection',
                                input_geoms: [ms[i].input_geoms[0], ms[j].input_geoms[0]],
                                input_params: ['bool'],
                                cost:0}
                            )
                        }
                        else if (ms[i].name == 'point-on-line' && ms[j].name == 'point-on-line') {
                            cms[g].methods.push({
                                name: 'line-line-intersection',
                                input_geoms: [ms[i].input_geoms[0], ms[j].input_geoms[0]],
                                input_params: [],
                                cost:0}
                            )
                        }
                    }
                }
            }
        }
    }
    return cms
}

export function cms_from_conjunction(c:Conjunction) {
    let cms = c.rels.map(build_cms_from_relation).reduce(merge_cms, {})
    return build_cms_intersections(cms)
}

export function construction_plan_least_cost_first(cms, budget=10) {
    let geoms = Object.keys(cms);
    let plan = [];

    for (let i = 0; i < geoms.length; i++) {
        let constructed = plan.map(([name, cm]) => (name))
        innerLoop: for (let c = 0; c <= budget; c++) {
            for (let geom in cms) {
                if (!constructed.includes(geom) && geoms.includes(geom)) {
                    for (let cm of cms[geom].methods) {
                        if (cm.cost == c) {
                            if (cm.input_geoms.map((a) => constructed.includes(a)).every((a) => (a == true))) {
                                plan.push([geom, cm])
                                budget -= c
                                break innerLoop
                            }
                        }
                    }
                }
            }
        }
        if (plan.length - 1 < i) {
            throw "Couldn't complete plan"
        }
    }
    return plan
}