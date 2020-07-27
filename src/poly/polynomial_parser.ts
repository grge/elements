import { Poly } from "./polynomial"

export function p_parse(p:string):[Poly, Array<string>] {
    let all_vars = new Set();
    let terms = p.split('+').map((t) => {
        let vars = t.split('*').map((v) => {
            if (!isNaN(v)) {
                return {var: null, val: +v}
            }
            else {
                let x = v.split('^');
                if (x.length == 1) {
                    all_vars.add(v.trim())
                    return {var: v.trim(), val: 1}
                }
                else if (x.length == 2) {
                    all_vars.add(x[0].trim())
                    return {var: x[0].trim(), val: +x[1]}
                }
                else {
                    throw TypeError("Couldn't parse string to polynomial")
                }
            }
        })
        return vars
    })

    let sorted_vars = Array.from(all_vars)
    sorted_vars.sort()

    let poly = terms.map((t) => {
        let m = Array(t.length).fill(0);
        let coef = 1;
        t.forEach((v) => {
            if (v.var === null) {
                coef = v.val;
            }
            else {
                let ix = sorted_vars.findIndex((x) => (x == v.var));
                m[ix] = v.val
            }
        })
        return {m: m, coef:coef}
    });

    return [poly, sorted_vars]
}
