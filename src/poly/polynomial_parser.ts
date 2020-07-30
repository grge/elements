import { Poly } from './polynomial'

export function p_parse (p: string): [Poly, Array<string>] {
  const all_vars = new Set<string>()
  const terms = p.split('+').map((t) => {
    const vars = t.split('*').map((v) => {
      if (!isNaN(Number(v))) {
        return { var: null, val: +v }
      } else {
        const x = v.split('^')
        if (x.length == 1) {
          all_vars.add(v.trim())
          return { var: v.trim(), val: 1 }
        } else if (x.length == 2) {
          all_vars.add(x[0].trim())
          return { var: x[0].trim(), val: +x[1] }
        } else {
          throw TypeError("Couldn't parse string to polynomial")
        }
      }
    })
    return vars
  })

  const sorted_vars: Array<string> = Array.from(all_vars)
  sorted_vars.sort()

  const poly = terms.map((t) => {
    const m = Array(t.length).fill(0)
    let coef = 1
    t.forEach((v) => {
      if (v.var === null) {
        coef = v.val
      } else {
        const ix = sorted_vars.findIndex((x) => (x == v.var))
        m[ix] = v.val
      }
    })
    return { m: m, coef: coef }
  })

  return [poly, sorted_vars]
}
