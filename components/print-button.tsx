"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-ghost">
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
