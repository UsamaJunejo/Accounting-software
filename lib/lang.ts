import "server-only";
import { cookies } from "next/headers";
import { translate, type Lang } from "./i18n.ts";
import { DEFAULT_SCHEME, isScheme, type SchemeId } from "./schemes.ts";

export async function getScheme(): Promise<SchemeId> {
  const v = (await cookies()).get("scheme")?.value;
  return isScheme(v) ? v : DEFAULT_SCHEME;
}

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "ur" ? "ur" : "en";
}

/** Usage in a server component: const t = await getT(); t("Dashboard") */
export async function getT() {
  const lang = await getLang();
  return Object.assign((s: string) => translate(lang, s), { lang });
}
