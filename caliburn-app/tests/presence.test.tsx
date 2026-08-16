import { webcrypto } from "node:crypto";

import { vi } from "vitest";

import { UserIdleState } from "@excalidraw/common";
import { encryptData } from "@excalidraw/excalidraw/data/encryption";

import type { SocketId } from "@excalidraw/excalidraw/types";

import { h } from "../../packages/caliburn/src/index";
import { getInteractiveRendererParams } from "../../packages/caliburn/src/render";
import { userToFollow } from "../src/app-state";
import { WS_SUBTYPES } from "../src/app_constants";
import { CollabService } from "../src/collab/collab.service";

import { act, fireEvent, render, waitFor } from "./test-utils";

import type { CaliburnImperativeAPI } from "../../packages/caliburn/src/index";

// the collab protocol encrypts every broadcast — give the suite a real
// WebCrypto so a simulated `client-broadcast` can be produced the same way a
// peer would produce it
Object.defineProperty(window, "crypto", {
  configurable: true,
  value: webcrypto,
});

vi.mock("../src/data/firebase.ts", () => ({
  loadFromFirebase: async () => null,
  saveToFirebase: () => {},
  isSavedToFirebase: () => true,
  loadFilesFromFirebase: async () => ({ loadedFiles: [], erroredFiles: [] }),
  saveFilesToFirebase: async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  }),
}));

const socket = vi.hoisted(() => {
  const handlers = new Map<string, ((...args: any[]) => void)[]>();
  const emitted: { event: string; args: unknown[] }[] = [];
  return {
    handlers,
    emitted,
    id: "local-socket",
    on(event: string, cb: (...args: any[]) => void) {
      handlers.set(event, [...(handlers.get(event) ?? []), cb]);
    },
    once(event: string, cb: (...args: any[]) => void) {
      this.on(event, cb);
    },
    off(event: string) {
      handlers.delete(event);
    },
    emit(event: string, ...args: unknown[]) {
      emitted.push({ event, args });
    },
    close() {},
    reset() {
      handlers.clear();
      emitted.length = 0;
    },
    /** delivers a server message to whatever the client subscribed */
    async deliver(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) {
        await cb(...args);
      }
    },
  };
});

vi.mock("socket.io-client", () => ({ default: () => socket }));

const REMOTE = "remote-socket" as SocketId;

/** the UserList's slot count is measured off its wrapper, which jsdom always
 * reports as 0-wide */
const stubWrapperWidth = (clientWidth: number) => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => clientWidth,
  });
};

const startCollaboration = async () => {
  window.collab.setUsername("Me");
  act(() => {
    // not awaited: the returned promise only settles once the room's initial
    // scene arrives, as upstream's own call site relies on
    window.collab.startCollaboration(null);
  });
  await waitFor(() => {
    expect(window.collab.portal.socket).not.toBe(null);
  });
  window.collab.portal.socketInitialized = true;
};

/** the encrypted `client-broadcast` shape a peer would put on the wire */
const broadcastFromPeer = async (payload: unknown) => {
  const { encryptedBuffer, iv } = await encryptData(
    window.collab.portal.roomKey!,
    JSON.stringify(payload),
  );
  await act(async () => {
    await socket.deliver("client-broadcast", encryptedBuffer, iv);
  });
};

describe("collab presence", () => {
  beforeEach(() => {
    socket.reset();
    userToFollow.set(null);
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  it("renders a remote collaborator's cursor, selection and avatar", async () => {
    stubWrapperWidth(400);
    await render();
    await startCollaboration();

    await act(async () => {
      await socket.deliver("room-user-change", [socket.id as SocketId, REMOTE]);
    });

    await broadcastFromPeer({
      type: WS_SUBTYPES.MOUSE_LOCATION,
      payload: {
        socketId: REMOTE,
        username: "Ada",
        pointer: { x: 30, y: 40, tool: "pointer" },
        button: "down",
        selectedElementIds: { A: true },
      },
    });

    await waitFor(() => {
      const { renderConfig } = getInteractiveRendererParams(h.app)!;
      expect(renderConfig.remotePointerUsernames.get(REMOTE)).toBe("Ada");
      expect(renderConfig.remotePointerButton.get(REMOTE)).toBe("down");
      expect(renderConfig.remotePointerViewportCoords.get(REMOTE)).toEqual({
        x: 30,
        y: 40,
      });
      expect(renderConfig.remoteSelectedElementIds.get("A")).toEqual([REMOTE]);
    });

    await waitFor(() => {
      // the remote collaborator plus the local user's own pill
      const avatars = document.querySelectorAll(".UserList .Avatar");
      expect(avatars).toHaveLength(2);
      expect([...avatars].map((avatar) => avatar.textContent!.trim())).toEqual([
        "A",
        "M",
      ]);
      expect(document.querySelectorAll(".UserList__pill")).toHaveLength(1);
    });
  });

  it("carries a remote idle state into the render config", async () => {
    await render();
    await startCollaboration();

    await broadcastFromPeer({
      type: WS_SUBTYPES.MOUSE_LOCATION,
      payload: {
        socketId: REMOTE,
        username: "Ada",
        pointer: { x: 1, y: 2, tool: "pointer" },
        button: "up",
        selectedElementIds: {},
      },
    });
    await broadcastFromPeer({
      type: WS_SUBTYPES.IDLE_STATUS,
      payload: {
        socketId: REMOTE,
        username: "Ada",
        userState: UserIdleState.IDLE,
      },
    });

    await waitFor(() => {
      const { renderConfig } = getInteractiveRendererParams(h.app)!;
      expect(renderConfig.remotePointerUserStates.get(REMOTE)).toBe(
        UserIdleState.IDLE,
      );
    });
  });

  it("broadcasts the local cursor as the pointer moves", async () => {
    await render();
    await startCollaboration();

    const broadcastMouseLocation = vi.spyOn(
      window.collab.portal,
      "broadcastMouseLocation",
    );

    act(() => {
      fireEvent.pointerMove(document.querySelector("canvas.interactive")!, {
        clientX: 120,
        clientY: 90,
        pointerId: 1,
        pointerType: "mouse",
      });
    });

    expect(broadcastMouseLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        pointer: { x: 120, y: 90, tool: "pointer" },
        button: "up",
      }),
    );
  });
});

describe("collab follow mode", () => {
  beforeEach(() => {
    socket.reset();
    userToFollow.set(null);
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  });

  it("joins the followed user's room and paints the viewport status frame", async () => {
    await render();
    await startCollaboration();

    await act(async () => {
      await socket.deliver("room-user-change", [socket.id as SocketId, REMOTE]);
    });

    act(() => {
      h.app.emitUserFollowIntent({
        userToFollow: { socketId: REMOTE, username: "Ada" },
        action: "FOLLOW",
      });
    });

    expect(
      socket.emitted.filter((entry) => entry.event === "user-follow"),
    ).toEqual([
      {
        event: "user-follow",
        args: [
          {
            userToFollow: { socketId: REMOTE, username: "Ada" },
            action: "FOLLOW",
          },
        ],
      },
    ]);

    await waitFor(() => {
      expect(document.querySelector(".viewport-status-frame__border")).not.toBe(
        null,
      );
      expect(
        document
          .querySelector(".viewport-status-frame__badge-label")!
          .textContent!.replace(/\s+/g, " ")
          .trim(),
      ).toBe("Following Ada");
    });
  });

  it("applies the followed user's viewport bounds", async () => {
    await render();
    await startCollaboration();

    act(() => {
      h.app.emitUserFollowIntent({
        userToFollow: { socketId: REMOTE, username: "Ada" },
        action: "FOLLOW",
      });
    });

    const before = { ...h.state.zoom, scrollX: h.state.scrollX };

    await broadcastFromPeer({
      type: WS_SUBTYPES.USER_VISIBLE_SCENE_BOUNDS,
      payload: {
        socketId: REMOTE,
        username: "Ada",
        sceneBounds: [0, 0, 400, 300],
      },
    });

    await waitFor(() => {
      expect({ ...h.state.zoom, scrollX: h.state.scrollX }).not.toEqual(before);
    });
  });

  it("stops following when the user starts drawing", async () => {
    await render();
    await startCollaboration();

    act(() => {
      h.app.emitUserFollowIntent({
        userToFollow: { socketId: REMOTE, username: "Ada" },
        action: "FOLLOW",
      });
    });
    await waitFor(() => {
      expect(document.querySelector(".viewport-status-frame__border")).not.toBe(
        null,
      );
    });

    const canvas = document.querySelector("canvas.interactive")!;
    act(() => {
      fireEvent.pointerDown(canvas, {
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        pointerType: "mouse",
      });
      fireEvent.pointerUp(canvas, {
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        pointerType: "mouse",
      });
    });

    await waitFor(() => {
      expect(document.querySelector(".viewport-status-frame__border")).toBe(
        null,
      );
    });
    expect(
      socket.emitted
        .filter((entry) => entry.event === "user-follow")
        .map((entry) => (entry.args[0] as { action: string }).action),
    ).toEqual(["FOLLOW", "UNFOLLOW"]);
  });
});

describe("collab API subscriptions", () => {
  it("re-binds to the editor API the app hands it after a rebuild", () => {
    const collab = new CollabService();
    const unsubscribed: string[] = [];

    const makeAPI = (name: string) => {
      const listeners = {
        scroll: [] as (() => void)[],
        follow: [] as ((payload: unknown) => void)[],
      };
      return {
        api: {
          onScrollChange: (cb: () => void) => {
            listeners.scroll.push(cb);
            return () => unsubscribed.push(`${name}:scroll`);
          },
          onUserFollow: (cb: (payload: unknown) => void) => {
            listeners.follow.push(cb);
            return () => unsubscribed.push(`${name}:follow`);
          },
        } as unknown as CaliburnImperativeAPI,
        listeners,
      };
    };

    const first = makeAPI("first");
    const second = makeAPI("second");

    collab.start(first.api);
    expect(first.listeners.scroll).toHaveLength(1);
    expect(first.listeners.follow).toHaveLength(1);

    // the app reassigns the API when a language change rebuilds the editor
    collab.excalidrawAPI = second.api;

    expect(unsubscribed).toEqual(["first:follow", "first:scroll"]);
    expect(second.listeners.scroll).toHaveLength(1);
    expect(second.listeners.follow).toHaveLength(1);

    collab.destroy();
    expect(unsubscribed).toEqual([
      "first:follow",
      "first:scroll",
      "second:follow",
      "second:scroll",
    ]);

    // a restart with the same API instance must still re-subscribe — an
    // identity guard on the setter would silently strand this
    collab.start(second.api);
    expect(second.listeners.scroll).toHaveLength(2);
    expect(second.listeners.follow).toHaveLength(2);
  });
});
