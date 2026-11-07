/**
 * Geometry types shared by extraction, canonicalisation, the solver and the renderer.
 */

// `depth`: how many definitions were unfolded to reach the fact (see DrawableFact); the figure draws
// deeper elements fainter and thinner. Absent means 0.
export interface CollinearConstraint { kind: 'collinear'; points: string[]; depth?: number }
export interface BetweenConstraint   { kind: 'between';   middle: string; endpoints: [string, string]; depth?: number }
export interface OnCircleConstraint  { kind: 'on-circle'; center: string; radiusPoint: string; targetPoint: string; depth?: number }
export interface EqualDistConstraint { kind: 'eq-dist';   pair1: [string, string]; pair2: [string, string]; depth?: number }

export type Constraint =
  | CollinearConstraint
  | BetweenConstraint
  | OnCircleConstraint
  | EqualDistConstraint

export interface Line   { points: Set<string>; depth?: number }
export interface Circle { center: string; points: Set<string>; radiusClass: string; depth?: number }

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
