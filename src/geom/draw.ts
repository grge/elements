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

export function execute_plan (p: Plan): Record<string, geom.Geom> {
  const geoms = {}

  for (const cm of p) {
    const params = cm.constructor.param_types.map(get_random_param)
    const in_geoms = cm.in_geom_names.map((n) => geoms[n])
    geoms[cm.out_geom_name] = cm.constructor(in_geoms, params)
  }
  return geoms
}
