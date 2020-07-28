
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

function cstr_point(params:[number, number]):Point {
    return {x:params[0], y:params[1]}
}

function cstr_line_from_two_points(geoms:[Point, Point]):Line {
    return {Ax:geoms[0].x, Ay:geoms[0].y, Bx:geoms[0].x, By:geoms[0].y}
}

function cstr_circle_from_center_and_radius(c:Point, r:number):Circle {
    return {Cx:c.x, Cy:c.y, r:r}
}

function cstr_circle_from_two_points(c:Point, p:Point):Circle {
    let r = Math.sqrt((p.x - c.x)^2 + (p.y - c.y)^2)
    return {Cx:c.x, Cy:c.y, r:r}
}

function cstr_point_from_circle_center(c:Circle):Point {
    return {x:c.Cx, y:c.Cy}
}

function cstr_point_on_line(l:Line, tau:number):Point {
    let x = l.Ax * tau + l.Bx * (1 - tau);
    let y = l.Ay * tau + l.By * (1 - tau);
    return {x:x, y:y}
}

function cstr_point_on_circle(c:Circle, theta:number):Point {
    let x = c.Cx + Math.cos(theta) * c.r;
    let y = c.Cy + Math.sin(theta) * c.r
    return {x:x, y:y}
}

/* TODO
function cstr_circle_line_intersection(c:Circle, l:Line):Point { }
function cstr_line_line_intersection(l: Line, m: Line):Point { }
function cstr_circle_circle_intersection(c: Circle, d:Circle):Point { }
*/

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
    // TODO
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

let test = `
circle A B C
line B A C
`

let ast = parse(test)
let tokens = tokenize(test);
let out = cms_from_conjunction(ast)

// let x = [out, out, out, out].reduce(merge_cms)

console.log(JSON.stringify(out, null, 2))

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