import { computed, signal } from "@angular/core";

import { setLanguage } from "@excalidraw/excalidraw/i18n";

import type { Language } from "@excalidraw/excalidraw/i18n";

import type { Signal } from "@angular/core";

/**
 * Upstream's `setLanguage` writes a private `editorLangCodeAtom` and every
 * component that calls `t()` inside a render body re-runs (`useI18n`), so the
 * whole React tree picks the new locale up. Angular runs a field initializer
 * once, so the editor tracks the same edge as a generation signal: the chrome
 * resolves its labels through `translated()`, which re-reads `t()` whenever
 * the generation moves.
 *
 * The atom is private to the vendored module and the editor's jotai store has
 * no store-wide subscription, so the bump hangs off this wrapper instead —
 * `setEditorLanguage` is the one path by which the editor's language changes,
 * for caliburn and for host apps alike.
 */
const languageGeneration = signal(0);

export const setEditorLanguage = async (lang: Language) => {
  await setLanguage(lang);
  languageGeneration.update((generation) => generation + 1);
};

/** a label — or a whole structure of them — re-resolved on every language
 * change, the way upstream re-resolves one on every render */
export const translated = <T>(resolve: () => T): Signal<T> =>
  computed(() => {
    languageGeneration();
    return resolve();
  });
