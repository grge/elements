import type { Rule } from '../language/parser'

export function showRule(r: Rule): string {
  const head = [r.head.name, ...r.head.args].join(' ')
  const body = r.body.map(b => [b.name, ...b.args].join(' ')).join(', ')
  return `${head}: ${body || '-'}`
}

/** A key identifying a set of rules by content (order-insensitive). */
export function fingerprint(rules: readonly Rule[]): string {
  return rules.map(showRule).sort().join('\n')
}

/** A small least-recently-used cache. */
export class Lru<V> {
  private map = new Map<string, V>()
  constructor(private readonly size: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) { this.map.delete(key); this.map.set(key, v) }
    return v
  }

  set(key: string, value: V): V {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.size) this.map.delete(this.map.keys().next().value!)
    return value
  }
}
