/**
 * Names for auxiliary objects.
 *
 * Unfolding a definition introduces its body-only variables (a construction's auxiliary points) as
 * new objects. They get fresh names of the form `d#3`: `#` starts a comment in source text, so no
 * name a user can write ever collides with one.
 */

export class FreshNames {
  private counts = new Map<string, number>()

  next(variable: string): string {
    const base = variable.split('#')[0]
    const n = (this.counts.get(base) ?? 0) + 1
    this.counts.set(base, n)
    return `${base}#${n}`
  }
}

export function isAuxiliary(name: string): boolean {
  return name.includes('#')
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'

/** `d#12` → `d₁₂`; user names are returned unchanged. */
export function displayName(name: string): string {
  const [base, n] = name.split('#')
  if (n === undefined) return name
  return base + [...n].map(ch => SUBSCRIPTS[Number(ch)] ?? ch).join('')
}
