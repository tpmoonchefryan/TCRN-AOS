import { tcrnFallbackLocale, tcrnSupportedLocales, type TcrnLocale } from "@tcrn/ui-copy-state";

/**
 * Five-locale copy, enforced by the type system rather than by review.
 *
 * TCRN-AOS-INC-013 asked a sharper question than "why is the copy missing":
 * the DS consumption contract has declared five required locales since it
 * shipped (`tcrnI18nContract.supportedLocales`, `copyCoverage: "required"`),
 * and DS itself carries all five for all eleven readiness states. AOS consumed
 * that contract and still rendered two languages. So the rule was not missing
 * and it was not weak — it was unenforceable at the only place it mattered.
 *
 * The idiom AOS actually wrote was `isZh ? "中文" : "English"`, 384 times. That
 * expression cannot express a third locale. No amount of contract text or code
 * review fixes it, because there is no wrong value to catch: every ternary is
 * individually complete and collectively bilingual. A reviewer sees correct
 * code; the fifth locale has nowhere to go.
 *
 * `CopyEntry` is `Record<TcrnLocale, string>`, so a missing locale is a compile
 * error at the point the string is written. That is the difference between a
 * rule that is documented and a rule that holds: not a stricter reviewer, but
 * a shape the defect does not fit into.
 *
 * Two surfaces, one shape:
 *   - `pick` for copy that belongs to one view (below)
 *   - `localeCopy` in `data.ts` for chrome reused across views
 * Neither can hold four locales.
 */
export type CopyEntry = Record<TcrnLocale, string>;

/**
 * The string for `locale`, or the fallback locale's string.
 *
 * The fallback branch is not reachable through the type system — every entry
 * has every locale — but `locale` arrives from a URL query, and this is the
 * boundary where an unsupported value becomes a supported one. `resolveLocale`
 * already narrows it; this keeps the function honest if it is ever called with
 * a widened type.
 */
export function pick(locale: TcrnLocale, entry: CopyEntry): string {
  return entry[locale] ?? entry[tcrnFallbackLocale];
}

/**
 * A sentence with values substituted into it, in the reader's language.
 *
 * `{0}`, `{1}` … are replaced positionally. The reason a counted sentence is a
 * five-locale template rather than concatenation is word order: `${n} chains`
 * becomes 「{0} 条链」 in Chinese and 「체인 {0}개」 in Korean, where the number sits
 * before a measure word in one and after a noun in the other. Assembling the
 * sentence in code can only produce one order, so a translated vocabulary would
 * still be laid out in English — the thing that makes a localized page read as
 * machine output even when every word is right.
 *
 * Deliberately not Intl.MessageFormat: these are positional substitutions into
 * whole translated sentences, and pulling in a message syntax would add a parse
 * step and a second place a locale can be missing without buying plural rules
 * these strings do not use.
 */
export function format(locale: TcrnLocale, entry: CopyEntry, ...values: Array<string | number>): string {
  return values.reduce<string>(
    (text, value, index) => text.replaceAll(`{${index}}`, String(value)),
    pick(locale, entry)
  );
}

/**
 * Names joined the way the reader's language joins them.
 *
 * CJK enumerates with an ideographic comma and no space; the Latin locales use a
 * comma and a space. Hard-coding either one puts a visible punctuation error into
 * three of the five locales.
 */
export function joinNames(names: readonly string[], locale: TcrnLocale): string {
  return names.join(locale === "zh-CN" || locale === "ja" ? "、" : ", ");
}

/**
 * Whether `entry` covers every declared locale with a non-empty string.
 *
 * Used by the usability gate against dictionaries assembled at runtime, where
 * the compile-time guarantee does not reach — a `Record<string, string>` read
 * from generated data, for instance. Source-authored entries do not need this.
 */
export function coversAllLocales(entry: Partial<Record<string, string>>): boolean {
  return tcrnSupportedLocales.every((locale) => (entry[locale] ?? "").trim().length > 0);
}
