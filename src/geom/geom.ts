export interface Point {
    x: number,
    y: number
}

export interface Line {
    Ax: number,
    Ay: number,
    Bx: number,
    By: number,
}

export interface Circle {
    Cx: number,
    Cy: number,
    r: number
}

export type Geom = Point|Circle|Line;