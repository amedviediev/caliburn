import { defaultLang, languages } from "@excalidraw/excalidraw/i18n";

import { UI } from "../../packages/caliburn/tests/helpers/ui";

import { act, fireEvent, render, screen, waitFor } from "./test-utils";

/**
 * Port of upstream `excalidraw-app/tests/LanguageList.test.tsx`. Upstream
 * builds a small host around `<Excalidraw langCode>` + a `<MainMenu>` holding
 * the list; the app's own menu already holds it, so the test drives the real
 * app instead.
 */
const TEST_LANG_CODE = "fr-FR";

describe("Test LanguageList", () => {
  it("rerenders UI on language change", async () => {
    expect(languages.some((lang) => lang.code === TEST_LANG_CODE)).toBe(true);

    await render();

    // select rectangle tool to show properties menu
    UI.clickTool("rectangle");
    // english lang should display `thin` label
    expect(screen.queryByTitle(/thin/i)).not.toBeNull();
    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    await act(() =>
      fireEvent.change(document.querySelector(".dropdown-select__language")!, {
        target: { value: TEST_LANG_CODE },
      }),
    );
    // switching to French, `thin` label should no longer exist
    await waitFor(() => expect(screen.queryByTitle(/thin/i)).toBeNull());
    // reset language
    await act(() =>
      fireEvent.change(document.querySelector(".dropdown-select__language")!, {
        target: { value: defaultLang.code },
      }),
    );
    // switching back to English
    await waitFor(() => expect(screen.queryByTitle(/thin/i)).not.toBeNull());
  });
});
