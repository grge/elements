import * as geom from '@/geom/geom'
import { Plan } from '@/geom/planner'

/*

 User updates the source code:
    - planner takes the current plan, trims it backwards until all geoms are still
      geoms in the source code, and then uses this trimmed plan as a starting point
      in the graph search algorithm. The planner then returns a new plan, and a
      index indicating the number of steps at the start of ihe new plan that are unchanged

    - when the plan is executed, the executer will:
         * use the existing params for the head section of the plan that hasn't changed
         * attempt to infer_params for any other existing geoms that are constructed after
           the head section
         * where that fails, or for comletely new geoms, use a random value

    - for any params that are not inferred or locked, the executer will
      do a gradient-based search in order to find an aesthetically pleasing
      solution

 User clicks (and begins to drag) on a node:
    - Ask the planner for a new plan that allows the moved node to be fixed.

      The easiest way to do this would be to attempt to build a plan that
      begins with construction of the node that was clicked.

      It may not be possible to build a plan with that starting path, in which case
      the the clicked node cannot be moved.

    - as the user moves the point, the executer is continually run, with all the params
      being fed in rather than selected randomly.

Other concerns:
    - The graph search should be done in a webworker so that the page doens't freeze
      This means that the plan search algorithm may need to be refactored so that
      some polling can be done from the parent thread.

    - There's no need to search for a new plan every time a user clicks on a node.
      Instead, each node can have a useable plan stored as an attributed.

needed for the above:

// planner.ts

function find_plan(construction_methods, start_path:Plan, dimension:number):Plan {}

function trim_plan(old_plan:Plan, new_geoms): new_plan {}

// executer.ts

function get_params(plan, existing_params, existing_geoms): params {}

function optimise_plan(plan, starting_params, cost_function): params {}

function execute_plan(plan, params): geoms {}

*/

type ConstructedGeoms = Record<string, geom.Geom>
type ParamTypeList = Array<geom.ParamType>
type ParamList = Array<number|boolean>

type ConstructionCostFunction = (ConsturctedGeoms) => number

export function pairwise_distances (points: Array<geom.Point>): Array<[[number, number], number]> {
  const out = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i; j < points.length; j++) {
      if (i !== j) {
        const p1 = points[i]
        const p2 = points[j]
        out.push([[i, j], Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)])
      }
    }
  }
  return out
}

export function test_cost (geoms: ConstructedGeoms): number {
  const points = Object.values(geoms).filter(geom.isPoint)
  const pd = pairwise_distances(points)

  // the pairwise cost is minimal when d == 4 increases very fast as d approaches 0,
  // and increase quadratically for d > 4

  const pairwise_costs = pd.map(([_, d]) => (1 / d + (d - 4) ** 2))
  return pairwise_costs.reduce((a, b) => (a + b), 0) / pairwise_costs.length
}

export function get_param_types (p: Plan): Array<geom.ParamType> {
  return [].concat(...p.map((cm) => (cm.constructor.param_types)))
}

export function get_random_param (param_type): number|boolean {
  switch (param_type) {
    case geom.ParamType.Real:
      return Math.random() * 10 - 5
    case geom.ParamType.NonNegativeReal:
      return Math.random() * 10
    case geom.ParamType.Angle:
      return Math.random() * Math.PI * 2
    case geom.ParamType.Boolean:
      return true
  }
}

export function get_random_params (p: Plan): ParamList {
  return get_param_types(p).map(get_random_param)
}

export function execute_plan_at (p: Plan, params): ConstructedGeoms {
  const geoms = {}
  let ix = 0
  for (const cm of p) {
    const num_params = cm.constructor.param_types.length
    const in_geoms = cm.in_geom_names.map((n) => geoms[n])
    const in_params = params.slice(ix, ix + num_params)
    geoms[cm.out_geom_name] = cm.constructor(in_geoms, in_params)
    ix += num_params
  }
  return geoms
}

export function optimise_bool_params (p: Plan, start_params: ParamList, J: ConstructionCostFunction): ParamList {
  /*
    Not at all mathematically principled: twiddle the boolean params
    independently and see which configuration results in the optimal config.
    Crucially, this doesn't test all combinations of boolean params. Rather, it
    just twiddles each and checks if doing so improves the score.
  */ const param_types = get_param_types(p)

  let params = [...start_params]
  let score = J(execute_plan_at(p, params))

  param_types.forEach((param, ix) => {
    if (param_types[ix] === geom.ParamType.Boolean) {
      const twiddled_params = [...params]
      twiddled_params[ix] = !twiddled_params[ix]
      const twiddled_score = J(execute_plan_at(p, twiddled_params))
      if (twiddled_score < score) {
        score = twiddled_score
        params = twiddled_params
      }
    }
  })
  return params
}

export function optimise_real_params (p: Plan, start_params: ParamList, J: ConstructionCostFunction, max_iter: number): ParamList {
  /*
     In principle, I could work out the gradient of the cost function analytically,
     If the cost is a linear function of the pair-wise distances between points,
     then (I think) the gradient should be a linear function of the params.

     But... for now I am using SPSA. This is more flexible and easier
     to code until I am confident about the type of cost function that I want.

   1. Extract booleans and real params

   2. Create a "execute_plan_at" with the boolean params curried, i.e. a function of a vector in R^n

   3.

  */
  return start_params
}

export function optimise_params (p: Plan, start_params: ParamList, J: ConstructionCostFunction): ParamList {
  // Get a half-way reasonable arrangement of the real params
  let params = optimise_real_params(p, start_params, J, 50)
  // Now find a good combo of boolean params
  params = optimise_bool_params(p, start_params, J)
  // Now do a proper optimisation of the real params
  return optimise_real_params(p, params, J, 10000)
}

export function execute_plan (p: Plan): Record<string, geom.Geom> {
  const J = test_cost
  const start_params = get_random_params(p)
  const params = optimise_params(p, start_params, J)
  return execute_plan_at(p, params)
}
