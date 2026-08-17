import React from "react";
import { vi } from "vitest";

import { POINTER_EVENTS } from "@excalidraw/common";

import type {
  ExcalidrawEmbeddableElement,
  ExcalidrawIframeElement,
  MagicGenerationData,
  NonDeleted,
} from "@excalidraw/element/types";

import { Excalidraw } from "../src/index";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { CaliburnEmbeddableHostComponent } from "./helpers/embeddable-host.component";
import { Keyboard, Pointer } from "./helpers/ui";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  renderHost,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

const { copyTextToSystemClipboardMock } = vi.hoisted(() => ({
  copyTextToSystemClipboardMock: vi.fn(),
}));

vi.mock("@excalidraw/excalidraw/clipboard", async (importOriginal) => {
  const module = await importOriginal<
    typeof import("@excalidraw/excalidraw/clipboard")
  >();
  return {
    ...module,
    copyTextToSystemClipboard: copyTextToSystemClipboardMock,
  };
});

const YOUTUBE_LINK = "https://www.youtube.com/watch?v=gkGMXY0wekg";
const VIMEO_LINK = "https://vimeo.com/1084537";

const containerNodes = () =>
  document.querySelectorAll<HTMLDivElement>(
    ".excalidraw__embeddable-container",
  );

const containerNode = () => containerNodes()[0] ?? null;

const iframeNodes = () =>
  document.querySelectorAll<HTMLIFrameElement>("iframe.excalidraw__embeddable");

const iframeNode = () => iframeNodes()[0] ?? null;

const innerNode = () =>
  document.querySelector<HTMLDivElement>(
    ".excalidraw__embeddable-container__inner",
  );

/**
 * The link has to be on the element before it first reaches the scene: the
 * editor validates an embeddable exactly once (upstream keeps the flag so the
 * verdict can only come from a trusted source), so an element that arrives
 * link-less is cached as invalid — which is why upstream's own link editor
 * writes the status itself when the user changes it.
 */
const addEmbeddable = (link: string, overrides?: { x: number; y: number }) => {
  const embeddable = {
    ...API.createElement({
      type: "embeddable",
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      ...overrides,
    }),
    link,
  } as unknown as NonDeleted<ExcalidrawEmbeddableElement>;
  API.setElements([embeddable]);
  return embeddable;
};

const addIframeElement = (generationData?: MagicGenerationData) => {
  const iframe = {
    ...API.createElement({
      type: "iframe",
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    }),
    customData: generationData ? { generationData } : undefined,
  } as unknown as NonDeleted<ExcalidrawIframeElement>;
  API.setElements([iframe]);
  return iframe;
};

describe("embeddable render layer", () => {
  beforeEach(async () => {
    copyTextToSystemClipboardMock.mockClear();
    mockBoundingClientRect({ width: 1920, height: 1080 });
    await render(<Excalidraw />);
    await waitFor(() => expect(h.state.width).toBe(1920));
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("mounts an iframe for an embeddable whose link the editor validated", async () => {
    const embeddable = addEmbeddable(YOUTUBE_LINK);

    await waitFor(() => expect(iframeNode()).not.toBe(null));

    expect(h.app.embedsValidationStatus.get(embeddable.id)).toBe(true);

    const container = containerNode()!;
    const iframe = iframeNode()!;

    expect(container.contains(iframe)).toBe(true);
    expect(container.style.display).toBe("block");
    // the element sits at (100, 100) with no scroll and zoom 1
    expect(container.style.transform).toBe("translate(100px, 100px) scale(1)");
    expect(container.style.getPropertyValue("--embeddable-radius")).not.toBe(
      "",
    );

    expect(iframe.getAttribute("src")).toBe(
      "https://www.youtube.com/embed/gkGMXY0wekg?enablejsapi=1",
    );
    expect(iframe.hasAttribute("srcdoc")).toBe(false);
    expect(iframe.getAttribute("scrolling")).toBe("no");
    expect(iframe.getAttribute("referrerpolicy")).toBe(
      "no-referrer-when-downgrade",
    );
    expect(iframe.getAttribute("title")).toBe("Excalidraw Embedded Content");
    expect(iframe.getAttribute("allow")).toBe(
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    );
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
    // youtube is on the vendored allow-same-origin list
    expect(iframe.getAttribute("sandbox")).toBe(
      "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads",
    );

    const inner = innerNode()!;
    expect(inner.style.width).toBe("400px");
    expect(inner.style.height).toBe("300px");
    expect(inner.style.transform).toBe("rotate(0rad)");
  });

  it("keeps a host off the allow-same-origin list out of that sandbox flag", async () => {
    addEmbeddable("https://gist.github.com/someone/0123456789abcdef");

    await waitFor(() => expect(iframeNode()).not.toBe(null));

    expect(iframeNode()!.getAttribute("sandbox")).toBe(
      " allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads",
    );
  });

  it("mounts nothing for an embeddable whose link fails validation", async () => {
    const embeddable = addEmbeddable("https://not-an-allowed-host.example.com");

    await waitFor(() =>
      expect(h.app.embedsValidationStatus.get(embeddable.id)).toBe(false),
    );

    expect(containerNodes()).toHaveLength(0);
    expect(iframeNodes()).toHaveLength(0);
  });

  it("waits for the embed to scroll into view, then keeps it mounted", async () => {
    addEmbeddable(YOUTUBE_LINK, { x: 6000, y: 6000 });

    await waitFor(() => expect(h.app.embedsValidationStatus.size).toBe(1));
    expect(containerNodes()).toHaveLength(0);

    act(() => {
      h.app.setState({ scrollX: -6000, scrollY: -6000 });
    });
    await waitFor(() => expect(iframeNode()).not.toBe(null));
    expect(containerNode()!.style.display).toBe("block");

    // scrolled back away: upstream keeps an initialized embed in the DOM and
    // only hides it, so the embedded document is not torn down and reloaded
    act(() => {
      h.app.setState({ scrollX: 0, scrollY: 0 });
    });
    await waitFor(() => expect(containerNode()!.style.display).toBe("none"));
    expect(iframeNode()).not.toBe(null);
    expect(containerNode()!.style.transform).toBe("none");
    expect(innerNode()!.style.width).toBe("0px");
  });

  it("gives pointer events to the active embed only, and hints on hover", async () => {
    const embeddable = addEmbeddable(YOUTUBE_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    expect(innerNode()!.style.pointerEvents).toBe(POINTER_EVENTS.disabled);
    expect(containerNode()!.classList.contains("is-hovered")).toBe(false);
    expect(document.querySelector(".excalidraw__embeddable-hint")).toBe(null);

    act(() => {
      h.app.setState({
        activeEmbeddable: {
          element: h.app.scene.getElement(embeddable.id)!,
          state: "hover",
        } as any,
      });
    });
    await waitFor(() =>
      expect(containerNode()!.classList.contains("is-hovered")).toBe(true),
    );
    expect(
      document.querySelector(".excalidraw__embeddable-hint")!.textContent,
    ).toBe("Click to interact");
    expect(innerNode()!.style.pointerEvents).toBe(POINTER_EVENTS.disabled);

    act(() => {
      h.app.setState({
        activeEmbeddable: {
          element: h.app.scene.getElement(embeddable.id)!,
          state: "active",
        } as any,
      });
    });
    await waitFor(() =>
      expect(innerNode()!.style.pointerEvents).toBe(POINTER_EVENTS.enabled),
    );
    expect(containerNode()!.classList.contains("is-hovered")).toBe(false);
  });

  it("caches the mounted iframe and drops the ref once the element is gone", async () => {
    const embeddable = addEmbeddable(YOUTUBE_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    expect(h.app.iFrameRefs.get(embeddable.id)).toBe(iframeNode());

    API.setElements([]);
    await waitFor(() =>
      expect(h.app.iFrameRefs.has(embeddable.id)).toBe(false),
    );
    expect(containerNodes()).toHaveLength(0);
  });

  it("drives the vimeo play/pause handshake from a center click", async () => {
    const embeddable = addEmbeddable(VIMEO_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    const iframe = iframeNode()!;
    expect(iframe.getAttribute("src")).toBe(
      "https://player.vimeo.com/video/1084537?api=1",
    );
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    const pointer = new Pointer("mouse");
    pointer.clickAt(
      embeddable.x + embeddable.width / 2,
      embeddable.y + embeddable.height / 2,
    );

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ method: "paused" }),
      "*",
    );
  });

  it("starts the youtube player protocol from a center click", async () => {
    const embeddable = addEmbeddable(YOUTUBE_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    const iframe = iframeNode()!;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    const pointer = new Pointer("mouse");
    pointer.clickAt(
      embeddable.x + embeddable.width / 2,
      embeddable.y + embeddable.height / 2,
    );

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: "listening", id: embeddable.id }),
      "*",
    );
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: "command", func: "playVideo", args: "" }),
      "*",
    );
  });

  it("answers vimeo's paused report on the window message channel", async () => {
    addEmbeddable(VIMEO_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    const iframe = iframeNode()!;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");

    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://player.vimeo.com",
        data: JSON.stringify({ method: "paused", value: true }),
        source: iframe.contentWindow,
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ method: "play", value: true }),
      "*",
    );

    postMessage.mockClear();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://player.vimeo.com",
        data: JSON.stringify({ method: "paused", value: false }),
        source: iframe.contentWindow,
      }),
    );
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ method: "pause", value: true }),
      "*",
    );

    // a message from another origin is not the player's
    postMessage.mockClear();
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://example.com",
        data: JSON.stringify({ method: "paused", value: true }),
        source: iframe.contentWindow,
      }),
    );
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("leaving browser fullscreen deactivates the embed", async () => {
    const embeddable = addEmbeddable(YOUTUBE_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    act(() => {
      h.app.setState({
        activeEmbeddable: {
          element: h.app.scene.getElement(embeddable.id)!,
          state: "active",
        } as any,
      });
    });

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    expect(h.state.activeEmbeddable).toBe(null);
  });

  describe("iframe elements", () => {
    it("renders a finished generation's document", async () => {
      addIframeElement({ status: "done", html: "<h1>generated</h1>" });

      await waitFor(() => expect(iframeNode()).not.toBe(null));

      const iframe = iframeNode()!;
      expect(iframe.getAttribute("srcdoc")).toBe("<h1>generated</h1>");
      expect(iframe.hasAttribute("src")).toBe(false);
      // an iframe element renders regardless of embed validation
      expect(h.app.embedsValidationStatus.size).toBe(0);
    });

    it("renders the pending placeholder while a generation runs", async () => {
      addIframeElement({ status: "pending" });

      await waitFor(() => expect(iframeNode()).not.toBe(null));

      expect(iframeNode()!.getAttribute("srcdoc")).toContain("Generating...");
    });

    it("renders the failure page, including a missing generation", async () => {
      addIframeElement({
        status: "error",
        code: "ERR_GENERATION_INTERRUPTED",
        message: "ignored",
      });
      await waitFor(() => expect(iframeNode()).not.toBe(null));
      expect(iframeNode()!.getAttribute("srcdoc")).toContain(
        "Generation was interrupted...",
      );

      addIframeElement();
      await waitFor(() =>
        expect(iframeNode()!.getAttribute("srcdoc")).toContain(
          "No generation data",
        ),
      );
    });

    it("copies the generated source from the element's canvas button", async () => {
      const iframeElement = addIframeElement({
        status: "done",
        html: "<h1>generated</h1>",
      });
      await waitFor(() => expect(iframeNode()).not.toBe(null));

      expect(document.querySelector(".excalidraw-canvas-buttons")).toBe(null);

      API.setSelectedElements([API.getElement(iframeElement)]);
      const copyButton = await waitFor(() => {
        const node = document.querySelector<HTMLButtonElement>(
          ".excalidraw-canvas-buttons button",
        );
        expect(node).not.toBe(null);
        return node!;
      });
      expect(copyButton.getAttribute("aria-label")).toBe(
        "Copy source to clipboard",
      );
      expect(copyButton.classList.contains("ToolIcon__MagicButton")).toBe(true);
      expect(
        document.querySelectorAll(".excalidraw-canvas-buttons button"),
      ).toHaveLength(2);

      fireEvent.click(copyButton);
      expect(copyTextToSystemClipboardMock).toHaveBeenCalledWith(
        "<h1>generated</h1>",
      );
      expect(h.state.toast?.message).toBe("copied to clipboard");
    });

    it("hides the canvas buttons in view mode", async () => {
      const iframeElement = addIframeElement({
        status: "done",
        html: "<h1>generated</h1>",
      });
      await waitFor(() => expect(iframeNode()).not.toBe(null));
      API.setSelectedElements([API.getElement(iframeElement)]);
      await waitFor(() =>
        expect(document.querySelector(".excalidraw-canvas-buttons")).not.toBe(
          null,
        ),
      );

      act(() => {
        h.app.setState({ viewModeEnabled: true });
      });
      await waitFor(() =>
        expect(document.querySelector(".excalidraw-canvas-buttons")).toBe(null),
      );
    });
  });

  it("keeps the embeddable overlay out of the way of the Escape deactivation", async () => {
    const embeddable = addEmbeddable(YOUTUBE_LINK);
    await waitFor(() => expect(iframeNode()).not.toBe(null));

    act(() => {
      h.app.setState({
        activeEmbeddable: {
          element: h.app.scene.getElement(embeddable.id)!,
          state: "active",
        } as any,
      });
    });
    await waitFor(() =>
      expect(innerNode()!.style.pointerEvents).toBe(POINTER_EVENTS.enabled),
    );

    Keyboard.keyPress("Escape");
    await waitFor(() => expect(h.state.activeEmbeddable).toBe(null));
    expect(innerNode()!.style.pointerEvents).toBe(POINTER_EVENTS.disabled);
  });

  it("mounts the iframe on the same interaction that validates the link", async () => {
    const embeddable = {
      ...API.createElement({
        type: "embeddable",
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      }),
    } as unknown as NonDeleted<ExcalidrawEmbeddableElement>;
    API.setElements([embeddable]);
    await waitFor(() =>
      expect(h.app.embedsValidationStatus.get(embeddable.id)).toBe(false),
    );

    API.setSelectedElements([API.getElement(embeddable)]);
    act(() => {
      h.app.setState({ showHyperlinkPopup: "editor" });
    });
    const input = await waitFor(() => {
      const node = document.querySelector<HTMLInputElement>(
        ".excalidraw-hyperlinkContainer-input",
      );
      expect(node).not.toBe(null);
      return node!;
    });

    // caliburn's scene listener commits and renders synchronously inside
    // `mutateElement`, so the verdict has to be in place before it — that
    // render is the one that mounts the iframe
    const statusAtMutate: (boolean | undefined)[] = [];
    const mutateElement = h.app.scene.mutateElement.bind(h.app.scene);
    const spy = vi.spyOn(h.app.scene, "mutateElement").mockImplementation(((
      ...args: Parameters<typeof mutateElement>
    ) => {
      statusAtMutate.push(h.app.embedsValidationStatus.get(embeddable.id));
      return mutateElement(...args);
    }) as typeof mutateElement);

    try {
      fireEvent.input(input, { target: { value: YOUTUBE_LINK } });
      fireEvent.keyDown(input, { key: "Enter" });
    } finally {
      spy.mockRestore();
    }

    expect(statusAtMutate).toEqual([true]);
    await waitFor(() => expect(iframeNode()).not.toBe(null));
    expect(iframeNode()!.getAttribute("src")).toBe(
      "https://www.youtube.com/embed/gkGMXY0wekg?enablejsapi=1",
    );
  });
});

describe("host-rendered embeds (renderEmbeddable)", () => {
  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("renders the host's template per element and falls back to the iframe for the rest", async () => {
    const hostRendered = {
      ...API.createElement({
        type: "embeddable",
        x: 100,
        y: 100,
        width: 400,
        height: 300,
      }),
      link: YOUTUBE_LINK,
    } as unknown as NonDeleted<ExcalidrawEmbeddableElement>;
    const defaultRendered = {
      ...API.createElement({
        type: "embeddable",
        x: 700,
        y: 100,
        width: 400,
        height: 300,
      }),
      link: VIMEO_LINK,
    } as unknown as NonDeleted<ExcalidrawEmbeddableElement>;

    mockBoundingClientRect({ width: 1920, height: 1080 });
    await renderHost(CaliburnEmbeddableHostComponent, {
      hostRenderedIds: [hostRendered.id],
    });
    await waitFor(() => expect(h.state.width).toBe(1920));

    API.setElements([hostRendered, defaultRendered]);
    await waitFor(() => expect(containerNodes()).toHaveLength(2));

    const hostContent = await waitFor(() => {
      const node = document.querySelector<HTMLDivElement>(".host-embed");
      expect(node).not.toBe(null);
      return node!;
    });
    expect(hostContent.getAttribute("data-element-id")).toBe(hostRendered.id);
    // the template gets upstream's `(element, appState)` arguments
    expect(hostContent.textContent).toContain(YOUTUBE_LINK);
    expect(hostContent.textContent).toContain("at zoom 1");

    // the host's embed replaced the default iframe for that element only
    expect(hostContent.closest(".excalidraw__embeddable-container")).not.toBe(
      null,
    );
    expect(
      hostContent
        .closest(".excalidraw__embeddable-container")!
        .querySelector("iframe"),
    ).toBe(null);

    expect(iframeNodes()).toHaveLength(1);
    expect(iframeNode()!.getAttribute("src")).toBe(
      "https://player.vimeo.com/video/1084537?api=1",
    );

    // upstream's ref only ever sits on the default iframe
    expect(h.app.iFrameRefs.has(hostRendered.id)).toBe(false);
    expect(h.app.iFrameRefs.get(defaultRendered.id)).toBe(iframeNode());
  });
});
