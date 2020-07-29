import { Relation, Conjunction } from  '../parser/parser'

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