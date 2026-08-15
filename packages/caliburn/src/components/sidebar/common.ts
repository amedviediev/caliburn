import { signal } from "@angular/core";

/**
 * Angular port of upstream `Sidebar/Sidebar.tsx`'s `isSidebarDockedAtom`:
 * flags whether the currently rendered sidebar is docked, for LayerUI to
 * shift the UI. Module-level like the atom, since only one sidebar can be
 * rendered at a time.
 */
export const isSidebarDocked = signal(false);

/**
 * Upstream's `SidebarPropsContext` (`Sidebar/common.ts`) has no port: the
 * only consumer, `Sidebar.Header`, is declared inside `caliburn-sidebar` in
 * `default-sidebar.component.html`, so it reaches the sidebar through the
 * element injector directly. Same for the tab components and
 * `caliburn-sidebar-tabs`, which upstream wires through Radix's Tabs context.
 */
