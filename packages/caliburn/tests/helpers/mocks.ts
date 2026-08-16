import * as MermaidToExcalidraw from "@excalidraw/mermaid-to-excalidraw";
import { vi } from "vitest";

import type { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import type { throttleRAF as throttleRAFType } from "@excalidraw/common";

type ThrottledFn<T extends unknown[]> = ((...args: T) => void) & {
  flush: () => void;
  cancel: () => void;
};

export const mockThrottleRAF: typeof throttleRAFType = <T extends unknown[]>(
  fn: (...args: T) => void,
) => {
  const ret = ((...args: T) => {
    fn(...args);
  }) as ThrottledFn<T>;

  ret.flush = () => {};
  ret.cancel = () => {};

  return ret;
};

/**
 * Port of upstream `tests/helpers/mocks.ts`'s `mockMermaidToExcalidraw`,
 * minus its `mockRef` branch — that one stubs `React.useRef` so
 * `TTDPreviewPanel` reads the spy back, which has no caliburn counterpart.
 */
export const mockMermaidToExcalidraw = (opts: {
  parseMermaidToExcalidraw: typeof parseMermaidToExcalidraw;
}) => {
  vi.mock("@excalidraw/mermaid-to-excalidraw", async (importActual) => {
    const module = (await importActual()) as any;

    return {
      __esModule: true,
      ...module,
    };
  });
  const parseMermaidToExcalidrawSpy = vi.spyOn(
    MermaidToExcalidraw,
    "parseMermaidToExcalidraw",
  );

  parseMermaidToExcalidrawSpy.mockImplementation(opts.parseMermaidToExcalidraw);

  return parseMermaidToExcalidrawSpy;
};

// Mock for HTMLImageElement (use with `vi.unstubAllGlobals()`)
// as jsdom.resources: "usable" throws an error on image load
export const mockHTMLImageElement = (
  naturalWidth: number,
  naturalHeight: number,
) => {
  vi.stubGlobal(
    "Image",
    class extends Image {
      constructor() {
        super();

        Object.defineProperty(this, "naturalWidth", {
          value: naturalWidth,
        });
        Object.defineProperty(this, "naturalHeight", {
          value: naturalHeight,
        });

        queueMicrotask(() => {
          this.onload?.({} as Event);
        });
      }
    },
  );
};

// Mocks for multiple HTMLImageElements (dimensions are assigned in the order of image initialization)
export const mockMultipleHTMLImageElements = (
  sizes: (readonly [number, number])[],
) => {
  const _sizes = [...sizes];

  vi.stubGlobal(
    "Image",
    class extends Image {
      constructor() {
        super();

        const size = _sizes.shift();
        if (!size) {
          throw new Error("Insufficient sizes");
        }

        Object.defineProperty(this, "naturalWidth", {
          value: size[0],
        });
        Object.defineProperty(this, "naturalHeight", {
          value: size[1],
        });

        queueMicrotask(() => {
          this.onload?.({} as Event);
        });
      }
    },
  );
};
