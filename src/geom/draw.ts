import * as geom from '@/geom/geom'
import { Plan } from '@/geom/planner'

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
