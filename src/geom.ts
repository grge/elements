
import { parse } from  './parser/parser'
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

function cstr_point(x:number, y:number):Point {
    return {x:x, y:y}
}

function cstr_line_from_two_points(p1:Point, p2:Point):Line {
    return {Ax:p1.x, Ay:p1.y, Bx:p2.x, By:p2.y}
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
function cstr_circle_line_intersection(c:Circle, l:Line):Point {

}

function cstr_line_line_intersection(l: Line, m: Line):Point {

}

function cstr_circle_circle_intersection(c: Circle, d:Circle):Point {

}
*/

let test = `
circle A B C
circle B A C
`

let ast = parse(test)
let tokens = tokenize(test);
console.log(tokens)
console.log(JSON.stringify(ast, null, 2))




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