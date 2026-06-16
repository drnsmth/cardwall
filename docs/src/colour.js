// A fixed palette (Atlassian-ish hues) used to tint cards.
const PALETTE = [
  '#0052cc', // blue
  '#36b37e', // green
  '#ff5630', // red
  '#ffab00', // amber
  '#6554c0', // purple
  '#00b8d9', // teal
  '#ff7452', // orange
  '#4c9aff', // light blue
];

/**
 * Build a value→colour map for a field, assigning palette colours to distinct
 * values in first-seen order (cycling once the palette is exhausted). Distinct
 * values therefore get distinct colours up to the palette size, rather than
 * risking hash collisions. Blank values are skipped so those cards keep their
 * default accent. Order is stable across reloads because the card order is, so
 * colours persist without storing anything extra.
 * @param {string[]} values  Field values in first-seen card order.
 * @returns {Map<string,string>}
 */
export function colourMap(values) {
  /** @type {Map<string,string>} */
  const map = new Map();
  let i = 0;
  for (const value of values) {
    const key = (value ?? '').trim();
    if (key && !map.has(key)) {
      map.set(key, PALETTE[i % PALETTE.length]);
      i++;
    }
  }
  return map;
}
