// Category colours: one bright colour per category, the same on its tile, in the donut and in the bars.
// This order passed the colour-blindness validator (adjacent pairs). Never cycle: a 9th category shares grey.
export const CATEGORY_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const OTHER_COLOR = "#8a979e";

export function categoryColor(index: number) {
  return CATEGORY_COLORS[index] ?? OTHER_COLOR;
}

/** Colour for each balance-sheet category, by its order. Income and expense stay neutral. */
export function categoryColorMap(cats: { id: number; kind: string; color?: string | null }[]) {
  const m = new Map<number, string>();
  let slot = 0;
  for (const c of cats) {
    if (c.color) m.set(c.id, c.color);
    else if (c.kind !== "income" && c.kind !== "expense") m.set(c.id, categoryColor(slot++));
  }
  return m;
}
