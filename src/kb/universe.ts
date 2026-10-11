/** The set of named objects currently in scope for inference. */
export class Universe {
  private objects = new Set<string>()

  introduce(names: readonly string[]): void {
    for (const name of names) this.objects.add(name)
  }

  has(name: string): boolean {
    return this.objects.has(name)
  }

  all(): ReadonlySet<string> {
    return this.objects
  }
}
