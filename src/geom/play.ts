import { parse } from '../parser/parser'
import { tokenize } from  '../parser/tokens'
import { cms_from_conjunction, construction_plan_least_cost_first} from './planner'

let test = `
circle D A B
circle A D B
line D A L
line D B G
circle B C G
circle D G L
`

let ast = parse(test)
let tokens = tokenize(test);
let out = cms_from_conjunction(ast)

let plan = construction_plan_least_cost_first(out)
console.log(plan)