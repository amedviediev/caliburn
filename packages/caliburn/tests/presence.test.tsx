import React from "react";

import { vi } from "vitest";

import { UserIdleState, toBrandedType } from "@excalidraw/common";

import type {
  Collaborator,
  OnUserFollowedPayload,
  SocketId,
} from "@excalidraw/excalidraw/types";

import { Excalidraw } from "../src/index";
import { getInteractiveRendererParams } from "../src/render";
import { h } from "../src/test-hook";

import { API } from "./helpers/api";
import { CaliburnCollabHostComponent } from "./helpers/collab-host.component";
import { Pointer } from "./helpers/ui";
import {
  GlobalTestState,
  act,
  fireEvent,
  getByText,
  mockBoundingClientRect,
  render,
  renderHost,
  restoreOriginalGetBoundingClientRect,
  waitFor,
} from "./test-utils";

import type { ComponentRef } from "@angular/core";

/**
 * Presence UX: the remote-collaborator half of the interactive canvas'
 * render config (upstream `InteractiveCanvas.tsx`), the `UserList` and its
 * dropdown, follow mode's intents + viewport status frame, and the outbound
 * `onPointerUpdate` broadcast.
 *
 * Upstream's own `UserList.test.tsx` case ("retains the local dropdown when
 * the same account has multiple clients") is ported below; its body loses
 * only the JSX, since `currentUserControls` arrives as a template slot.
 */
const socketId = (id: string) => toBrandedType<SocketId>(id);

const collaborator = (
  id: string,
  overrides: Partial<Collaborator> = {},
): [SocketId, Collaborator] => [
  socketId(id),
  {
    id,
    socketId: socketId(id),
    username: id,
    isCurrentUser: false,
    ...overrides,
  },
];

const setCollaborators = (entries: [SocketId, Collaborator][]) => {
  act(() => {
    h.app.updateScene({ collaborators: new Map(entries) });
  });
};

const dropdownRows = () =>
  document.querySelectorAll<HTMLElement>(
    ".UserList__collaborators .UserList__collaborator",
  );

describe("remote collaborator rendering", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("plumbs remote pointers, usernames and idle states into the render config", async () => {
    setCollaborators([
      collaborator("ada", {
        username: "Ada",
        pointer: { x: 100, y: 200, tool: "pointer" },
        button: "down",
        userState: UserIdleState.ACTIVE,
      }),
      collaborator("bob", {
        username: "Bob",
        pointer: { x: 10, y: 20, tool: "laser" },
        button: "up",
        userState: UserIdleState.IDLE,
      }),
    ]);

    await waitFor(() => {
      const { renderConfig } = getInteractiveRendererParams(h.app)!;

      expect([...renderConfig.remotePointerUsernames]).toEqual([
        [socketId("ada"), "Ada"],
        [socketId("bob"), "Bob"],
      ]);
      expect([...renderConfig.remotePointerUserStates]).toEqual([
        [socketId("ada"), UserIdleState.ACTIVE],
        [socketId("bob"), UserIdleState.IDLE],
      ]);
      expect([...renderConfig.remotePointerButton]).toEqual([
        [socketId("ada"), "down"],
        [socketId("bob"), "up"],
      ]);
      // scene → viewport coords, at the default zoom/scroll/offset
      expect(
        renderConfig.remotePointerViewportCoords.get(socketId("ada")),
      ).toEqual({ x: 100, y: 200 });
    });
  });

  it("maps remote selections onto the elements they cover", async () => {
    const rect = API.createElement({ type: "rectangle", id: "A" });
    API.updateScene({ elements: [rect] });

    setCollaborators([
      collaborator("ada", { selectedElementIds: { A: true } }),
      collaborator("bob", { selectedElementIds: { A: true } }),
    ]);

    await waitFor(() => {
      const { remoteSelectedElementIds } = getInteractiveRendererParams(
        h.app,
      )!.renderConfig;
      expect(remoteSelectedElementIds.get("A")).toEqual([
        socketId("ada"),
        socketId("bob"),
      ]);
    });
  });

  it("skips cursors the collaborator opted out of", async () => {
    setCollaborators([
      collaborator("ada", {
        pointer: { x: 1, y: 2, tool: "laser", renderCursor: false },
      }),
    ]);

    await waitFor(() => {
      const { remotePointerViewportCoords, remotePointerUsernames } =
        getInteractiveRendererParams(h.app)!.renderConfig;
      expect(remotePointerViewportCoords.size).toBe(0);
      expect(remotePointerUsernames.size).toBe(0);
    });
  });
});

describe("UserList", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("is not rendered without collaborators", () => {
    expect(document.querySelector(".UserList")).toBe(null);
  });

  it("renders an avatar per named collaborator, skipping unnamed ones", async () => {
    setCollaborators([
      collaborator("ada", { username: "Ada" }),
      collaborator("blank", { username: "  " }),
    ]);

    await waitFor(() => {
      const avatars = document.querySelectorAll(".UserList .Avatar");
      expect(avatars).toHaveLength(1);
      expect(avatars[0].textContent!.trim()).toBe("A");
    });
  });
});

describe("UserList overflow", () => {
  // the row's slot count is measured off the wrapper, which jsdom always
  // reports as 0-wide
  let clientWidth = 0;

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => clientWidth,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  it("renders the current user as the pill, and the others as bare avatars", async () => {
    clientWidth = 400;
    await render(<Excalidraw />);

    setCollaborators([
      collaborator("ada", { username: "Ada" }),
      collaborator("me", { username: "Me", isCurrentUser: true }),
    ]);

    await waitFor(() => {
      expect(document.querySelectorAll(".UserList__pill")).toHaveLength(1);
      expect(
        document.querySelectorAll(
          ".UserList .UserList__collaborator--avatar-only",
        ),
      ).toHaveLength(2);
      // the current user's avatar is always the last slot
      expect(
        document.querySelector(".UserList__pill .UserList__collaborator")
          ?.classList,
      ).toContain("is-current-user");
    });
  });

  it("drops the overflowing avatars, keeping the current user's pill", async () => {
    // room for two slots — one of which the pill claims
    clientWidth = 2 * 38 + 21;
    await render(<Excalidraw />);

    setCollaborators([
      collaborator("ada", { username: "Ada" }),
      collaborator("bob", { username: "Bob" }),
      collaborator("cleo", { username: "Cleo" }),
      collaborator("me", { username: "Me", isCurrentUser: true }),
    ]);

    await waitFor(() => {
      expect(document.querySelectorAll(".UserList .Avatar")).toHaveLength(2);
      expect(document.querySelectorAll(".UserList__pill")).toHaveLength(1);
    });
  });
});

describe("UserList dropdown", () => {
  it("retains the local dropdown when the same account has multiple clients", async () => {
    const { container } = await renderHost(CaliburnCollabHostComponent);
    const currentSocketId = socketId("current");
    const otherSocketId = socketId("other");

    act(() => {
      h.app.updateScene({
        collaborators: new Map<SocketId, Collaborator>([
          [
            otherSocketId,
            {
              id: "user",
              socketId: otherSocketId,
              username: "Ada",
              isCurrentUser: false,
            },
          ],
          [
            currentSocketId,
            {
              id: "user",
              socketId: currentSocketId,
              username: "Ada",
              isCurrentUser: true,
            },
          ],
        ]),
      });
    });

    await waitFor(() => {
      expect(container.querySelectorAll(".UserList__pill")).toHaveLength(1);
    });

    const currentUserPill =
      container.querySelector<HTMLElement>(".UserList__pill");
    expect(currentUserPill).not.toBeNull();

    act(() => {
      fireEvent.click(currentUserPill!);
    });

    await waitFor(() => {
      const dropdown = document.querySelector(".UserList__collaborators");
      const dropdownCollaborators = dropdown?.querySelectorAll(
        ".UserList__collaborator",
      );
      expect(dropdownCollaborators).toHaveLength(2);
      expect(
        dropdown?.querySelectorAll(".UserList__collaborator.is-current-user"),
      ).toHaveLength(1);
      expect(getByText(document.body, "Spotlight me")).toBeVisible();
    });
  });
});

describe("follow mode", () => {
  let follows: OnUserFollowedPayload[];
  let componentRef: ComponentRef<CaliburnCollabHostComponent>;

  beforeEach(async () => {
    follows = [];
    ({ componentRef } = await renderHost(CaliburnCollabHostComponent, {
      onUserFollow: (payload: OnUserFollowedPayload) => follows.push(payload),
    }));
  });

  it("emits a FOLLOW intent from the dropdown, through prop and API alike", async () => {
    const fromApi: OnUserFollowedPayload[] = [];
    h.app.getApi().onUserFollow((payload) => fromApi.push(payload));

    setCollaborators([
      collaborator("ada", { username: "Ada" }),
      collaborator("me", { username: "Me", isCurrentUser: true }),
    ]);

    await waitFor(() => {
      expect(document.querySelector(".UserList__pill")).not.toBe(null);
    });

    act(() => {
      fireEvent.click(document.querySelector(".UserList__pill")!);
    });

    await waitFor(() => {
      expect(dropdownRows()).toHaveLength(2);
    });

    act(() => {
      fireEvent.click(dropdownRows()[0]);
    });

    const expected = {
      action: "FOLLOW",
      userToFollow: { socketId: socketId("ada"), username: "Ada" },
    };
    expect(follows).toEqual([expected]);
    expect(fromApi).toEqual([expected]);
  });

  it("highlights the followed collaborator once the host feeds the state back", async () => {
    setCollaborators([collaborator("ada", { username: "Ada" })]);

    await waitFor(() => {
      expect(document.querySelector(".UserList .Avatar")).not.toBe(null);
    });
    expect(document.querySelector(".UserList .Avatar.is-followed")).toBe(null);

    act(() => {
      componentRef.setInput("userToFollow", {
        socketId: socketId("ada"),
        username: "Ada",
      });
    });

    await waitFor(() => {
      expect(document.querySelector(".UserList .Avatar.is-followed")).not.toBe(
        null,
      );
    });
  });

  it("emits an UNFOLLOW intent when the user starts drawing", () => {
    act(() => {
      componentRef.setInput("userToFollow", {
        socketId: socketId("ada"),
        username: "Ada",
      });
    });

    const pointer = new Pointer("mouse");
    act(() => {
      pointer.down(100, 100);
      pointer.up();
    });

    expect(follows).toEqual([
      {
        action: "UNFOLLOW",
        userToFollow: { socketId: socketId("ada"), username: "Ada" },
      },
    ]);
  });
});

describe("viewport status frame", () => {
  it("renders the border and badge the host asks for", async () => {
    const onClose = vi.fn();
    const { componentRef } = await renderHost(CaliburnCollabHostComponent);

    expect(document.querySelector(".viewport-status-frame__border")).toBe(null);
    expect(document.querySelector(".viewport-status-frame__badge")).toBe(null);

    act(() => {
      componentRef.setInput("viewportStatusFrame", {
        border: "var(--color-primary-hover)",
        label: { label: "Following Ada", onClose },
      });
    });

    await waitFor(() => {
      expect(document.querySelector(".viewport-status-frame__border")).not.toBe(
        null,
      );
      expect(
        document
          .querySelector(".viewport-status-frame__badge-label")!
          .textContent!.trim(),
      ).toBe("Following Ada");
      expect(
        document.querySelector(".excalidraw--viewport-status-border"),
      ).not.toBe(null);
      expect(
        document.querySelector(".excalidraw--viewport-status-label"),
      ).not.toBe(null);
    });

    act(() => {
      fireEvent.click(
        document.querySelector(".viewport-status-frame__badge-close")!,
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("onPointerUpdate", () => {
  it("broadcasts the local pointer on move, down and up", async () => {
    const updates: { pointer: unknown; button: string }[] = [];
    await renderHost(CaliburnCollabHostComponent, {
      onPointerUpdate: (payload: {
        pointer: { x: number; y: number; tool: string };
        button: string;
      }) => updates.push({ pointer: payload.pointer, button: payload.button }),
    });

    const pointer = new Pointer("mouse");
    act(() => {
      pointer.move(120, 80);
    });

    expect(updates).toEqual([
      { pointer: { x: 120, y: 80, tool: "pointer" }, button: "up" },
    ]);

    updates.length = 0;
    act(() => {
      pointer.down();
    });
    expect(updates.at(-1)).toEqual({
      pointer: { x: 120, y: 80, tool: "pointer" },
      button: "down",
    });

    updates.length = 0;
    act(() => {
      pointer.up();
    });
    expect(updates.at(-1)).toEqual({
      pointer: { x: 120, y: 80, tool: "pointer" },
      button: "up",
    });
  });

  // caliburn-original: upstream has no navigation-only `onPointerUpdate`
  // case, but caliburn's pan teardown (`pan-gesture.ts`) is the one call site
  // where `savePointer`'s own non-interactive gate is load-bearing — every
  // other one is already behind an `isToolSupported` check
  it("stays silent while panning a navigation-only editor", async () => {
    const updates: unknown[] = [];
    await render(
      <Excalidraw
        interaction={{ enabled: { navigation: true } }}
        onPointerUpdate={(payload: unknown) => updates.push(payload)}
      />,
    );

    const pointer = new Pointer("mouse");
    act(() => {
      pointer.down(10, 10);
      pointer.move(40, 40);
      pointer.up();
    });

    // the pan ran (so the teardown that calls `savePointer` did too)
    expect([h.state.scrollX, h.state.scrollY]).not.toEqual([0, 0]);
    expect(updates).toEqual([]);
  });
});

/**
 * Ported from upstream `tests/interactivity.test.tsx`'s
 * `interaction={{ enabled: { tools } }}` block — the presenter case, where a
 * non-interactive editor keeps broadcasting the pointer so collaborators can
 * follow the laser. Caliburn has no `interactivity.test.tsx` port to host it,
 * so the two cases that turn on `onPointerUpdate` are carried here, beside
 * the rest of the pointer-broadcast coverage; upstream's `laserTrails`
 * assertions are dropped with the trails themselves, which caliburn hasn't
 * ported, and the helper keeps only the spies the carried cases use.
 */
describe("interaction={{ enabled: { tools } }}", () => {
  const mouse = new Pointer("mouse");
  const onPointerDownSpy = vi.fn();
  const onPointerUpdateSpy = vi.fn();

  const renderWithInteraction = async (
    interaction: Record<string, unknown>,
  ) => {
    await render(
      <Excalidraw
        interaction={interaction}
        autoFocus={true}
        handleKeyboardGlobally={true}
        onPointerDown={onPointerDownSpy}
        onPointerUpdate={onPointerUpdateSpy}
        initialData={{
          elements: [
            API.createElement({
              type: "rectangle",
              x: 10,
              y: 10,
              width: 50,
              height: 50,
            }),
          ],
        }}
      />,
    );
    await waitFor(() => expect(h.state.width).toBe(200));
    Object.assign(document, {
      elementFromPoint: () => GlobalTestState.canvas,
    });
  };

  beforeEach(() => {
    mouse.reset();
    onPointerDownSpy.mockClear();
    onPointerUpdateSpy.mockClear();
    mockBoundingClientRect();
  });

  afterEach(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("laser: pointer positions broadcast via onPointerUpdate", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    act(() => {
      h.app.setActiveTool({ type: "laser" });
    });

    // between strokes (plain hover)
    mouse.moveTo(50, 50);
    expect(onPointerUpdateSpy).toHaveBeenCalled();
    expect(onPointerUpdateSpy.mock.calls.at(-1)![0].pointer.tool).toBe("laser");

    // during a stroke
    onPointerUpdateSpy.mockClear();
    mouse.downAt(30, 30);
    mouse.moveTo(60, 60);
    mouse.upAt(60, 60);
    expect(
      onPointerUpdateSpy.mock.calls.some(
        ([payload]) => payload.button === "down",
      ),
    ).toBe(true);
    expect(onPointerUpdateSpy.mock.calls.at(-1)![0].button).toBe("up");
  });

  it("pointer input stays inert when the active tool is not enabled", async () => {
    await renderWithInteraction({ enabled: { tools: { laser: true } } });

    // default (selection) tool is not in the enabled set
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(false);

    mouse.downAt(30, 30);
    mouse.moveTo(80, 80);
    mouse.upAt(80, 80);
    expect(h.state.selectedElementIds).toEqual({});
    expect(onPointerDownSpy).not.toHaveBeenCalled();
    expect(onPointerUpdateSpy).not.toHaveBeenCalled();

    // a custom tool isn't covered by `tools.laser` — the switch itself is
    // refused
    act(() => {
      h.app.setActiveTool({
        type: "custom",
        customType: "comment",
        locked: true,
      });
    });
    expect(h.state.activeTool.type).toBe("selection");
    expect(h.app.isToolSupported(h.state.activeTool.type)).toBe(false);
    mouse.reset();
    mouse.downAt(40, 40);
    expect(onPointerDownSpy).not.toHaveBeenCalled();
  });
});
