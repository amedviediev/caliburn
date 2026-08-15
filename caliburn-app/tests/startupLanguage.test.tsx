import { vi } from "vitest";

import { setAppLangCode } from "../src/app-language/language-state";

import { act, fireEvent, render, waitFor } from "./test-utils";

/**
 * The language the browser reports (through `i18next-browser-languagedetector`,
 * which reads this key first) must be the one the app boots in — upstream
 * gates its render on `<InitializeApp langCode>` for exactly this.
 *
 * `vi.hoisted` runs before this module's imports, so the value is in place
 * before `language-state.ts` reads the detector at module scope.
 */
vi.hoisted(() => {
  window.localStorage.setItem("i18nextLng", "fr-FR");
});

const RTL_LANG_CODE = "ar-SA";

describe("startup language", () => {
  it("boots in the detected language", async () => {
    const { container } = await render();

    expect(document.documentElement.lang).toBe("fr-FR");
    expect(document.documentElement.dir).toBe("ltr");

    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    await waitFor(() => {
      const menu = container.querySelector(".dropdown-menu-container")!;
      expect(menu).not.toBeNull();
      // `buttons.load` / `labels.canvasBackground` in fr-FR.json
      expect(menu.textContent).toContain("Ouvrir");
      expect(menu.textContent).toContain("Arrière-plan du canevas");
      expect(menu.textContent).not.toContain("Canvas background");
    });

    // the select reports the loaded language, not just the detected one
    expect(
      document.querySelector<HTMLSelectElement>(".dropdown-select__language")!
        .value,
    ).toBe("fr-FR");

    // the app's own labels (outside the rebuilt editor subtree) too
    expect(
      container.querySelector(".welcome-screen-decor-hint--menu")?.textContent,
    ).toContain("Exportation, préférences, langues");
  });

  it("applies the writing direction of an RTL language", async () => {
    const { container } = await render();

    await act(() => setAppLangCode(RTL_LANG_CODE));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe(RTL_LANG_CODE);
      expect(document.documentElement.dir).toBe("rtl");
    });

    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    await waitFor(() => {
      const menu = container.querySelector(".dropdown-menu-container")!;
      // `labels.canvasBackground` in ar-SA.json
      expect(menu.textContent).toContain("خلفية اللوحة");
    });

    // `welcomeScreen.app.menuHint` in ar-SA.json
    expect(
      container.querySelector(".welcome-screen-decor-hint--menu")?.textContent,
    ).toContain("التصدير، التفضيلات، اللغات");
  });
});
