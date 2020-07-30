import { parse } from '../parser/parser'
import { graph_from_conjunction, make_plan__least_cost_first, execute_plan } from './planner'

const test = `
circle A B C
circle B A C
`

const ast = parse(test)
const out = graph_from_conjunction(ast)
const plan = make_plan__least_cost_first(out, 100)
export const geoms = execute_plan(plan)
