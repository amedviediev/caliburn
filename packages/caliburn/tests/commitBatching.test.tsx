import React from "react";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { render } from "./test-utils";

import type { ChangeDetectorRef } from "@angular/core";

/** the editor's own `ChangeDetectorRef` — the one every view refresh in
 * `editor.component.ts` goes through */
const changeDetector = () =>
  (h.app as unknown as { cdr: ChangeDetectorRef }).cdr;

describe("batchCommits renders once", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("for a batch that writes the scene and then the state", () => {
    const refresh = vi.spyOn(changeDetector(), "detectChanges");

    h.app.batchCommits(() => {
      h.app.scene.replaceAllElements([
        API.createElement({ type: "rectangle" }),
      ]);
      h.app.setState({ viewBackgroundColor: "#ffeeaa" });
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    refresh.mockRestore();
  });

  it("for a batch that writes the state twice", () => {
    const refresh = vi.spyOn(changeDetector(), "detectChanges");

    h.app.batchCommits(() => {
      h.app.setState({ suggestedBinding: null });
      h.app.setState({ viewBackgroundColor: "#ffeeaa" });
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("but not outside one, where every write renders as it lands", () => {
    const refresh = vi.spyOn(changeDetector(), "detectChanges");

    h.app.scene.replaceAllElements([API.createElement({ type: "rectangle" })]);
    h.app.setState({ viewBackgroundColor: "#ffeeaa" });

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("flushCommits forces the deferred render mid-batch", () => {
    const refresh = vi.spyOn(changeDetector(), "detectChanges");

    h.app.batchCommits(() => {
      h.app.setState({ viewBackgroundColor: "#ffeeaa" });
      h.app.flushCommits();
      h.app.setState({ viewBackgroundColor: "#aaeeff" });
    });

    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
