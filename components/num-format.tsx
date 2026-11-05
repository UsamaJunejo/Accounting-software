"use client";

import { createContext, useContext } from "react";

// The signed-in user's number style, for charts (which are drawn in the browser).
const Ctx = createContext<"intl" | "lakh">("intl");

export function NumFormatProvider({ value, children }: { value: "intl" | "lakh"; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNumFormat() {
  return useContext(Ctx);
}
