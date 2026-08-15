import { signal } from "@angular/core";

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
