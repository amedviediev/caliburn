import { vi } from "vitest";

import { DEFAULT_SIDEBAR } from "@excalidraw/common";

import { h } from "../src/test-hook";

import {
  CaliburnDefaultSidebarHostComponent,
  CaliburnSidebarHostComponent,
} from "./helpers/sidebar-hosts.component";
import {
  act,
  fireEvent,
  queryAllByTestId,
  queryByTestId,
  renderHost,
  waitFor,
  withExcalidrawDimensions,
} from "./test-utils";

/**
 * Ports of upstream `components/Sidebar/Sidebar.test.tsx` and the host-prop
 * half of `components/DefaultSidebar.test.tsx`, which were deferred until the
 * editor took host-composed sidebars. Upstream passes its sidebars as
 * children of `<Excalidraw>`; here they come from a host component that fills
 * the editor's `sidebar` slot (see `helpers/sidebar-hosts.component.ts`), so
 * the test bodies keep their assertions and lose only the JSX.
 */
const toggleSidebar = (
  ...args: Parameters<typeof h.app.toggleSidebar>
): Promise<boolean> => {
  return act(() => {
    return Promise.resolve(h.app.toggleSidebar(...args));
  });
};

const assertSidebarDockButton = <T extends boolean>(
  hasDockButton: T,
): T extends false
  ? { dockButton: null; sidebar: HTMLElement }
  : { dockButton: HTMLElement; sidebar: HTMLElement } => {
  const sidebar = window.document.querySelector<HTMLElement>(
    ".excalidraw .sidebar",
  );
  expect(sidebar).not.toBe(null);
  const dockButton = queryByTestId(sidebar!, "sidebar-dock");
  if (hasDockButton) {
    expect(dockButton).not.toBe(null);
    return { dockButton: dockButton!, sidebar: sidebar! } as any;
  }
  expect(dockButton).toBe(null);
  return { dockButton: null, sidebar: sidebar! } as any;
};

describe("Sidebar", () => {
  describe("General behavior", () => {
    it("should render custom sidebar", async () => {
      const { container } = await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
      });

      const node = container.querySelector("#test-sidebar-content");
      expect(node).not.toBe(null);
    });

    it("should render only one sidebar and prefer the custom one", async () => {
      const { container } = await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
      });

      await waitFor(() => {
        // make sure the custom sidebar is rendered
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);

        // make sure only one sidebar is rendered
        const sidebars = container.querySelectorAll(".sidebar");
        expect(sidebars.length).toBe(1);
      });
    });

    it("should toggle sidebar using excalidrawAPI.toggleSidebar()", async () => {
      const { container } = await renderHost(CaliburnSidebarHostComponent);

      // sidebar isn't rendered initially
      // -------------------------------------------------------------------------
      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });

      // toggle sidebar on
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar" })).toBe(true);

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);
      });

      // toggle sidebar off
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar" })).toBe(false);

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });

      // force-toggle sidebar off (=> still hidden)
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar", force: false })).toBe(
        false,
      );

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });

      // force-toggle sidebar on
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar", force: true })).toBe(
        true,
      );
      expect(await toggleSidebar({ name: "customSidebar", force: true })).toBe(
        true,
      );

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);
      });

      // toggle library (= hide custom sidebar)
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: DEFAULT_SIDEBAR.name })).toBe(true);

      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);

        // make sure only one sidebar is rendered
        const sidebars = container.querySelectorAll(".sidebar");
        expect(sidebars.length).toBe(1);
      });

      // closing sidebar using `{ name: null }`
      // -------------------------------------------------------------------------
      expect(await toggleSidebar({ name: "customSidebar" })).toBe(true);
      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).not.toBe(null);
      });

      expect(await toggleSidebar({ name: null })).toBe(false);
      await waitFor(() => {
        const node = container.querySelector("#test-sidebar-content");
        expect(node).toBe(null);
      });
    });
  });

  describe("<Sidebar.Header/>", () => {
    it("should render custom sidebar header", async () => {
      const { container } = await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "headerWithContent",
      });

      const node = container.querySelector("#test-sidebar-header-content");
      expect(node).not.toBe(null);
      // make sure we don't render the default fallback header,
      // just the custom one
      expect(queryAllByTestId(container, "sidebar-header").length).toBe(1);
    });

    it("should not render <Sidebar.Header> for custom sidebars by default", async () => {
      const { container } = await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "text",
        sidebarClass: "test-sidebar",
      });

      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-close");
      expect(closeButton).toBe(null);
    });

    it("<Sidebar.Header> should render close button", async () => {
      const onStateChange = vi.fn();
      const { container, componentRef } = await renderHost(
        CaliburnSidebarHostComponent,
        {
          initialData: { appState: { openSidebar: { name: "customSidebar" } } },
          variant: "header",
          sidebarClass: "test-sidebar",
        },
      );
      componentRef.instance.stateChange.subscribe(onStateChange);

      // initial open
      expect(h.state.openSidebar).toEqual({ name: "customSidebar" });

      const sidebar = container.querySelector<HTMLElement>(".test-sidebar");
      expect(sidebar).not.toBe(null);
      const closeButton = queryByTestId(sidebar!, "sidebar-close")!;
      expect(closeButton).not.toBe(null);

      act(() => {
        fireEvent.click(closeButton);
      });
      await waitFor(() => {
        expect(container.querySelector<HTMLElement>(".test-sidebar")).toBe(
          null,
        );
        expect(onStateChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe("Docking behavior", () => {
    it("shouldn't be user-dockable if `onDock` not supplied", async () => {
      await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "header",
      });

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          assertSidebarDockButton(false);
        },
      );
    });

    it("shouldn't be user-dockable if `onDock` not supplied & `docked={true}`", async () => {
      await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "header",
        docked: true,
      });

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          assertSidebarDockButton(false);
        },
      );
    });

    it("shouldn't be user-dockable if `onDock` not supplied & docked={false}`", async () => {
      await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "header",
        docked: false,
      });

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          assertSidebarDockButton(false);
        },
      );
    });

    it("should be user-dockable when both `onDock` and `docked` supplied", async () => {
      await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "header",
        docked: true,
        onDock: () => {},
      });

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          assertSidebarDockButton(true);
        },
      );
    });

    it("shouldn't be user-dockable when only `onDock` supplied w/o `docked`", async () => {
      // we expect warnings in this test and don't want to pollute stdout
      const mock = vi.spyOn(console, "warn").mockImplementation(() => {});

      await renderHost(CaliburnSidebarHostComponent, {
        initialData: { appState: { openSidebar: { name: "customSidebar" } } },
        variant: "header",
        onDock: () => {},
      });

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          assertSidebarDockButton(false);
        },
      );

      mock.mockRestore();
    });
  });

  describe("Sidebar.tab", () => {
    it("should toggle sidebars tabs correctly", async () => {
      const { container } = await renderHost(CaliburnSidebarHostComponent, {
        variant: "tabs",
        docked: true,
      });

      await withExcalidrawDimensions(
        { width: 1920, height: 1080 },
        async () => {
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=library]",
            ),
          ).toBeNull();

          // open library sidebar
          expect(
            await toggleSidebar({ name: "customSidebar", tab: "library" }),
          ).toBe(true);
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=library]",
            ),
          ).not.toBeNull();

          // switch to comments tab
          expect(
            await toggleSidebar({ name: "customSidebar", tab: "comments" }),
          ).toBe(true);
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=comments]",
            ),
          ).not.toBeNull();

          // toggle sidebar closed
          expect(
            await toggleSidebar({ name: "customSidebar", tab: "comments" }),
          ).toBe(false);
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=comments]",
            ),
          ).toBeNull();

          // toggle sidebar open
          expect(
            await toggleSidebar({ name: "customSidebar", tab: "comments" }),
          ).toBe(true);
          expect(
            container.querySelector<HTMLElement>(
              "[role=tabpanel][data-testid=comments]",
            ),
          ).not.toBeNull();
        },
      );
    });
  });
});

describe("DefaultSidebar", () => {
  const renderDefaultSidebarHost = async (
    inputs: Record<string, unknown> = {},
  ) =>
    renderHost(CaliburnDefaultSidebarHostComponent, {
      initialData: {
        appState: { openSidebar: { name: DEFAULT_SIDEBAR.name } },
      },
      ...inputs,
    });

  it("when `docked={undefined}` & `onDock`, should allow docking", async () => {
    await renderDefaultSidebarHost({ onDock: () => {} });

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

  it("when `docked={true}` & `onDock`, should allow docking", async () => {
    await renderDefaultSidebarHost({ docked: true, onDock: () => {} });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      const { dockButton } = assertSidebarDockButton(true);
      expect(dockButton).toHaveClass("selected");
    });
  });

  it("when `onDock={false}`, should disable docking", async () => {
    await renderDefaultSidebarHost({ onDock: false });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      assertSidebarDockButton(false);
    });
  });

  it("when `docked={true}` & `onDock={false}`, should force-dock sidebar", async () => {
    await renderDefaultSidebarHost({ docked: true, onDock: false });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = assertSidebarDockButton(false);
      expect(sidebar).toHaveClass("sidebar--docked");
    });
  });

  it("when `docked={true}` & `onDock={undefined}`, should force-dock sidebar", async () => {
    await renderDefaultSidebarHost({ docked: true });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = assertSidebarDockButton(false);
      expect(sidebar).toHaveClass("sidebar--docked");
    });
  });

  it("when `docked={false}` & `onDock={undefined}`, should force-undock sidebar", async () => {
    await renderDefaultSidebarHost({ docked: false });

    await withExcalidrawDimensions({ width: 1920, height: 1080 }, async () => {
      expect(h.state.defaultSidebarDockedPreference).toBe(false);

      const { sidebar } = assertSidebarDockButton(false);
      expect(sidebar).not.toHaveClass("sidebar--docked");
    });
  });
});
