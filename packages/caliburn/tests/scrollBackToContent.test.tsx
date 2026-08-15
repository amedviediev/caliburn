import React from "react";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import {
  GlobalTestState,
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  unmountComponent,
  waitFor,
} from "./test-utils";

const { h } = window;

unmountComponent();

const queryContainer = (selector: string) =>
  GlobalTestState.renderResult.container.querySelector(selector);

const rectangle = () =>
  API.createElement({
    type: "rectangle",
    x: 10,
    y: 10,
    width: 50,
    height: 50,
  });

const scrollAwayFromContent = async () => {
  act(() => {
    h.app.setState({ scrollX: -10_000, scrollY: -10_000 });
  });
  await waitFor(() => expect(h.state.scrolledOutside).toBe(true));
};

// Upstream covers this control in `tests/interactivity.test.tsx`, whose cases
// all drive it through the `ui={{ enabled: { scrollBackToContent } }}` prop —
// caliburn has no `ui` prop, so the behaviour is covered here instead.
describe("scroll back to content", () => {
  beforeEach(async () => {
    mockBoundingClientRect();
    await render(<Excalidraw initialData={{ elements: [rectangle()] }} />);
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("stays hidden while the content is in view", () => {
    expect(h.state.scrolledOutside).toBe(false);
    expect(queryContainer(".scroll-back-to-content")).toBe(null);
  });

  it("appears once the content scrolls out of view, and scrolls it back", async () => {
    await scrollAwayFromContent();

    const scrollBackButton = queryContainer(".scroll-back-to-content");
    expect(scrollBackButton).not.toBe(null);

    fireEvent.click(scrollBackButton!);

    await waitFor(() => expect(h.state.scrolledOutside).toBe(false));
    expect(queryContainer(".scroll-back-to-content")).toBe(null);
    expect(h.state.scrollX).not.toBe(-10_000);
    expect(h.state.scrollY).not.toBe(-10_000);
  });

  it("stays hidden while a text element is being edited", async () => {
    await scrollAwayFromContent();

    act(() => {
      h.app.setState({
        editingTextElement: API.createElement({ type: "text", x: 0, y: 0 }),
      });
    });

    expect(h.state.scrolledOutside).toBe(false);
    expect(queryContainer(".scroll-back-to-content")).toBe(null);
  });

  it("yields the status stack to a toast", async () => {
    await scrollAwayFromContent();
    expect(queryContainer(".scroll-back-to-content")).not.toBe(null);

    act(() => {
      h.app.setToast({ message: "hello" });
    });

    expect(queryContainer(".Toast")).not.toBe(null);
    expect(queryContainer(".scroll-back-to-content")).toBe(null);
  });
});
