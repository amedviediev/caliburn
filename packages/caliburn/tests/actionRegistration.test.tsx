import React from "react";

import { CODES } from "@excalidraw/common";

import type { Action } from "@excalidraw/excalidraw/actions/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { Keyboard } from "./helpers/ui";
import { act, render } from "./test-utils";

// every ported action module, evaluated — reaching for the module-level
// `actions` registry instead would miss exactly the failure mode this guards
// (an action module nothing imports never runs its `register()` call)
const actionModules = import.meta.glob<Record<string, unknown>>(
  "../src/actions/*.ts",
  { eager: true },
);

const isAction = (value: unknown): value is Action =>
  !!value &&
  typeof value === "object" &&
  typeof (value as Action).name === "string" &&
  typeof (value as Action).perform === "function";

const actionsWithShortcut = Object.values(actionModules)
  .flatMap((module) => Object.values(module))
  .filter(isAction)
  .filter((action) => action.keyTest);

describe("action registration", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  it("registers every ported action that carries a keyTest", () => {
    expect(actionsWithShortcut.length).toBeGreaterThan(0);

    const unregistered = actionsWithShortcut
      .filter((action) => h.app.actionManager.actions[action.name] !== action)
      .map((action) => action.name);

    expect(unregistered).toEqual([]);
  });

  it("toggles view mode with Alt+R", () => {
    expect(h.state.viewModeEnabled).toBe(false);

    act(() => {
      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codePress(CODES.R);
      });
    });
    expect(h.state.viewModeEnabled).toBe(true);

    act(() => {
      Keyboard.withModifierKeys({ alt: true }, () => {
        Keyboard.codePress(CODES.R);
      });
    });
    expect(h.state.viewModeEnabled).toBe(false);
  });
});
