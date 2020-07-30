import { parse } from '../parser/parser'
import { tokenize } from  '../parser/tokens'
import { graph_from_conjunction, make_plan__least_cost_first, execute_plan} from './planner'

let test = `
circle A B C
circle B A C
`

let ast = parse(test)
let out = graph_from_conjunction(ast)
let plan = make_plan__least_cost_first(out, 100)
let geoms = execute_plan(plan)
console.log(plan)
console.log(geoms)