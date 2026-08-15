import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  viewChild,
} from "@angular/core";

import type { AppState } from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent } from "../../src/editor.component";
import { CaliburnDefaultSidebarComponent } from "../../src/components/sidebar/default-sidebar.component";
import { CaliburnSidebarHeaderComponent } from "../../src/components/sidebar/sidebar-header.component";
import { CaliburnSidebarTabComponent } from "../../src/components/sidebar/sidebar-tab.component";
import { CaliburnSidebarTabsComponent } from "../../src/components/sidebar/sidebar-tabs.component";
import { CaliburnSidebarComponent } from "../../src/components/sidebar/sidebar.component";

/**
 * Host apps for the ported sidebar tests: upstream passes its `<Sidebar>` /
 * `<DefaultSidebar>` as children of `<Excalidraw>`, caliburn hands the editor
 * the template that renders them (the `sidebar` slot). The variants below
 * cover the child shapes upstream's tests use.
 *
 * These live in a `.ts` module rather than in the `.tsx` test files because
 * only `.ts` goes through the Angular compiler in this project.
 */
export type SidebarHostVariant =
  | "content"
  | "headerWithContent"
  | "header"
  | "text"
  | "tabs";

@Component({
  selector: "caliburn-test-sidebar-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnEditorComponent,
    CaliburnSidebarComponent,
    CaliburnSidebarHeaderComponent,
    CaliburnSidebarTabComponent,
    CaliburnSidebarTabsComponent,
  ],
  templateUrl: "./sidebar-host.component.html",
})
export class CaliburnSidebarHostComponent {
  readonly initialData = input<{ appState?: Partial<AppState> } | null>(null);
  readonly variant = input<SidebarHostVariant>("content");
  readonly sidebarClass = input<string>("");
  readonly docked = input<boolean | undefined>(undefined);
  readonly onDock = input<((docked: boolean) => void) | undefined>(undefined);

  readonly stateChange = output<AppState["openSidebar"]>();

  private readonly editor = viewChild(CaliburnEditorComponent);

  /** the tab blocks are gated as the editor's own default sidebar gates
   * them — Radix unmounts an inactive tab panel */
  protected tab() {
    const editor = this.editor();
    editor?.changeGeneration();
    return editor?.state.openSidebar?.tab ?? null;
  }
}

@Component({
  selector: "caliburn-test-default-sidebar-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent, CaliburnDefaultSidebarComponent],
  templateUrl: "./default-sidebar-host.component.html",
})
export class CaliburnDefaultSidebarHostComponent {
  readonly initialData = input<{ appState?: Partial<AppState> } | null>(null);
  readonly docked = input<boolean | undefined>(undefined);
  readonly onDock = input<((docked: boolean) => void) | false | undefined>(
    undefined,
  );
}
