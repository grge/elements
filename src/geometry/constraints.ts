/**
 * EL2 Geometry — constraint types.
 * Port of el2/geometry/constraints.py
 */

export interface CollinearConstraint { kind: 'collinear'; points: string[] }
export interface BetweenConstraint   { kind: 'between';   middle: string; endpoints: [string, string] }
export interface OnCircleConstraint  { kind: 'on-circle'; center: string; radiusPoint: string; targetPoint: string }
export interface EqualDistConstraint { kind: 'eq-dist';   pair1: [string, string]; pair2: [string, string] }

export type Constraint =
  | CollinearConstraint
  | BetweenConstraint
  | OnCircleConstraint
  | EqualDistConstraint

export interface Line   { points: Set<string> }
export interface Circle { center: string; points: Set<string>; radiusClass: string }

export interface GeometryProblem {
  points: Set<string>
  constraints: Constraint[]
  lines: Line[]
  circles: Circle[]
}

export interface WitnessModel {
  coords: Map<string, [number, number]>
  energy: number
}
