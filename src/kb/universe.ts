export type UniverseListener = (newObjects: string[]) => void

/** Tracks the set of named objects currently in scope for inference. */
export class Universe {
  private objects = new Set<string>()
  private listeners: UniverseListener[] = []

  introduce(names: readonly string[]): void {
    const fresh: string[] = []
    for (const name of names) {
      if (!this.objects.has(name)) {
        this.objects.add(name)
        fresh.push(name)
      }
    }
    if (fresh.length > 0) {
      for (const listener of this.listeners) listener(fresh)
    }
  }

  has(name: string): boolean {
    return this.objects.has(name)
  }

  all(): ReadonlySet<string> {
    return this.objects
  }

  onIntroduce(cb: UniverseListener): void {
    this.listeners.push(cb)
  }
}
