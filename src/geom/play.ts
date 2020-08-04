import { parse } from '../parser/parser'
import { geom_set_from_conjunction, build_construction_plan, execute_plan } from './planner'

const test = `


circle A B D E F
circle B A E
circle D A F
line A E C
line C D B
line D F A

`

const ast = parse(test)
const geom_set = geom_set_from_conjunction(ast)

const plan = build_construction_plan(geom_set)
// console.log(plan)
export const out = execute_plan(plan)
console.log(plan)

// console.log(geom_set)
// console.log(plan)
// console.log(out)
// const plan = make_plan__least_cost_first(out, 100)
// export const geoms = execute_plan(plan)
// console.log(plan)
