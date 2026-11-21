/**
 * Laying out the words' dependency graph: each defined word points to the words its definition uses.
 *
 * A layered layout in swimlanes. Columns are depth: a word with no definition (an open word, such as
 * the plane's own) sits in the first column, and a defined word one column right of the deepest word
 * it rests on, so every arrow points left. Lanes are chapters, top to bottom in the book's order: a
 * word sits in the lane of the chapter that defines it. Within a lane's column, words are ordered and
 * placed near the words they rest on in the same lane (their barycentre), then pushed apart so none
 * overlap. Deterministic: the same knowledge base always gives the same picture.
 */

export interface GraphNodeIn {
  id: string
  /** Its lane (a chapter); lanes are given in order. */
  lane: string
  /** Its place in the book, for ties. */
  order: number
  dependsOn: string[]
}

export interface PlacedNode { id: string; x: number; y: number; column: number }
export interface PlacedLane { id: string; y: number; height: number }
export interface PlacedEdge {
  from: string
  to: string
  d: string
  /** Between chapters: from a word in one lane to a word in another. */
  cross: boolean
}

export interface GraphLayout {
  nodes: Map<string, PlacedNode>
  lanes: PlacedLane[]
  edges: PlacedEdge[]
  width: number
  height: number
  columns: number
}

export interface LayoutSizes {
  nodeWidth: number
  nodeHeight: number
  /** Between columns: where the arrows run. */
  columnGap: number
  /** Between words in a column. */
  rowGap: number
  /** Above a lane's first word: room for its title. */
  laneHead: number
  lanePad: number
}

export const SIZES: LayoutSizes = { nodeWidth: 194, nodeHeight: 58, columnGap: 38, rowGap: 10, laneHead: 40, lanePad: 18 }

/** The arrowhead's length (the marker in WordGraph.vue). */
export const ARROW = 11

export function layoutWordGraph(input: GraphNodeIn[], laneOrder: string[], sizes: LayoutSizes = SIZES): GraphLayout {
  const { nodeWidth: W, nodeHeight: H, columnGap: GX, rowGap: GY, laneHead, lanePad } = sizes
  const byId = new Map(input.map(n => [n.id, n]))
  const deps = (n: GraphNodeIn) => n.dependsOn.filter(d => byId.has(d) && d !== n.id)

  // Column: one right of the deepest word it rests on (definitions are not recursive; guarded anyway).
  const column = new Map<string, number>()
  const visiting = new Set<string>()
  const columnOf = (id: string): number => {
    const known = column.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0
    visiting.add(id)
    const ds = deps(byId.get(id)!)
    const c = ds.length ? 1 + Math.max(...ds.map(columnOf)) : 0
    visiting.delete(id)
    column.set(id, c)
    return c
  }
  input.forEach(n => columnOf(n.id))
  const columns = Math.max(0, ...column.values()) + 1

  // Lanes in the order given, then any others in the order their words come.
  const lanes = [...laneOrder.filter(l => input.some(n => n.lane === l)), ...new Set(input.map(n => n.lane).filter(l => !laneOrder.includes(l)))]

  // Within each lane, column by column: a word's wish is the barycentre of what it rests on in its own
  // lane; then in order of wish, each placed at its wish or just below the one before.
  const local = new Map<string, number>()     // y within its lane, from the lane's first row
  const laneHeight = new Map<string, number>()
  for (const lane of lanes) {
    let bottom = 0
    for (let c = 0; c < columns; c++) {
      const cell = input.filter(n => n.lane === lane && column.get(n.id) === c)
      const wish = (n: GraphNodeIn) => {
        const ys = deps(n).filter(d => byId.get(d)!.lane === lane && local.has(d)).map(d => local.get(d)!)
        return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : -1
      }
      const wishes = new Map(cell.map(n => [n.id, wish(n)]))
      cell.sort((a, b) => wishes.get(a.id)! - wishes.get(b.id)! || a.order - b.order)
      let next = 0
      for (const n of cell) {
        const y = Math.max(next, wishes.get(n.id)!)
        local.set(n.id, y)
        next = y + H + GY
      }
      bottom = Math.max(bottom, next - GY)
    }
    laneHeight.set(lane, bottom)
  }

  // Lanes stacked: a head for the title, the words, padding.
  const placedLanes: PlacedLane[] = []
  let top = 0
  for (const lane of lanes) {
    const height = laneHead + laneHeight.get(lane)! + lanePad
    placedLanes.push({ id: lane, y: top, height })
    top += height
  }
  const laneTop = new Map(placedLanes.map(l => [l.id, l.y + laneHead]))

  const nodes = new Map<string, PlacedNode>()
  for (const n of input) {
    const c = column.get(n.id)!
    nodes.set(n.id, { id: n.id, column: c, x: c * (W + GX), y: laneTop.get(n.lane)! + local.get(n.id)! })
  }

  // Arrows from a word's left side to the right side of each word it rests on.
  const edges: PlacedEdge[] = []
  for (const n of input) {
    const a = nodes.get(n.id)!
    for (const d of deps(n)) {
      const b = nodes.get(d)!
      const x0 = a.x, y0 = a.y + H / 2, x1 = b.x + W, y1 = b.y + H / 2
      // The curve ends in a straight run as long as the arrowhead, so the head sits on a straight line
      // however tight the bend before it.
      const xe = x1 + ARROW
      const dx = Math.max(GX / 2 - ARROW, (x0 - xe) * 0.45)
      edges.push({
        from: n.id, to: d, cross: n.lane !== byId.get(d)!.lane,
        d: `M${x0},${y0} C${x0 - dx},${y0} ${xe + dx},${y1} ${xe},${y1} L${x1},${y1}`,
      })
    }
  }

  return { nodes, lanes: placedLanes, edges, width: columns * W + (columns - 1) * GX, height: top, columns }
}
