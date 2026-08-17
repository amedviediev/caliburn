import { KEYS } from "@excalidraw/common";

import * as StaticScene from "@excalidraw/excalidraw/renderer/staticScene";
import * as NewElementScene from "@excalidraw/excalidraw/renderer/renderNewElementScene";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { act, render } from "./test-utils";

const renderStaticScene = vi.spyOn(StaticScene, "renderStaticScene");
const renderNewElementScene = vi.spyOn(
  NewElementScene,
  "renderNewElementScene",
);

/** the pending flowchart nodes the last static render was handed */
const renderedPendingNodes = () =>
  renderStaticScene.mock.calls.at(-1)![0].renderConfig.pendingFlowchartNodes;

/**
 * The pending cluster is a plain field on the flowchart collaborator, not app
 * state, so nothing about pressing ctrl+arrow schedules a render on its own —
 * upstream leans on React re-rendering `<StaticCanvas>` for its own reasons.
 * The assertions below are about what a render pass *carries*, so they force
 * one the way the canvas's next paint would.
 */
const renderPass = () => {
  act(() => {
    h.app.scene.triggerUpdate();
  });
};

describe("flowchart pending nodes reach the static render config", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);

    const rectangle = API.createElement({
      type: "rectangle",
      width: 200,
      height: 100,
    });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
  });

  it("hands the previewed cluster to the static scene mid-creation", () => {
    expect(renderedPendingNodes()).toBe(null);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    renderPass();

    expect(
      renderedPendingNodes()
        ?.filter((element) => element.type === "rectangle")
        .map((element) => ({ x: element.x, y: element.y })),
    ).toEqual([
      { x: 300, y: 0 },
      { x: 300, y: 200 },
    ]);

    // the new-element canvas never previews them (upstream passes it `null`)
    expect(
      renderNewElementScene.mock.calls.at(-1)?.[0].renderConfig
        .pendingFlowchartNodes ?? null,
    ).toBe(null);
  });

  it("stops handing them over once the cluster is committed", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });
    Keyboard.keyUp(KEYS.CTRL_OR_CMD);

    renderPass();

    expect(renderedPendingNodes()).toBe(null);
  });

  it("stops handing them over once the preview is escaped", () => {
    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyPress(KEYS.ARROW_RIGHT);
    });

    renderPass();
    expect(renderedPendingNodes()).toHaveLength(2);

    Keyboard.keyPress(KEYS.ESCAPE);

    expect(renderedPendingNodes()).toBe(null);
  });
});
