import { editorJotaiStore } from "@excalidraw/excalidraw/editor-jotai";

import { libraryItemSvgsCache } from "../src/vendor/library-item-svg-cache";
import { bucketFillIconSvgPaths } from "../src/vendor/icon-svg-paths";
import { isRenderThrottlingEnabled } from "../src/vendor/react-utils";

describe("framework-neutral Excalidraw seams", () => {
  afterEach(() => {
    window.EXCALIDRAW_THROTTLE_RENDER = undefined;
  });

  it("provides the library SVG cache as a plain Jotai atom", () => {
    const cache = editorJotaiStore.get(libraryItemSvgsCache);

    expect(cache).toBeInstanceOf(Map);
    expect(cache.size).toBe(0);
  });

  it("reads animation throttling from the Excalidraw window flag", () => {
    expect(isRenderThrottlingEnabled()).toBe(false);

    window.EXCALIDRAW_THROTTLE_RENDER = true;
    expect(isRenderThrottlingEnabled()).toBe(true);
  });

  it("owns the bucket-fill cursor paths without the React icon module", () => {
    expect(bucketFillIconSvgPaths).toHaveLength(3);
    expect(bucketFillIconSvgPaths[0]).toBe(
      "M5 16l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737z",
    );
  });
});
