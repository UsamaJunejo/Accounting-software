import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";

/** Switch the Accounts page between coloured tiles and the detailed list. */
export function ViewToggle({ list }: { list: boolean }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-white/80 bg-white/60 backdrop-blur">
      <Link href="/accounts" aria-current={!list ? "page" : undefined} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${!list ? "bg-peacock text-white" : "text-peacock"}`}><LayoutGrid className="h-4 w-4" />Tiles</Link>
      <Link href="/accounts?view=list" aria-current={list ? "page" : undefined} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${list ? "bg-peacock text-white" : "text-peacock"}`}><List className="h-4 w-4" />List</Link>
    </div>
  );
}

