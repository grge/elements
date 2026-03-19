import type { GroundPredicate } from './inference'
import { groundKey } from './inference'
import { Universe } from './universe'

export interface ProofState {
  universe: Universe
  facts: GroundPredicate[]
}

/** Session-level ground configuration: a universe plus a set of ground facts. */
export class Configuration {
  readonly universe: Universe
  private facts = new Map<string, GroundPredicate>()
  private byPredicate = new Map<string, GroundPredicate[]>()

  constructor(universe = new Universe()) {
    this.universe = universe
  }

  addFact(pred: GroundPredicate): void {
    const key = groundKey(pred)
    if (this.facts.has(key)) return
    this.facts.set(key, pred)
    this.universe.introduce(pred.args)
    if (!this.byPredicate.has(pred.name)) this.byPredicate.set(pred.name, [])
    this.byPredicate.get(pred.name)!.push(pred)
  }

  addFacts(preds: readonly GroundPredicate[]): void {
    for (const pred of preds) this.addFact(pred)
  }

  hasFact(key: string): boolean {
    return this.facts.has(key)
  }

  allFacts(): GroundPredicate[] {
    return [...this.facts.values()]
  }

  factsForPredicate(name: string): GroundPredicate[] {
    return [...(this.byPredicate.get(name) ?? [])]
  }
}

export function makeProofState(seeds: readonly GroundPredicate[] = []): ProofState {
  const universe = new Universe()
  universe.introduce(seeds.flatMap(seed => seed.args))
  return { universe, facts: [...seeds] }
}
