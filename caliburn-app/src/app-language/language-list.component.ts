import { ChangeDetectionStrategy, Component } from "@angular/core";

import { languages, t } from "@excalidraw/excalidraw/i18n";

import { appLangCode, setAppLangCode } from "./language-state";

/**
 * Angular port of upstream
 * `excalidraw-app/app-language/LanguageList.tsx` — the language `<select>` the
 * app drops into its main menu. Upstream's `style` prop is dropped: its one
 * call site sets `width: 100%`, which is what `.dropdown-select__language`
 * gets here.
 */
@Component({
  selector: "caliburn-app-language-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: "display: contents;",
  },
  templateUrl: "./language-list.component.html",
})
export class CaliburnAppLanguageListComponent {
  protected readonly languages = languages;
  protected readonly langCode = appLangCode;
  protected readonly selectLanguageLabel = t("buttons.selectLanguage");

  protected onChange(event: Event) {
    setAppLangCode((event.target as HTMLSelectElement).value);
  }
}
