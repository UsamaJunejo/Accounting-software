// Colour themes users can pick in Settings (the CSS lives in app/globals.css).
export const SCHEMES = [
  { id: "royal", name: "Royal blue", desc: "Bold blue with gold highlights", swatch: ["#1a35b8", "#ffc83d", "#e6ecfd"] },
  { id: "emerald", name: "Emerald", desc: "Bold green with yellow highlights", swatch: ["#006349", "#ffd34d", "#dff3ec"] },
  { id: "magenta", name: "Magenta", desc: "Bold magenta with gold highlights", swatch: ["#861563", "#ffc83d", "#f8e4f1"] },
] as const;

export type SchemeId = (typeof SCHEMES)[number]["id"];
export const DEFAULT_SCHEME: SchemeId = "royal";

export function isScheme(v: string | undefined): v is SchemeId {
  return SCHEMES.some((s) => s.id === v);
}
