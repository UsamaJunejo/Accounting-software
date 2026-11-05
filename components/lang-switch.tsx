import { Languages } from "lucide-react";
import { setLanguage } from "@/app/actions/lang";
import type { Lang } from "@/lib/i18n";

/** One button that flips between English and Urdu. */
export function LangSwitch({ lang, className = "" }: { lang: Lang; className?: string }) {
  return (
    <form action={setLanguage}>
      <input type="hidden" name="lang" value={lang === "ur" ? "en" : "ur"} />
      <button className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 sm:px-3 ${className}`} aria-label="Change language">
        <Languages className="h-4 w-4" />
        {lang === "ur" ? "English" : "اردو"}
      </button>
    </form>
  );
}
