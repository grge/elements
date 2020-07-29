
import { parse, Relation, Conjunction } from  './parser/parser'
import { tokenize } from  './parser/tokens'

interface Point {
    x: number,
    y: number
}

interface Line {
    Ax: number,
    Ay: number,
    Bx: number,
    By: number,
}

interface Circle {
    Cx: number,
    Cy: number,
    r: number
}

type Geom = Point|Circle|Line;

function cstr_point(geoms:[], params:[number, number]):Point {
    return {x:params[0], y:params[1]}
}

function cstr_line_from_two_points(geoms:[Point, Point], params:[]):Line {
    return {Ax:geoms[0].x, Ay:geoms[0].y, Bx:geoms[0].x, By:geoms[0].y}
}

function cstr_circle_from_center_and_radius(geoms:[Point], params:[number]):Circle {
    return {Cx:geoms[0].x, Cy:geoms[0].y, r:params[0]}
}

function cstr_circle_from_two_points(geoms:[Point, Point], params:[]):Circle {
    let [p, c] = geoms
    let r = Math.sqrt((p.x - c.x)^2 + (p.y - c.y)^2)
    return {Cx:c.x, Cy:c.y, r:r}
}

function cstr_point_from_circle_center(geoms:[Circle], params:[]):Point {
    return {x:geoms[0].Cx, y:geoms[0].Cy}
}

function cstr_point_on_line(geoms:[Line], params:[number]):Point {
    let l = geoms[0];
    let tau  = params[0];
    let x = l.Ax * tau + l.Bx * (1 - tau);
    let y = l.Ay * tau + l.By * (1 - tau);
    return {x:x, y:y}
}

function cstr_point_on_circle(geoms:[Circle], params:[number]):Point {
    let c = geoms[0];
    let theta = params[0];
    let x = c.Cx + Math.cos(theta) * c.r;
    let y = c.Cy + Math.sin(theta) * c.r
    return {x:x, y:y}
}

function cstr_line_line_intersection(geoms: [Line, Line], params:[]):Point {
    let [l, m] = geoms;
    // If either lines is defined by coincident points, then throw an error
    if ((l.Ax == l.Bx && l.Ay == l.By) || (m.Ax == m.Bx && m.Ay == m.By)) {
        throw "" // TODO
    }
    let denom = (m.By - m.Ay) * (l.Bx - l.Ax) - (m.Bx - m.Ax) * (l.Bx - l.Ax)
    // If the lines are parallel (i.e. the denominator is zero), throw an error
    if (denom === 0) {
        throw "" // TODO
    }
    let numer = (m.Bx - m.Ax) * (l.Ay - m.Ay) - (m.By - m.Ay) * (l.Ax - m.Ax)
    // Note: tau is a parameter for the line l
    let tau = numer / denom;
    return {x:tau*(l.Bx - l.Ax) + l.Ax, y: tau*(l.By - l.Ay) + l.Ay}
 }


function cstr_circle_circle_intersection(geoms: [Circle, Circle], params:[Boolean]):Point { 
    let [c, d] = geoms;
    let [k] = params;

    // distance between the two centers
    let D = (d.Cx - c.Cx)**2 + (d.Cy - c.Cy)**2;

    // If the centers are further apart than the sum of the radii, there are no solutions
    if (D > c.r + d.r) {
        throw ""
    }

    // If one circle is inside of the other, there are no solutions
    if (D < Math.abs(c.r - d.r)) {
        throw ""
    }

    // Note: point M is the intersection of the line joining the two circle centers,
    // and the line joining the two intersection points. 

    // find distance from c to M
    let a = (c.r**2 - d.r**2 + D**2) / (2.0 * D)

    // coordinates of M
    let Mx = c.Cx + (d.Cx - c.Cx) * a / D
    let My = c.Cy + (d.Cy - c.Cy) * a / D

    // distnce from M to intersection points
    let h = Math.sqrt(c.r**2 - a**2)

    let rx = -(d.Cy - c.Cy) * (h / D)
    let ry = (d.Cx - c.Cx) * (h / D)

    if (k) {
        return {x: c.Cx + rx, y: c.Cy + ry}
    }
    else {
        return {x: c.Cx - rx, y: c.Cy - ry}
    }

}

function cstr_circle_line_intersection(geoms:[Circle, Line], params:[Boolean]):Point {
    let [C, L] = geoms;
    let [k] = params;

    // slope and intercept of L
    let m = (L.By - L.Ay) / (L.Bx - L.Ax)
    let b = L.Ay - m * L.Ax

    let discriminant = C.r**2 * (1 + m**2) - (C.Cy - m * C.Cx - b)**2

    if (discriminant < 0) {
        throw ""
    }

    let z = Math.sqrt(discriminant)
    if (k) {
        z = -z
    }
    return {
        x: (C.Cx + m * C.Cy - m * b + z) / (1 + m**2),
        y: (b + m * C.Cx + m**2 * C.Cy + z) / (1 + m**2),
    }
 }

function merge_cms(cms1, cms2) {
    let out = {...cms1}

    for (const v in cms2) {
        if (v in out) {
            cms2[v].methods.forEach((m1) => {
                // look for any matching methods already in out
                let x = out[v].methods.filter((m2) => {
                    return m2.name == m1.name && m1.input_geoms.join(' ') == m2.input_geoms.join(' ')
                })
                // if none exist, add one
                if (x.length == 0) {
                    out[v].methods.push(m1)
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

function cms_from_conjunction(c:Conjunction) {
    let cms = c.rels.map(build_cms_from_relation).reduce(merge_cms, {})
    return build_cms_intersections(cms)
}


function construction_plan_least_cost_first(cms, budget=10) {
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

let test = `
circle D A B
circle A D B
line D A L
line D B G
circle B C G
circle D G L
`

let ast = parse(test)
let tokens = tokenize(test);
let out = cms_from_conjunction(ast)

let plan = construction_plan_least_cost_first(out)
console.log(plan)
// let x = [out, out, out, out].reduce(merge_cms)

// console.log(JSON.stringify(out, null, 2))

/* Gemetric processing
   Step 1: Collect all relations associated with each variable
   Step 2: Expand each relation into basic ones ("circle", "line")
   Step 3: Expand basic relations into constructions ("line-circle-intersection", "line-line-intersection", etc)
   Step 3: Expand basic relations into constructions ("line-circle-intersection", "line-line-intersection", etc)

// find a definitions in the scope
var get_def = function(name, scope) {
    return scope[name];
};

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