import React from "react";

import { defaultLang, languages } from "@excalidraw/excalidraw/i18n";

import { Excalidraw, setEditorLanguage } from "../src/index";

import { API } from "./helpers/api";
import {
  GlobalTestState,
  act,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

const { h } = window;

unmountComponent();

const findLanguage = (code: string) => {
  const language = languages.find((lang) => lang.code === code);
  if (!language) {
    throw new Error(`missing test language ${code}`);
  }
  return language;
};

const FRENCH = findLanguage("fr-FR");
const ARABIC = findLanguage("ar-SA");

const queryContainer = (selector: string) =>
  GlobalTestState.renderResult.container.querySelector(selector);

const scrollAwayFromContent = async () => {
  act(() => {
    h.app.setState({ scrollX: -10_000, scrollY: -10_000 });
  });
  await waitFor(() => expect(h.state.scrolledOutside).toBe(true));
};

/**
 * Upstream re-renders the whole editor when `setLanguage` writes its lang-code
 * atom, so every `t()` call in a render body picks the new locale up. The
 * editor package tracks the same edge through `setEditorLanguage` — these
 * cases pin that the chrome relabels itself in place, with no remount.
 */
describe("language change", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(
      <Excalidraw
        initialData={{
          elements: [API.createElement({ type: "rectangle", x: 10, y: 10 })],
        }}
      />,
    );
  });

  afterEach(async () => {
    restoreOriginalGetBoundingClientRect();
    await act(() => setEditorLanguage(defaultLang));
  });

  it("relabels the chrome without remounting the editor", async () => {
    await scrollAwayFromContent();

    const scrollBackButton = queryContainer(".scroll-back-to-content")!;
    expect(scrollBackButton.textContent!.trim()).toBe("Scroll back to content");

    const canvas = queryContainer("canvas.interactive");
    const app = h.app;
    const [element] = h.elements;

    await act(() => setEditorLanguage(FRENCH));

    await waitFor(() =>
      expect(queryContainer(".scroll-back-to-content")!.textContent!.trim()) //
        .toBe("Revenir au contenu"),
    );

    // the very same nodes and instances, i.e. nothing was rebuilt underneath
    expect(queryContainer(".scroll-back-to-content")).toBe(scrollBackButton);
    expect(queryContainer("canvas.interactive")).toBe(canvas);
    expect(h.app).toBe(app);
    expect(h.elements[0]).toBe(element);
  });

  it("relabels the properties panel, which resolves whole label maps", async () => {
    act(() => {
      h.app.setState({ selectedElementIds: { [h.elements[0].id]: true } });
    });

    const strokeLabel = () =>
      queryContainer(".selected-shape-actions h3")?.textContent?.trim();

    await waitFor(() => expect(strokeLabel()).toBe("Stroke"));

    await act(() => setEditorLanguage(FRENCH));

    await waitFor(() => expect(strokeLabel()).toBe("Trait"));
  });

  it("applies the writing direction of an RTL language", async () => {
    expect(document.documentElement.dir).toBe("ltr");

    await act(() => setEditorLanguage(ARABIC));

    await waitFor(() => {
      expect(document.documentElement.dir).toBe("rtl");
      expect(document.documentElement.lang).toBe("ar-SA");
    });

    await act(() => setEditorLanguage(defaultLang));

    await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
  });
});
