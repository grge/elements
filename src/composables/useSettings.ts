/**
 * Working settings: choices the design has not settled, kept open so they can be tried on the book
 * (the settings pane in the masthead). Each is remembered in this browser only. When a choice
 * settles, it leaves this list and becomes the design.
 */

import { reactive, watch } from 'vue'

export interface Settings {
  /**
   * Marks a page's own statement does not call for: proven by lemmas about a relation the page does
   * not talk about (figure.ts `lemmasInPlay`). Left off, or drawn faint, receding like scaffolding.
   */
  marksAside: 'off' | 'faint'
}

interface Choice<K extends keyof Settings> {
  key: K
  label: string
  help: string
  options: { value: Settings[K]; label: string }[]
}

export const SETTING_CHOICES: Choice<keyof Settings>[] = [
  {
    key: 'marksAside',
    label: 'Marks from elsewhere',
    help: "Equalities a page's lemmas don't speak of, though they hold of its figure: the area of a parallelogram's halves, on the parallelogram's page.",
    options: [{ value: 'off', label: 'off' }, { value: 'faint', label: 'faint' }],
  },
]

const DEFAULTS: Settings = { marksAside: 'off' }
const KEY = 'elements.settings'

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>
    const out = { ...DEFAULTS }
    for (const c of SETTING_CHOICES) {
      const v = saved[c.key]
      if (c.options.some(o => o.value === v)) (out as Record<string, unknown>)[c.key] = v
    }
    return out
  } catch { return { ...DEFAULTS } }
}

/** The settings, shared by every component; changing one is remembered. */
export const settings = reactive<Settings>(load())

watch(settings, s => {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private window: not remembered */ }
})
