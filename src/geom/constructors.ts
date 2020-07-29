import {Geom, Point, Line, Circle} from './geom'

interface GeomConstructor {
    dimension: number
    construct: (geoms:Array<Geom>, params:Array<number|boolean>) => Geom
    infer_params: (input:Array<Geom>, output:Geom) => Array<number|boolean>
}

export let point:GeomConstructor = {
    construct(geoms:[], params:[number, number]):Point {
        return {x:params[0], y:params[1]}
    },
    infer_params(input:[], output:Point):[number, number] {
        return [output.x, output.y]
    },
    dimension: 2
}

export let line_from_two_points:GeomConstructor = {
    construct(geoms:[Point, Point], params:[]):Line {
        return {Ax:geoms[0].x, Ay:geoms[0].y, Bx:geoms[0].x, By:geoms[0].y}
    },
    infer_params(input:[Point, Point], output:Line):[] {
        return [];
    },
    dimension: 0
}

export let circle_from_center_and_radius:GeomConstructor = {
    construct(geoms:[Point], params:[number]):Circle {
        return {Cx:geoms[0].x, Cy:geoms[0].y, r:params[0]}
    },
    infer_params(input:[Point], output:Circle):[number] {
        return [output.r]
    },
    dimension: 1
}

export let circle_from_two_points:GeomConstructor = {
    construct(geoms:[Point, Point], params:[]):Circle {
        let [p, c] = geoms
        let r = Math.sqrt((p.x - c.x)^2 + (p.y - c.y)^2)
        return {Cx:c.x, Cy:c.y, r:r}
    },
    infer_params(input:[Point, Point], output:Circle):[] {
        return [];
    },
    dimension: 0
}

export let point_from_circle_center:GeomConstructor = {
    construct(geoms:[Circle], params:[]):Point {
        return {x:geoms[0].Cx, y:geoms[0].Cy}
    },
    infer_params(input:[Circle], output:Point):[] {
        return []
    },
    dimension: 0
}

export let point_on_line:GeomConstructor = {
    construct(geoms:[Line], params:[number]):Point {
        let l = geoms[0];
        let tau  = params[0];
        let x = l.Ax * tau + l.Bx * (1 - tau);
        let y = l.Ay * tau + l.By * (1 - tau);
        return {x:x, y:y}
    },
    infer_params(input:[Line], output:Point):[number] {
        let l = input[0];
        return [(output.x - l.Bx) / (l.Ax - l.Bx)]
    },
    dimension: 1
}

export let point_on_circle:GeomConstructor = {
    construct(geoms:[Circle], params:[number]):Point {
        let c = geoms[0];
        let theta = params[0];
        let x = c.Cx + Math.cos(theta) * c.r;
        let y = c.Cy + Math.sin(theta) * c.r
        return {x:x, y:y}
    },
    infer_params(input:[Circle], output:Point):[number] {
        let c = input[0];
        let x = output.x - c.Cx 
        let y = output.y - c.Cy 
        return [Math.atan2(y, x)]
    },
    dimension: 1
}

export let line_line_intersection:GeomConstructor = {
    construct(geoms:[Line, Line], params:[]):Point {
        let [l, m] = geoms;
        // If either lines is defined by coincident points
        if ((l.Ax == l.Bx && l.Ay == l.By) || (m.Ax == m.Bx && m.Ay == m.By)) {
            throw "" // TODO
        }
        let denom = (m.By - m.Ay)*(l.Bx - l.Ax) - (m.Bx - m.Ax)*(l.Bx - l.Ax)
        // If the lines are parallel (i.e. the denominator is zero)
        if (denom === 0) {
            throw "" // TODO
        }
        let numer = (m.Bx - m.Ax)*(l.Ay - m.Ay) - (m.By - m.Ay)*(l.Ax - m.Ax)
        // Note: tau is a parameter for the line l
        let tau = numer / denom;
        return {x:tau*(l.Bx - l.Ax) + l.Ax, y: tau*(l.By - l.Ay) + l.Ay}
    },
    infer_params(input:[Line, Line], output:Point):[] {
        return [];
    },
    dimension: 0
}

export let circle_circle_intersection:GeomConstructor = {
    construct(geoms: [Circle, Circle], params:[boolean]):Point { 
        let [c, d] = geoms;
        let [k] = params;

        // distance between the two centers
        let D = (d.Cx - c.Cx)**2 + (d.Cy - c.Cy)**2;

        // If the centers are further apart than the sum of the radii, there
        // are no solutions
        if (D > c.r + d.r) { throw "" }

        // If one circle is inside of the other, there are no solutions
        if (D < Math.abs(c.r - d.r)) { throw "" }

        // Point M is the intersection of the line joining the two circle
        // centers, and the line joining the two intersection points. 

        // find distance from c to M
        let a = (c.r**2 - d.r**2 + D**2) / (2.0 * D)

        // coordinates of M
        let Mx = c.Cx + (d.Cx - c.Cx) * a / D
        let My = c.Cy + (d.Cy - c.Cy) * a / D

        // distnce from M to intersection points
        let h = Math.sqrt(c.r**2 - a**2)

        let rx = -(d.Cy - c.Cy) * (h / D)
        let ry = (d.Cx - c.Cx) * (h / D)

        if (k) {
            return {x: c.Cx + rx, y: c.Cy + ry}
        }
        else {
            return {x: c.Cx - rx, y: c.Cy - ry}
        }
    },
    infer_params(input:[Line, Line], output:Point):[boolean] {
        // TODO: This is not a correct implementation
        return [true]
    },
    dimension: 0
}

export let circle_line_intersection:GeomConstructor = {
    construct(geoms:[Circle, Line], params:[boolean]):Point {
        let [C, L] = geoms;
        let [k] = params;

        // slope and intercept of L
        let m = (L.By - L.Ay) / (L.Bx - L.Ax)
        let b = L.Ay - m * L.Ax

        let discriminant = C.r**2 * (1 + m**2) - (C.Cy - m * C.Cx - b)**2

        if (discriminant < 0) {
            throw ""
        }

        let z = Math.sqrt(discriminant)
        if (k) {
            z = -z
        }
        return {
            x: (C.Cx + m * C.Cy - m * b + z) / (1 + m**2),
            y: (b + m * C.Cx + m**2 * C.Cy + z) / (1 + m**2),
        }
    },
    infer_params(input:[Line, Line], output:Point):[boolean] {
        // TODO: This is not a correct implementation
        return [true]
    },
    dimension: 0
}