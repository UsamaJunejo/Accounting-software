import { redirect, RedirectType } from "next/navigation";

/**
 * Go to a page after saving, REPLACING the form in the browser's history (instead of adding a page).
 * So after "Save", the Back button goes to where you were before opening the form, not back into it.
 */
export function go(url: string): never {
  redirect(url, RedirectType.replace);
}
