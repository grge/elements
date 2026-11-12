/**
 * What the figure draws, read from the depicted facts (extraction.ts), each drawn as its relation
 * says (relations.ts `draw`): lines, finite straight lines, circles, angles (arcs and right-angle
 * squares), and the marks, classes of equal segments and equal angles stated or proven (marks.ts).
 * Every element has its depth (how many definitions were unfolded to reach it; the figure draws
 * deeper elements fainter) and the facts that made it, for the page to say where it came from.
 *
 * Where the points go is the construction's business (construction.ts), or the solver's; this is
 * only what to draw through them.
 */

import type { GroundPredicate, KnowledgeBase } from '../kb/inference'
import type { Lemma } from '../language/parser'
import { analyseStructure } from '../kb/structure'
import { factKey, type DrawableFact, type Extraction } from './extraction'
import { relationOf, type Pen } from './relations'
import { UnionFind, mergeLines, segmentKey } from './classes'
import { equalities, markClasses, type MarkClass } from './marks'

/** Every element says which facts made it, by key (extraction.ts `factKey`). */
interface Made { depth: number; facts: string[] }

export interface Figure {
  /** Every point a depicted fact mentions. */
  points: string[]
  /**
   * Lines through their points, merged where they share two points. `faint` when only finite
   * straight lines lie on it (`between`): the line is their continuation, drawn faint.
   */
  lines: ({ points: string[]; faint: boolean } & Made)[]
  /** Finite straight lines, drawn at full strength. */
  strokes: ({ ends: [string, string] } & Made)[]
  /** Circles about a centre through their points; circles with the same centre and radius are one. */
  circles: ({ center: string; points: string[] } & Made)[]
  /** Angles drawn as themselves (not as marks of equality): an arc, or a right angle's square. */
  angles: ({ points: [string, string, string]; as: 'arc' | 'square' } & Made)[]
  /** Classes of equal segments, equal angles (any recognised equivalence): what ticks and arcs mark. */
  marks: MarkClass[]
  /** The facts elements were made from, by key. */
  sources: Map<string, DrawableFact>
}

/**
 * The figure of an extraction, with its marks: equalities it states, and those that `lemmas` (✓
 * ones only) prove about the constructions it uses.
 */
export function drawFigure(kb: KnowledgeBase, x: Extraction, lemmas: readonly Lemma[]): Figure | null {
  const { equivalences } = analyseStructure(kb.allRules())
  const figure = figureOf(x.depicted, markClasses(equalities(x.outline, x.depicted, lemmas, equivalences), equivalences))
  // A proven mark is made by the constructions its lemma matched: they are sources too.
  for (const f of x.outline) if (!figure?.sources.has(factKey(f))) figure?.sources.set(factKey(f), f)
  return figure
}

/** The figure of the depicted facts; null when nothing is drawn. */
export function figureOf(depicted: readonly (GroundPredicate & { depth?: number; origin?: number })[], marks: MarkClass[] = []): Figure | null {
  const facts = depicted.filter(f => relationOf(f)?.depicted)
  if (!facts.length) return null
  const points: string[] = []
  for (const f of facts) for (const p of f.args) if (!points.includes(p)) points.push(p)

  const sources = new Map<string, DrawableFact>()
  const groups: ({ points: Set<string>; faint: boolean } & Made)[] = []
  const strokes: Figure['strokes'] = []
  const angles: Figure['angles'] = []
  const onCircles: { center: string; through: readonly string[]; depth: number; key: string }[] = []
  const radii = new UnionFind()
  for (const f of facts) {
    const key = factKey(f)
    const depth = f.depth ?? 0
    sources.set(key, { ...f, depth })
    const pen: Pen = {
      line: pts => groups.push({ points: new Set(pts), faint: false, depth, facts: [key] }),
      segment: (a, c, through) => {
        strokes.push({ ends: [a, c], depth, facts: [key] })
        groups.push({ points: new Set(through), faint: true, depth, facts: [key] })
      },
      circle: (center, through) => onCircles.push({ center, through, depth, key }),
      angle: (a, b, c, as) => angles.push({ points: [a, b, c], as, depth, facts: [key] }),
      sameLength: (a, b, c, d) => radii.union(segmentKey(a, b), segmentKey(c, d)),
    }
    relationOf(f)!.draw?.(f.args, pen)
  }

  const lines = mergeLines(groups, (into, from) => {
    into.faint = into.faint && from.faint
    into.facts.push(...from.facts)
  }).filter(l => l.points.size >= 2).map(l => ({ ...l, points: [...l.points] }))

  // A circle is its centre and its radius; radii stated equal make one radius.
  const byKey = new Map<string, Figure['circles'][number]>()
  for (const c of onCircles) {
    if (!c.through.length) continue
    const key = `${c.center}\u0002${radii.find(segmentKey(c.center, c.through[0]))}`
    const circle = byKey.get(key) ?? { center: c.center, points: [], depth: c.depth, facts: [] }
    for (const p of c.through) if (!circle.points.includes(p)) circle.points.push(p)
    circle.depth = Math.min(circle.depth, c.depth)
    circle.facts.push(c.key)
    byKey.set(key, circle)
  }

  return { points, lines, strokes, circles: [...byKey.values()], angles, marks, sources }
}
