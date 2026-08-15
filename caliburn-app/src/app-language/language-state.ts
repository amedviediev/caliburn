import { signal } from "@angular/core";

import {
  defaultLang,
  getLanguage,
  languages,
  setLanguage,
} from "@excalidraw/excalidraw/i18n";

import { getPreferredLanguage, languageDetector } from "./language-detector";

/**
 * Angular port of upstream
 * `excalidraw-app/app-language/language-state.ts`: `appLangCodeAtom` is a
 * module-level signal, and `useAppLangCode`'s effect — which caches every
 * chosen language back into the detector — is folded into the setter, the
 * only way the value ever changes.
 */
export const appLangCode = signal(getPreferredLanguage());

export const setAppLangCode = (langCode: string) => {
  appLangCode.set(langCode);
  languageDetector.cacheUserLanguage(langCode);
};

/**
 * The language the editor has actually loaded, i.e. the one `t()` resolves
 * against — upstream's `useI18n().langCode`, whose `editorLangCodeAtom` is
 * private to the vendored `i18n` module, so the app mirrors it here instead.
 * It trails `appLangCode` by the time it takes to fetch the locale.
 */
export const loadedLangCode = signal(getLanguage().code);

/** loads a locale and reports it, the way upstream's `InitializeApp` and
 * `App.updateLanguage` both do */
export const loadLanguage = async (langCode: string) => {
  const lang =
    languages.find((language) => language.code === langCode) || defaultLang;
  await setLanguage(lang);
  loadedLangCode.set(lang.code);
};
