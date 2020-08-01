import { parse } from '../parser/parser'
import { geom_set_from_conjunction, build_construction_plan, execute_plan } from './planner'

const test = `

line A B C
line D B E


`

const ast = parse(test)
const geom_set = geom_set_from_conjunction(ast)
const plan = build_construction_plan(geom_set)
export const out = execute_plan(plan)

console.log(plan)
console.log(out)
// const plan = make_plan__least_cost_first(out, 100)
// export const geoms = execute_plan(plan)
// console.log(plan)
