/**
 * Thumbnails of predicates' figures for the contents page.
 *
 * A thumbnail is the figure a predicate's page would draw at first: its head as the only fact,
 * unfolded, planned and realised (realising is seeded, so a thumbnail is stable). They are computed
 * in idle time, a few milliseconds at a time, and cached per knowledge base, so editing a user
 * predicate (which makes a new knowledge base) refreshes them.
 */

import { shallowRef, triggerRef } from 'vue'
import type { KnowledgeBase } from '../kb/inference'
import { extract, type Extraction } from '../geometry/extraction'
import { mergedMarks } from './useClosure'
import { buildModel, plan, realise, type Point } from '../geometry/construction'
import { drawFigure, type Figure } from '../geometry/figure'
import type { Lemma } from '../language/parser'
import { bookLemmas } from './useKB'

export interface Thumbnail {
  figure: Figure
  coords: Map<string, Point>
  /** What it was drawn from (for merging its marks by the closure). */
  extraction: Extraction
}

/** The figure of `name args`, or null if there is nothing to draw. */
export function computeThumbnail(kb: KnowledgeBase, name: string, args: readonly string[], lemmas: readonly Lemma[] = []): Thumbnail | null {
  const x = extract(kb, [{ name, args }])
  const facts = x.constraints
  const figure = drawFigure(kb, x, lemmas)
  if (!figure) return null
  const { drawing } = realise(plan(buildModel(facts)))
  return drawing.coords.size ? { figure, coords: drawing.coords, extraction: x } : null
}

const cache = new WeakMap<KnowledgeBase, Map<string, Thumbnail | null>>()
const SLICE_MS = 12

export function useThumbnails() {
  /** Computed so far: a thumbnail, null (nothing to draw), or absent (not yet computed). */
  const thumbnails = shallowRef(new Map<string, Thumbnail | null>())
  let queue: Array<{ kb: KnowledgeBase; name: string; args: readonly string[] }> = []
  let scheduled = false

  const idle = (cb: () => void) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 200 })
    else setTimeout(cb, 16)
  }

  function pump() {
    scheduled = false
    const start = performance.now()
    while (queue.length && performance.now() - start < SLICE_MS) {
      const { kb, name, args } = queue.shift()!
      let known = cache.get(kb)
      if (!known) cache.set(kb, known = new Map())
      if (!known.has(name)) {
        try {
          const th = computeThumbnail(kb, name, args, bookLemmas)
          known.set(name, th)
          // Its marks merge when the closure answers.
          if (th) void mergedMarks(kb, th.extraction, th.figure, 'background').then(figure => {
            if (!figure || known!.get(name) !== th) return
            const next = { ...th, figure }
            known!.set(name, next)
            if (thumbnails.value.get(name) === th) { thumbnails.value.set(name, next); triggerRef(thumbnails) }
          }).catch(() => {})
        }
        catch { known.set(name, null) }
      }
      thumbnails.value.set(name, known.get(name)!)
    }
    triggerRef(thumbnails)
    if (queue.length) schedule()
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    idle(pump)
  }

  /** Show these predicates' thumbnails: cached ones at once, the rest as they are computed. */
  function request(kb: KnowledgeBase, entries: ReadonlyArray<{ name: string; args: readonly string[] }>) {
    const known = cache.get(kb)
    const next = new Map<string, Thumbnail | null>()
    queue = []
    for (const e of entries) {
      if (known?.has(e.name)) next.set(e.name, known.get(e.name)!)
      else queue.push({ kb, name: e.name, args: e.args })
    }
    thumbnails.value = next
    if (queue.length) schedule()
  }

  return { thumbnails, request }
}
