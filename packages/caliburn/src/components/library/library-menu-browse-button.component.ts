import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

import { VERSIONS } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import type { AppState } from "@excalidraw/excalidraw/types";

import { translated } from "../../i18n";

/**
 * Angular port of upstream `LibraryMenuBrowseButton.tsx`. The host element IS
 * upstream's `<a class="library-menu-browse-button">`.
 */
@Component({
  selector: "a[caliburn-library-menu-browse-button]",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "library-menu-browse-button",
    target: "_excalidraw_libraries",
    "[attr.href]": "href()",
  },
  templateUrl: "./library-menu-browse-button.component.html",
})
export class CaliburnLibraryMenuBrowseButtonComponent {
  readonly id = input.required<string>();
  readonly theme = input.required<AppState["theme"]>();
  readonly libraryReturnUrl = input<string>();

  protected readonly label = translated(() => t("labels.libraries"));

  protected readonly href = computed(() => {
    const referrer =
      this.libraryReturnUrl() ||
      window.location.origin + window.location.pathname;
    return `${import.meta.env.VITE_APP_LIBRARY_URL}?target=${
      window.name || "_blank"
    }&referrer=${referrer}&useHash=true&token=${this.id()}&theme=${this.theme()}&version=${
      VERSIONS.excalidrawLibrary
    }`;
  });
}
