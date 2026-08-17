import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
} from "@angular/core";

import {
  getNonDeletedElements,
  isEmbeddableElement,
} from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";
import { getSelectedElements } from "@excalidraw/excalidraw/scene";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

import { actionLink } from "../actions/actionLink";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { getContextMenuLabel } from "../components/hyperlink/common";
import { CaliburnIconButtonComponent } from "../components/icon-button.component";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Angular port of upstream `actionLink`'s `PanelComponent`
 * (`actionLink.tsx`) — the styles panel's "Actions" row link toggle, lit up
 * while the single selected element carries a link.
 */
@Component({
  selector: "caliburn-hyperlink-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./hyperlink-button.component.html",
})
export class CaliburnHyperlinkButtonComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  private elements() {
    return this.host.scene.getElementsIncludingDeleted();
  }

  protected ariaLabel() {
    const editor = this.host;
    editor.changeGeneration();
    return t(
      getContextMenuLabel(
        getNonDeletedElements(this.elements()),
        editor.state,
      ) as unknown as TranslationKeys,
    );
  }

  protected title() {
    const editor = this.host;
    editor.changeGeneration();
    return `${
      isEmbeddableElement(this.elements()[0])
        ? t("labels.link.labelEmbed")
        : t("labels.link.label")
    } - ${getShortcutKey("CtrlOrCmd+K")}`;
  }

  protected checked() {
    const editor = this.host;
    editor.changeGeneration();
    const selectedElements = getSelectedElements(this.elements(), editor.state);
    return selectedElements.length === 1 && !!selectedElements[0].link;
  }

  protected execute() {
    this.host.actionManager.executeAction(actionLink, "ui");
  }
}
