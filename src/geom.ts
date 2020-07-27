
import { parse } from  './parser/parser'
import { tokenize } from  './parser/tokens'

let test = `
circle A B C
circle B A C
`

console.log(parse(tokenize(test)))


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