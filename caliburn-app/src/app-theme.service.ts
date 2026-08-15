import { Injectable, computed, effect, signal } from "@angular/core";

import { THEME } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import { STORAGE_KEYS } from "./app_constants";

import type { OnDestroy } from "@angular/core";

const getDarkThemeMediaQuery = (): MediaQueryList | undefined =>
  window.matchMedia?.("(prefers-color-scheme: dark)");

/**
 * Angular port of upstream `excalidraw-app/useHandleAppTheme.ts`.
 *
 * `appTheme` is the user's setting (light / dark / follow the system) and
 * `editorTheme` the theme the editor is actually rendered with; the system
 * branch resolves the latter from `prefers-color-scheme` and keeps listening
 * while it stays selected. The editor drives `setAppTheme` through its
 * `onThemeChange` prop, which is what both the menu's theme picker and the
 * Alt+Shift+D shortcut (`actionToggleTheme`) call.
 */
@Injectable({ providedIn: "root" })
export class AppThemeService implements OnDestroy {
  readonly appTheme = signal<Theme | "system">(
    (localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME) as
      | Theme
      | "system"
      | null) || THEME.LIGHT,
  );

  private readonly systemTheme = signal<Theme>(
    getDarkThemeMediaQuery()?.matches ? THEME.DARK : THEME.LIGHT,
  );

  readonly editorTheme = computed<Theme>(() => {
    const appTheme = this.appTheme();
    return appTheme === "system" ? this.systemTheme() : appTheme;
  });

  private readonly mediaQuery = getDarkThemeMediaQuery();

  private readonly onSystemThemeChange = (event: MediaQueryListEvent) => {
    this.systemTheme.set(event.matches ? THEME.DARK : THEME.LIGHT);
  };

  private readonly persistTheme = effect(() => {
    const appTheme = this.appTheme();
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, appTheme);

    this.mediaQuery?.removeEventListener("change", this.onSystemThemeChange);
    if (appTheme === "system") {
      this.systemTheme.set(this.mediaQuery?.matches ? THEME.DARK : THEME.LIGHT);
      this.mediaQuery?.addEventListener("change", this.onSystemThemeChange);
    }
  });

  readonly setAppTheme = (theme: Theme | "system") => {
    this.appTheme.set(theme);
  };

  ngOnDestroy() {
    this.mediaQuery?.removeEventListener("change", this.onSystemThemeChange);
  }
}
