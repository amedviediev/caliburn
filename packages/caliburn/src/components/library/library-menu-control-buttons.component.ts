import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { AppState } from "@excalidraw/excalidraw/types";

import { CaliburnLibraryMenuBrowseButtonComponent } from "./library-menu-browse-button.component";

/**
 * Angular port of upstream `LibraryMenuControlButtons.tsx`. The host element
 * IS upstream's `.library-menu-control-buttons` div, so a consumer's own
 * class and inline style land on the same node.
 */
@Component({
  selector: "caliburn-library-menu-control-buttons",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnLibraryMenuBrowseButtonComponent],
  host: { class: "library-menu-control-buttons" },
  templateUrl: "./library-menu-control-buttons.component.html",
})
export class CaliburnLibraryMenuControlButtonsComponent {
  readonly id = input.required<string>();
  readonly theme = input.required<AppState["theme"]>();
  readonly libraryReturnUrl = input<string>();
}
