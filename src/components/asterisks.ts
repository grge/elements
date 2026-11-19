/**
 * Stars pencilled in a margin, the mark of a point the solver placed: three strokes of uneven
 * length at uneven angles, not quite meeting at one centre, one a little bowed. A few hands, so no
 * two solved points look stamped; each point keeps its own (chosen by its name), so it does not
 * change hand as the figure redraws, and the construction's steps show it in the same hand.
 * Paths are centred on the origin, about 16 units across.
 */
const ASTERISKS = [
  'M1.2,-8.6 Q-0.6,-0.5 -0.8,6.4 M-7.8,-1.9 L6.3,5.2 M-5.4,6.1 L8.1,-4.3',
  'M-0.9,-7.4 L0.8,8.1 M-6.9,-4.4 Q0.5,-0.8 7.6,2.3 M-7.2,3.6 L5.8,-5.1',
  'M0.3,-8.1 Q1.4,-1 -0.2,7 M-8.2,-0.8 L7.1,3.9 M-4.6,6.8 Q1.2,0.4 6.4,-6.2',
  'M-1.6,-8 L1.1,7.3 M-6.1,-5.2 L8,2.6 M-7.9,2.4 Q-0.4,-0.3 6.7,-3.4',
]

export function asteriskFor(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ASTERISKS[h % ASTERISKS.length]
}
