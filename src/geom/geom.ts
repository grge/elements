export interface Point {
    x: number;
    y: number;
}

export interface Line {
    Ax: number;
    Ay: number;
    Bx: number;
    By: number;
}

export interface Circle {
    Cx: number;
    Cy: number;
    r: number;
}

export type Geom = Point|Circle|Line;

/*

NOTE:
The ParamTypes are not really types at all. It would be great if there was a
way to actually harness the type system to achieve what I need here. But I think
that the need to distinguish between e.g. Real vs NonNegativeReal at runtime makes
this quite difficult.
*/

export enum ParamType {
    NonNegativeReal,
    Real,
    Angle,
    Boolean
}

type NakedGeomConstructor =
    (geoms: Array<Geom>, params: Array<number|boolean>) => Geom

export interface GeomConstructor extends NakedGeomConstructor {
    dimension: number;
    param_types: Array<ParamType>;
    infer_params: (input: Array<Geom>, output: Geom) => Array<number|boolean>;
}

/*
Construct a point from two free params
*/
export const point: GeomConstructor =
    function point (geoms: [], params: [number, number]): Point {
      return { x: params[0], y: params[1] }
    }

point.infer_params = function (input: [], output: Point): [number, number] {
  return [output.x, output.y]
}
point.param_types = [ParamType.Real, ParamType.Real]
point.dimension = 2

/*
Construct a Line from two existing Points
*/
export const line_from_two_points: GeomConstructor =
    function line_from_two_points (geoms: [Point, Point]): Line {
      return { Ax: geoms[0].x, Ay: geoms[0].y, Bx: geoms[1].x, By: geoms[1].y }
    }

line_from_two_points.infer_params = (): [] => []
line_from_two_points.param_types = []
line_from_two_points.dimension = 0

/*
Construct a Circle from an existing Point at the center, and a free radius param
*/
export const circle_from_center_and_radius: GeomConstructor =
    function circle_from_center_and_radius (geoms: [Point], params: [number]): Circle {
      return { Cx: geoms[0].x, Cy: geoms[0].y, r: params[0] }
    }

circle_from_center_and_radius.infer_params = function (input: [Point], output: Circle): [number] {
  return [output.r]
}
circle_from_center_and_radius.param_types = [ParamType.NonNegativeReal]
circle_from_center_and_radius.dimension = 1

/*
Construct a Circle from two existing Points: one at the center, and another on
the Circle itself.
*/
export const circle_from_two_points: GeomConstructor =
    function circle_from_two_points (geoms: [Point, Point]): Circle {
      const [c, p] = geoms
      const r = Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2)
      return { Cx: c.x, Cy: c.y, r: r }
    }

circle_from_two_points.infer_params = (): [] => []
circle_from_two_points.param_types = []
circle_from_two_points.dimension = 0

/*
Construct a Point at the center of an existing Circle
*/
export const point_from_circle_center: GeomConstructor =
    function point_from_circle_center (geoms: [Circle]): Point {
      return { x: geoms[0].Cx, y: geoms[0].Cy }
    }

point_from_circle_center.infer_params = (): [] => []
point_from_circle_center.param_types = []
point_from_circle_center.dimension = 0

/*
Construct a Point somewhere an an existing Line, using a free parameter that
describes the linear combination of the defining coordinates of the Line
*/
export const point_on_line: GeomConstructor =
    function point_on_line (geoms: [Line], params: [number]): Point {
      const l = geoms[0]
      const tau = params[0]
      const x = l.Ax * tau + l.Bx * (1 - tau)
      const y = l.Ay * tau + l.By * (1 - tau)
      return { x: x, y: y }
    }

point_on_line.infer_params = (input: [Line], output: Point): [number] => {
  const l = input[0]
  return [(output.x - l.Bx) / (l.Ax - l.Bx)]
}
point_on_line.param_types = [ParamType.Real]
point_on_line.dimension = 1

/*
Construct a Point somewhere on an existing Circle, using a free parameter that
describes the angle.
*/
export const point_on_circle: GeomConstructor =
    function point_on_circle (geoms: [Circle], params: [number]): Point {
      const c = geoms[0]
      const theta = params[0]
      const x = c.Cx + Math.cos(theta) * c.r
      const y = c.Cy + Math.sin(theta) * c.r
      return { x: x, y: y }
    }

point_on_circle.infer_params = (input: [Circle], output: Point): [number] => {
  const c = input[0]
  const x = output.x - c.Cx
  const y = output.y - c.Cy
  return [Math.atan2(y, x)]
}
point_on_circle.param_types = [ParamType.Angle]
point_on_circle.dimension = 1

/*
Construct a Point that is at the intersection of two existing Lines.
If the lines are parallel, this throws an error.
*/
export const line_line_intersection: GeomConstructor =
    function line_line_intersection (geoms: [Line, Line]): Point {
      const [l, m] = geoms
      // If either lines is defined by coincident points
      if ((l.Ax === l.Bx && l.Ay === l.By) || (m.Ax === m.Bx && m.Ay === m.By)) {
        throw Error('Cannot construct intersection from poorly defined Line')
      }
      const denom = (m.By - m.Ay) * (l.Bx - l.Ax) - (m.Bx - m.Ax) * (l.Bx - l.Ax)
      // If the lines are parallel (i.e. the denominator is zero)
      if (denom === 0) {
        throw Error('Cannot construct intersection of parallel lines')
      }
      const numer = (m.Bx - m.Ax) * (l.Ay - m.Ay) - (m.By - m.Ay) * (l.Ax - m.Ax)
      // Note: tau is a parameter for the line l
      const tau = numer / denom
      return { x: tau * (l.Bx - l.Ax) + l.Ax, y: tau * (l.By - l.Ay) + l.Ay }
    }

line_line_intersection.infer_params = (): [] => []
line_line_intersection.param_types = []
line_line_intersection.dimension = 0

/*
Construct a Point that is at the intersection of two existing Circles.
If there are zero points of intersection, this throws an error. If there are two
points of intersection, a boolean parameter is used to select which Point to
construct.
*/
export const circle_circle_intersection: GeomConstructor =
    function circle_circle_intersection (geoms: [Circle, Circle], params: [boolean]): Point {
      const [C, D] = geoms
      const [k] = params

      const [Cx, Cy, Dx, Dy, r, s] = [C.Cx, C.Cy, D.Cx, D.Cy, C.r, D.r]

      /* eslint-disable space-infix-ops */
      const d = Math.sqrt((Dx - Cx)**2 + (Dy - Cy)**2)

      if (d > r + s) { throw Error('Non-overlapping circle have no intersection. ') }
      if (d < Math.abs(r - s)) { throw Error('Circle inside another circle has no intersection.') }

      /* Consider
          CD: the line between the centers of the two circles
          EF: the line between the two intersection points we are trying to find

         then:
          CD and EF intesect at point M.
          CME be the right triangles, with hypotenus r

         let a be the length of the side of the triangle CME coincident with line CD

         then we have
      */
      const a = (r**2 - s**2 + d**2) / (2 * d)

      // distnce from M to intersection points
      const h = Math.sqrt(r**2 - a**2)

      const Mx = Cx + a * (Dx - Cx) / d
      const My = Cy + a * (Dy - Cy) / d

      if (k) {
        return { x: Mx + h * (Dy - Cy) / d, y: My - h*(Dx - Cx) / d }
      } else {
        return { x: Mx - h * (Dy - Cy) / d, y: My + h*(Dx - Cx) / d }
      }
      /* eslint-enable space-infix-ops */
    }

// Note: infer_params is not yet implemented
circle_circle_intersection.infer_params = (): [boolean] => [true]
circle_circle_intersection.param_types = [ParamType.Boolean]
circle_circle_intersection.dimension = 0

/*
Construct a Point that is at the intersection of an existing Circle and Line.
If there are zero points of intersection, this throws an error. If there are two
points of intersection, a boolean parameter is used to select which Point to
construct.
*/
export const circle_line_intersection: GeomConstructor =
    function circle_line_intersection (geoms: [Circle, Line], params: [boolean]): Point {
      const [C, L] = geoms
      const [k] = params

      /* eslint-disable space-infix-ops */

      const [Ax, Ay, Bx, By, Cx, Cy, r] = [L.Ax, L.Ay, L.Bx, L.By, C.Cx, C.Cy, C.r]

      /*
      If the line has the parametric form A + t*(B - A), then we find t by
      substituting this form into the equation of the circle.
      After collecting terms in t, the euqation is quadratic

        a*t^2 + b*t + c = 0

      where
      */
      const a = (Bx - Ax)**2 + (By - Ay)**2
      const b = 2 * ((Bx - Ax)*(Ax - Cx) + (By - Ay)*(Ay - Cy))
      const c = Cx**2 + Cy**2 + Ax**2 + Ay**2 - 2*(Cx*Ax + Cy*Ay) - r**2

      const d = b**2 - 4 * a * c // discriminant of the quadratic equation

      if (d < 0) { throw Error('No solutions, line and circle do not intersect.') }

      let sqrt_d = Math.sqrt(d)

      if (k) { sqrt_d = -sqrt_d }

      const t = (-b + sqrt_d) / (2*a)

      return {
        x: Ax + t*(Bx - Ax),
        y: Ay + t*(By - Ay)
      }
      /* eslint-enable space-infix-ops */
    }

// Note: infer_params is not yet implemented
circle_line_intersection.infer_params = (): [boolean] => [true]
circle_line_intersection.param_types = [ParamType.Boolean]
circle_line_intersection.dimension = 0
