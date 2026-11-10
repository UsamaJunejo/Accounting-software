"use client";

import { createContext, useContext, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const Ctx = createContext<{ shown: boolean; toggle: () => void }>({ shown: true, toggle: () => {} });

/**
 * Keeps the amounts inside it covered until the eye button is tapped, like a banking app
 * (useful when someone is standing at the counter). Hidden every time the page opens.
 */
export function PrivateAmounts({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <Ctx.Provider value={{ shown, toggle: () => setShown((s) => !s) }}>
      <div className={`min-w-0 ${className}`} data-private={shown ? "shown" : "hidden"}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** The eye button that shows or hides the amounts in the PrivateAmounts around it. */
export function ShowHideButton() {
  const { shown, toggle } = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={shown}
      aria-label={shown ? "Hide amounts" : "Show amounts"}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/25"
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {shown ? "Hide" : "Show"}
    </button>
  );
}

/** An amount that PrivateAmounts covers. */
export function Secret({ children }: { children: React.ReactNode }) {
  return <span className="secret">{children}</span>;
}
