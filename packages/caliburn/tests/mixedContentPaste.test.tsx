import React from "react";
import { vi } from "vitest";

import { KEYS, randomId, reseed } from "@excalidraw/common";

import { createPasteEvent } from "@excalidraw/excalidraw/clipboard";
import * as blobModule from "@excalidraw/excalidraw/data/blob";
import { t } from "@excalidraw/excalidraw/i18n";

import type { FileId } from "@excalidraw/element/types";

import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { INITIALIZED_IMAGE_PROPS } from "./helpers/constants";
import { mockMultipleHTMLImageElements } from "./helpers/mocks";
import { Keyboard } from "./helpers/ui";
import { GlobalTestState, render, waitFor } from "./test-utils";
import { DEER_IMAGE_DIMENSIONS } from "./fixtures/constants";

vi.mock("@excalidraw/common", async (importOriginal) => {
  const module = await importOriginal<typeof import("@excalidraw/common")>();

  return {
    __esmodule: true,
    ...module,
    isDarwin: false,
    KEYS: {
      ...module.KEYS,
      CTRL_OR_CMD: "ctrlKey",
    },
  };
});

const IMAGE_URL = "https://example.com/image.png";

const HTML_WITH_IMAGE = `<a href="https://example.com">hello </a><div><img src="${IMAGE_URL}" /></div><b>my friend!</b>`;

const setup = async (props?: ExcalidrawProps) => {
  await render(
    <Excalidraw autoFocus={true} handleKeyboardGlobally={true} {...props} />,
  );
  h.state.height = 1000;
  mockMultipleHTMLImageElements([
    [DEER_IMAGE_DIMENSIONS.width, DEER_IMAGE_DIMENSIONS.height],
  ]);
  Object.assign(document, {
    elementFromPoint: () => GlobalTestState.canvas,
  });
};

const pasteHTML = (html: string, text?: string) => {
  document.dispatchEvent(
    createPasteEvent({
      types:
        text === undefined
          ? { "text/html": html }
          : { "text/html": html, "text/plain": text },
    }),
  );
};

const plainPasteHTML = (html: string, text: string) => {
  Keyboard.withModifierKeys({ ctrl: true, shift: true }, () => {
    Keyboard.keyPress(KEYS.V);
    pasteHTML(html, text);
  });
};

const failingImageURLToFile = (cause: "FETCH_ERROR" | "UNSUPPORTED") =>
  vi
    .spyOn(blobModule, "ImageURLToFile")
    .mockImplementation(() => Promise.reject(new Error("nope", { cause })));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();

  reseed(7);

  vi.spyOn(blobModule, "generateIdFromFile").mockImplementation(() =>
    Promise.resolve(randomId() as FileId),
  );
  vi.spyOn(blobModule, "resizeImageFile").mockImplementation((file: File) =>
    Promise.resolve(file),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pasting mixed content", () => {
  it("fetches the image urls and inserts them as images", async () => {
    await setup();

    const imageURLToFileSpy = vi
      .spyOn(blobModule, "ImageURLToFile")
      .mockImplementation(() => API.loadFile("./fixtures/deer.png"));

    pasteHTML(HTML_WITH_IMAGE);

    await waitFor(() => {
      expect(h.elements).toEqual([
        expect.objectContaining({
          ...INITIALIZED_IMAGE_PROPS,
          ...DEER_IMAGE_DIMENSIONS,
        }),
      ]);
    });
    expect(imageURLToFileSpy).toHaveBeenCalledWith(IMAGE_URL);
  });

  it("surfaces a failed fetch as an error message", async () => {
    await setup();
    failingImageURLToFile("FETCH_ERROR");

    pasteHTML(HTML_WITH_IMAGE);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(t("errors.failedToFetchImage"));
    });
    expect(h.elements.filter((element) => !element.isDeleted)).toHaveLength(0);
  });

  it("surfaces an unsupported file type as an error message", async () => {
    await setup();
    failingImageURLToFile("UNSUPPORTED");

    pasteHTML(HTML_WITH_IMAGE);

    await waitFor(() => {
      expect(h.state.errorMessage).toBe(t("errors.unsupportedFileType"));
    });
  });

  it("pastes the text nodes joined by a blank line when the image tool is off", async () => {
    await setup({ UIOptions: { tools: { image: false } } });

    const imageURLToFileSpy = vi.spyOn(blobModule, "ImageURLToFile");

    pasteHTML(HTML_WITH_IMAGE);

    await waitFor(() => {
      expect(h.elements).toHaveLength(2);
    });
    expect(
      h.elements.map((element) => (element as { text?: string }).text),
    ).toEqual(["hello", "my friend!"]);
    expect(imageURLToFileSpy).not.toHaveBeenCalled();
  });

  it("falls through to the text branch on a plain paste", async () => {
    await setup();

    const imageURLToFileSpy = vi.spyOn(blobModule, "ImageURLToFile");

    plainPasteHTML(HTML_WITH_IMAGE, "hello my friend!");

    await waitFor(() => {
      expect(h.elements).toHaveLength(1);
    });
    expect((h.elements[0] as { text?: string }).text).toBe("hello my friend!");
    expect(imageURLToFileSpy).not.toHaveBeenCalled();
  });
});
