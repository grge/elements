/**
 * Classes the model and the figure both build: segments of equal length (union-find over segments)
 * and lines (collinear groups merged when they share two points).
 */

/** A segment as a key, the same whichever way round its ends are given. */
export const segmentKey = (a: string, b: string) => a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`
export const segmentEnds = (k: string) => k.split('\u0001') as [string, string]

/** Union-find over string keys. A union keeps the first key's root; classes list keys as first seen. */
export class UnionFind {
  private parent = new Map<string, string>()

  add(k: string): void { if (!this.parent.has(k)) this.parent.set(k, k) }

  find(k: string): string {
    this.add(k)
    let r = k
    for (let p = this.parent.get(r)!; p !== r; p = this.parent.get(r)!) r = p
    return r
  }

  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b)
    if (ra !== rb) this.parent.set(rb, ra)
  }

  keys(): IterableIterator<string> { return this.parent.keys() }

  classes(): string[][] {
    const out = new Map<string, string[]>()
    for (const k of this.parent.keys()) {
      const r = this.find(k)
      if (!out.has(r)) out.set(r, [])
      out.get(r)!.push(k)
    }
    return [...out.values()]
  }
}

/**
 * Union-find with parity: each key is in its class either as itself or flipped (an angle, or the
 * angle beside it). `union(a, b, flip)` says b is a's flip when `flip`, else the same. A union that
 * contradicts what is known (a key both itself and flipped) marks its class `clash`: for angles, an
 * angle equal to its own supplement, a right angle.
 */
export class ParityUnionFind {
  private parent = new Map<string, string>()
  /** Whether a key is flipped relative to its parent. */
  private odd = new Map<string, boolean>()
  private clashes = new Set<string>()

  add(k: string): void { if (!this.parent.has(k)) { this.parent.set(k, k); this.odd.set(k, false) } }

  /** The key's root, and whether the key is flipped relative to it. */
  find(k: string): { root: string; flip: boolean } {
    this.add(k)
    let r = k, flip = false
    for (let p = this.parent.get(r)!; p !== r; p = this.parent.get(r)!) { flip = flip !== this.odd.get(r)!; r = p }
    return { root: r, flip }
  }

  union(a: string, b: string, flip: boolean): void {
    const fa = this.find(a), fb = this.find(b)
    if (fa.root === fb.root) {
      if ((fa.flip !== fb.flip) !== flip) this.clashes.add(fa.root)
      return
    }
    this.parent.set(fb.root, fa.root)
    this.odd.set(fb.root, fa.flip !== fb.flip !== flip)
    if (this.clashes.has(fb.root)) this.clashes.add(fa.root)
  }

  /** Mark a key's class as clashing (a key known to be its own flip). */
  clash(k: string): void { this.clashes.add(this.find(k).root) }

  /** Classes in the order keys were first seen, each key with whether it is flipped. */
  classes(): { keys: string[]; flips: boolean[]; clash: boolean }[] {
    const out = new Map<string, { keys: string[]; flips: boolean[]; clash: boolean }>()
    for (const k of this.parent.keys()) {
      const { root, flip } = this.find(k)
      if (!out.has(root)) out.set(root, { keys: [], flips: [], clash: this.clashes.has(root) })
      out.get(root)!.keys.push(k)
      out.get(root)!.flips.push(flip)
    }
    return [...out.values()]
  }
}

/**
 * Merge collinear groups that share two points (two points fix a line; distinct names are taken to
 * be distinct points). Each merged group keeps the least depth of those merged into it.
 */
export function mergeLines<T extends { points: Set<string>; depth: number }>(
  groups: T[],
  /** Anything else to merge, from `from` into `into`. */
  merge: (into: T, from: T) => void = () => {},
): T[] {
  const out = groups.map(g => ({ ...g, points: new Set(g.points) }))
  for (let merged = true; merged;) {
    merged = false
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if ([...out[i].points].filter(p => out[j].points.has(p)).length >= 2) {
          out[j].points.forEach(p => out[i].points.add(p))
          out[i].depth = Math.min(out[i].depth, out[j].depth)
          merge(out[i], out[j])
          out.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  return out
}
