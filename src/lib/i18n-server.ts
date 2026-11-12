import { cookies } from "next/headers";
import { cache } from "react";
import { LANG_COOKIE, makeT, toLang, type Lang, type T } from "./i18n";

/** Language chosen on this device (cookie). Defaults to English. */
export const getLang = cache(async (): Promise<Lang> => toLang((await cookies()).get(LANG_COOKIE)?.value));

export async function getT(): Promise<T> {
  return makeT(await getLang());
}
