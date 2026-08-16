import React from "react";

import {
  CANVAS_SEARCH_TAB,
  DEFAULT_SIDEBAR,
  KEYS,
  LIBRARY_SIDEBAR_TAB,
} from "@excalidraw/common";

import type { LibraryItems } from "@excalidraw/excalidraw/types";

import { Excalidraw } from "../src/index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import {
  act,
  fireEvent,
  queryByTestId,
  render,
  waitFor,
  withExcalidrawDimensions,
} from "./test-utils";

import type { RenderResult } from "./test-utils";

const { h } = window;

let renderResult: RenderResult;

const container = () => renderResult.container;

const sidebar = () => container().querySelector<HTMLElement>(".sidebar");

const sidebarTrigger = () =>
  container().querySelector<HTMLElement>(".sidebar-trigger__label-element");

const tabPanel = (tab: string) =>
  container().querySelector<HTMLElement>(`[role=tabpanel][data-testid=${tab}]`);

const tabTrigger = (tab: string) =>
  container().querySelector<HTMLElement>(
    `[role=tab][aria-controls$="-content-${tab}"]`,
  );

const libraryUnits = () =>
  Array.from(container().querySelectorAll<HTMLElement>(".library-unit"));

const openLibrary = () => {
  act(() => {
    fireEvent.click(sidebarTrigger()!);
  });
};

/**
 * `assertSidebarDockButton` from upstream's
 * `Sidebar/siderbar.test.helpers.tsx`.
 */
const assertSidebarDockButton = <T extends boolean>(
  hasDockButton: T,
): T extends false
  ? { dockButton: null; sidebar: HTMLElement }
  : { dockButton: HTMLElement; sidebar: HTMLElement } => {
  const sidebarEl = sidebar();
  expect(sidebarEl).not.toBe(null);
  const dockButton = queryByTestId(sidebarEl!, "sidebar-dock");
  if (hasDockButton) {
    expect(dockButton).not.toBe(null);
    return { dockButton: dockButton!, sidebar: sidebarEl! } as any;
  }
  expect(dockButton).toBe(null);
  return { dockButton: null, sidebar: sidebarEl! } as any;
};

beforeEach(async () => {
  renderResult = await render(<Excalidraw handleKeyboardGlobally />);
  await act(() => h.app.library.resetLibrary());
});

describe("Sidebar", () => {
  it("is closed until the top-right trigger is clicked", () => {
    expect(sidebar()).toBe(null);
    expect(sidebarTrigger()).not.toBe(null);

    openLibrary();

    expect(h.state.openSidebar).toEqual({
      name: DEFAULT_SIDEBAR.name,
      tab: DEFAULT_SIDEBAR.defaultTab,
    });
    expect(sidebar()).not.toBe(null);
    expect(tabPanel(LIBRARY_SIDEBAR_TAB)).not.toBe(null);
    expect(container().querySelector(".layer-ui__library")).not.toBe(null);
  });

  it("renders exactly one sidebar", () => {
    openLibrary();
    expect(container().querySelectorAll(".sidebar").length).toBe(1);
  });

  it("switches tabs from the tab triggers", () => {
    openLibrary();

    expect(tabTrigger(LIBRARY_SIDEBAR_TAB)!.getAttribute("data-state")).toBe(
      "active",
    );
    expect(tabTrigger(CANVAS_SEARCH_TAB)!.getAttribute("data-state")).toBe(
      "inactive",
    );

    act(() => {
      fireEvent.click(tabTrigger(CANVAS_SEARCH_TAB)!);
    });

    expect(h.state.openSidebar).toEqual({
      name: DEFAULT_SIDEBAR.name,
      tab: CANVAS_SEARCH_TAB,
    });
    expect(tabPanel(CANVAS_SEARCH_TAB)).not.toBe(null);
    expect(tabPanel(LIBRARY_SIDEBAR_TAB)).toBe(null);
    expect(container().querySelector(".layer-ui__search")).not.toBe(null);
  });

  it("closes from the header's close button", () => {
    openLibrary();

    act(() => {
      fireEvent.click(queryByTestId(sidebar()!, "sidebar-close")!);
    });

    expect(h.state.openSidebar).toBe(null);
    expect(sidebar()).toBe(null);
  });

  it("closes on escape while undocked", () => {
    openLibrary();

    act(() => {
      Keyboard.keyPress(KEYS.ESCAPE);
    });

    expect(h.state.openSidebar).toBe(null);
  });

  it("closes on an outside click, but not on a click on its own trigger", () => {
    openLibrary();

    act(() => {
      fireEvent.pointerDown(
        container().querySelector(".excalidraw-container")!,
      );
    });
    expect(h.state.openSidebar).toBe(null);

    openLibrary();
    act(() => {
      fireEvent.pointerDown(container().querySelector(".sidebar-trigger")!);
    });
    expect(h.state.openSidebar).not.toBe(null);
  });

  it("toggles through excalidrawAPI.toggleSidebar()", async () => {
    expect(h.app.toggleSidebar({ name: DEFAULT_SIDEBAR.name })).toBe(true);
    act(() => {});
    expect(sidebar()).not.toBe(null);

    expect(h.app.toggleSidebar({ name: DEFAULT_SIDEBAR.name })).toBe(false);
    act(() => {});
    expect(sidebar()).toBe(null);

    expect(
      h.app.toggleSidebar({ name: DEFAULT_SIDEBAR.name, force: false }),
    ).toBe(false);
    expect(
      h.app.toggleSidebar({ name: DEFAULT_SIDEBAR.name, force: true }),
    ).toBe(true);
    expect(
      h.app.toggleSidebar({ name: DEFAULT_SIDEBAR.name, force: true }),
    ).toBe(true);
    act(() => {});
    expect(sidebar()).not.toBe(null);

    expect(
      h.app.toggleSidebar({
        name: DEFAULT_SIDEBAR.name,
        tab: CANVAS_SEARCH_TAB,
      }),
    ).toBe(true);
    act(() => {});
    expect(tabPanel(CANVAS_SEARCH_TAB)).not.toBe(null);

    expect(h.app.toggleSidebar({ name: null })).toBe(false);
    act(() => {});
    expect(sidebar()).toBe(null);
  });
});

describe("DefaultSidebar", () => {
  // body from upstream `components/DefaultSidebar.test.tsx`'s
  // "when `docked={undefined}` & `onDock={undefined}`, should allow docking"
  it("when `docked={undefined}` & `onDock={undefined}`, should allow docking", async () => {
    openLibrary();

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { dockButton } = assertSidebarDockButton(true);

      act(() => {
        fireEvent.click(dockButton);
      });
      await waitFor(() => {
        expect(h.state.defaultSidebarDockedPreference).toBe(true);
        expect(dockButton).toHaveClass("selected");
      });

      act(() => {
        fireEvent.click(dockButton);
      });
      await waitFor(() => {
        expect(h.state.defaultSidebarDockedPreference).toBe(false);
        expect(dockButton).not.toHaveClass("selected");
      });
    });
  });

  // sized first, so the missing dock button proves the force-dock rather than
  // an editor too narrow to fit a sidebar at all
  it("force-docks the search tab and hides its dock button", async () => {
    act(() => {
      h.app.toggleSidebar({
        name: DEFAULT_SIDEBAR.name,
        tab: CANVAS_SEARCH_TAB,
      });
    });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, () => {
      const { sidebar: sidebarEl } = assertSidebarDockButton(false);
      expect(sidebarEl).toHaveClass("sidebar--docked");
    });
  });

  // the dock button only renders while the editor is wide enough for a
  // sidebar (`editorInterface.canFitSidebar`), so — as upstream's own docking
  // tests do — this declares the editor's size first
  it("hides the top-right trigger while the sidebar is docked", async () => {
    openLibrary();
    expect(sidebarTrigger()).not.toBe(null);

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, () => {
      act(() => {
        fireEvent.click(queryByTestId(sidebar()!, "sidebar-dock")!);
      });

      expect(sidebarTrigger()).toBe(null);
    });
  });
});

describe("LibraryMenu", () => {
  it("shows the empty-library hint and the browse link", () => {
    openLibrary();

    expect(container().querySelector(".library-menu-items__no-items")).not.toBe(
      null,
    );
    expect(container().querySelector(".library-menu-browse-button")).not.toBe(
      null,
    );
    expect(libraryUnits().length).toBe(0);
  });

  it("adds the canvas selection to the library", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setAppState({ selectedElementIds: { [rectangle.id]: true } });

    openLibrary();

    const pending = container().querySelector<HTMLElement>(
      ".library-unit__pulse",
    );
    expect(pending).not.toBe(null);

    act(() => {
      fireEvent.click(pending!);
    });

    await waitFor(async () => {
      const items = await h.app.library.getLatestLibrary();
      expect(items.length).toBe(1);
      expect(items[0].elements.length).toBe(1);
      expect(items[0].status).toBe("unpublished");
    });
    // upstream deselects the canvas elements once they're added
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("inserts a library item onto the canvas when clicked", async () => {
    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: [
          {
            id: "item1",
            status: "unpublished",
            created: 1,
            elements: [API.createElement({ id: "elem1", type: "rectangle" })],
          },
        ],
      }),
    );

    openLibrary();

    await waitFor(() => {
      expect(libraryUnits().length).toBe(1);
    });

    expect(h.elements.length).toBe(0);

    act(() => {
      fireEvent.click(
        libraryUnits()[0].querySelector(".library-unit__dragger")!,
      );
    });

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
      expect(h.elements[0].type).toBe("rectangle");
    });
  });

  it("renders every item of a library larger than one render batch", async () => {
    // upstream reveals items in batches of ITEMS_RENDERED_PER_BATCH (17),
    // one batch per pass, so a library past that size only fully renders if
    // each batch schedules the next one
    const ITEM_COUNT = 40;

    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: Array.from({ length: ITEM_COUNT }, (_, i) => ({
          id: `item${i}`,
          status: "unpublished" as const,
          created: i,
          elements: [API.createElement({ id: `elem${i}`, type: "rectangle" })],
        })),
      }),
    );

    openLibrary();

    await waitFor(() => {
      expect(container().querySelectorAll("caliburn-library-unit").length).toBe(
        ITEM_COUNT,
      );
      expect(
        container().querySelectorAll("caliburn-empty-library-unit").length,
      ).toBe(0);
    });
  });

  it("selects items with shift+click and removes them from the dropdown", async () => {
    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: [
          {
            id: "item1",
            status: "unpublished",
            created: 1,
            elements: [API.createElement({ id: "elem1", type: "rectangle" })],
          },
        ],
      }),
    );

    openLibrary();
    await waitFor(() => {
      expect(libraryUnits().length).toBe(1);
    });

    act(() => {
      fireEvent.click(
        libraryUnits()[0].querySelector(".library-unit__dragger")!,
        { shiftKey: true },
      );
    });

    expect(
      container().querySelector(".library-actions-counter")?.textContent,
    ).toBe("1");

    act(() => {
      fireEvent.click(
        queryByTestId(
          container().querySelector(".layer-ui__library")!,
          "dropdown-menu-button",
        )!,
      );
    });
    expect(queryByTestId(container(), "lib-dropdown--load")).toBe(null);
    expect(queryByTestId(container(), "lib-dropdown--export")).not.toBe(null);
  });

  it("reports library updates through the onLibraryChange prop", async () => {
    const onLibraryChange = vi.fn();
    renderResult = await render(
      <Excalidraw onLibraryChange={onLibraryChange} />,
    );

    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: [
          {
            id: "item1",
            status: "unpublished",
            created: 1,
            elements: [API.createElement({ id: "elem1", type: "rectangle" })],
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(onLibraryChange).toHaveBeenCalled();
      const items: LibraryItems = onLibraryChange.mock.lastCall![0];
      expect(items.length).toBe(1);
      expect(items[0].id).toBe("item1");
    });
  });

  it("opens the library sidebar when the imperative updateLibrary asks for it", async () => {
    expect(sidebar()).toBe(null);

    await act(() =>
      h.app.library.updateLibrary({
        libraryItems: [],
        openLibraryMenu: true,
      }),
    );

    expect(h.state.openSidebar).toEqual({
      name: DEFAULT_SIDEBAR.name,
      tab: LIBRARY_SIDEBAR_TAB,
    });
  });
});
