"use client";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-ghost">
      {label}
    </button>
  );
}
