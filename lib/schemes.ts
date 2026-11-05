// Colour themes users can pick in Settings (the CSS lives in app/globals.css).
export const SCHEMES = [
  { id: "peacock", name: "Peacock", desc: "Deep teal menu, teal buttons", swatch: ["#0e2a30", "#0b6e75", "#f2b705"] },
  { id: "navy", name: "Navy & gold", desc: "Classic banking navy, blue buttons", swatch: ["#0f1e3a", "#1d4ed8", "#f5b700"] },
  { id: "emerald", name: "Emerald", desc: "Pakistan green menu, green buttons", swatch: ["#0b3b2e", "#13704a", "#f5c542"] },
  { id: "light", name: "Clean light", desc: "White menu, blue highlights", swatch: ["#ffffff", "#2f5bd3", "#e8eefc"] },
] as const;

export type SchemeId = (typeof SCHEMES)[number]["id"];
export const DEFAULT_SCHEME: SchemeId = "peacock";

export function isScheme(v: string | undefined): v is SchemeId {
  return SCHEMES.some((s) => s.id === v);
}
