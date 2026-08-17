import React from "react";

import { MIME_TYPES, resolvablePromise } from "@excalidraw/common";
import { ShapeCache } from "@excalidraw/element";

import type { ExcalidrawImageElement, FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { render, unmountComponent } from "./test-utils";

import type { CaliburnImperativeAPI } from "../src/editor.component";

unmountComponent();

const FILE_ID = "file-under-test" as FileId;

const binaryFile = () => ({
  id: FILE_ID,
  dataURL: "data:image/png;base64,aGVsbG8=" as never,
  mimeType: MIME_TYPES.png,
  created: 1,
  lastRetrieved: 1,
});

describe("image shape cache eviction", () => {
  let api: CaliburnImperativeAPI;

  beforeEach(async () => {
    const apiPromise = resolvablePromise<CaliburnImperativeAPI>();
    await render(
      <Excalidraw onExcalidrawAPI={(a) => apiPromise.resolve(a as any)} />,
    );
    api = await apiPromise;
  });

  it("evicts the drawn image's caches when its file arrives", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fileId: FILE_ID,
      status: "saved",
    });
    API.setElements([image]);

    const drawn = h.elements[0] as ExcalidrawImageElement;
    // what the editor cached for the element while the file was missing
    const staleEntry = {
      image: new Image(),
      mimeType: MIME_TYPES.png,
    } as const;
    h.app.imageCache.set(FILE_ID, staleEntry);
    ShapeCache.generateElementShape(drawn, null);
    expect(ShapeCache.get(drawn, null)).not.toBe(undefined);

    api.addFiles([binaryFile()]);

    // the entry was evicted, so the file's own loading pass replaced it —
    // without the eviction the stale entry would have kept it out
    expect(h.app.imageCache.get(FILE_ID)).not.toBe(staleEntry);
    expect(ShapeCache.get(drawn, null)).toBe(undefined);
  });

  it("leaves the caches of images the batch does not cover alone", () => {
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fileId: FILE_ID,
      status: "saved",
    });
    API.setElements([image]);

    h.app.imageCache.set(FILE_ID, {
      image: new Image(),
      mimeType: MIME_TYPES.png,
    });

    api.addFiles([{ ...binaryFile(), id: "some-other-file" as FileId }]);

    expect(h.app.imageCache.has(FILE_ID)).toBe(true);
  });
});
