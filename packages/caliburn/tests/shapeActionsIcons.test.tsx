import React from "react";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { act, GlobalTestState, render, unmountComponent } from "./test-utils";

unmountComponent();

// Caliburn-authored: pins the exact inner DOM upstream's `IconButton`
// (`components/IconButton.tsx`) renders for a `type="button"` icon button —
// a `div.ToolIcon__icon[aria-hidden="true"]` wrapper around the icon — for
// the shape-actions panel's "Actions" row (duplicateSelection,
// deleteSelectedElements, group, ungroup; all four use `IconButton` in
// `actionDuplicateSelection.tsx`/`actionDeleteSelected.tsx`/
// `actionGroup.tsx`). The "Layers" row (sendToBack/sendBackward/
// bringForward/bringToFront, `actionZindex.tsx`) is asserted *not* to carry
// that wrapper — those four PanelComponents render a plain
// `<button className="zIndexButton">{icon}</button>` with the icon as a
// direct child, no wrapper at all, so replicating the Actions row's wrapper
// there would itself be a DOM-fidelity bug.
describe("shape-actions panel icon wrapper", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  const selectRect = () => {
    const rect = API.createElement({ type: "rectangle" });
    act(() => {
      API.setElements([rect]);
      API.setSelectedElements([rect]);
    });
    return rect;
  };

  it("wraps the Actions row's icon in upstream's ToolIcon__icon div", () => {
    selectRect();

    const duplicateButton =
      GlobalTestState.renderResult.container.querySelector(
        'button[aria-label="Duplicate"]',
      );
    expect(duplicateButton).not.toBe(null);

    const wrapper = duplicateButton!.querySelector(":scope > div");
    expect(wrapper).not.toBe(null);
    expect(wrapper).toHaveClass("ToolIcon__icon");
    expect(wrapper).toHaveAttribute("aria-hidden", "true");

    const icon = wrapper!.querySelector("ng-icon");
    expect(icon).not.toBe(null);
    expect(duplicateButton!.querySelector(":scope > ng-icon")).toBe(null);
  });

  it("does not wrap the Layers row's icon (upstream renders it unwrapped)", () => {
    selectRect();

    const bringToFrontButton =
      GlobalTestState.renderResult.container.querySelector(
        'button[aria-label="Bring to front"]',
      );
    expect(bringToFrontButton).not.toBe(null);

    expect(bringToFrontButton!.querySelector("div.ToolIcon__icon")).toBe(null);
    expect(bringToFrontButton!.querySelector(":scope > ng-icon")).not.toBe(
      null,
    );
  });
});
