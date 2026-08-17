import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
} from "@angular/core";

import { getNonDeletedElements } from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";
import { isSomeElementSelected } from "@excalidraw/excalidraw/scene";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import type { Action } from "@excalidraw/excalidraw/actions/types";

import {
  actionAlignBottom,
  actionAlignHorizontallyCentered,
  actionAlignLeft,
  actionAlignRight,
  actionAlignTop,
  actionAlignVerticallyCentered,
  alignActionsPredicate,
} from "../actions/actionAlign";
import {
  distributeHorizontally,
  distributeVertically,
  enableActionGroup,
} from "../actions/actionDistribute";

import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnIconButtonComponent } from "../components/icon-button.component";

import { translated } from "../i18n";

import type { CaliburnEditorComponent } from "../editor.component";

interface AlignOption {
  action: Action;
  icon: string;
  /** upstream's `aria-label` — the plain label */
  text: string;
  /** upstream's `title` — the label plus the shortcut, where it has one */
  title: string;
}

/**
 * Angular port of upstream `Actions.tsx`'s `AlignFieldset` together with the
 * `PanelComponent`s it renders (`actionAlign.tsx`, `actionDistribute.tsx`):
 * the align row is mirrored for RTL so the leftmost button always aligns
 * left, and every button carries upstream's `hidden` (the align/distribute
 * predicate) and `visible` (some element selected) pair.
 */
@Component({
  selector: "caliburn-align-fieldset",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnIconButtonComponent],
  templateUrl: "./align-fieldset.component.html",
})
export class CaliburnAlignFieldsetComponent {
  private readonly host = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly showDistribute = input.required<boolean>();

  protected readonly legend = translated(() => t("labels.align"));

  private readonly alignLeftOption = translated(() => ({
    action: actionAlignLeft,
    icon: "alignLeftIcon",
    text: t("labels.alignLeft"),
    title: `${t("labels.alignLeft")} — ${getShortcutKey(
      "CtrlOrCmd+Shift+Left",
    )}`,
  }));

  private readonly alignHorizontallyCenteredOption = translated(() => ({
    action: actionAlignHorizontallyCentered,
    icon: "centerHorizontallyIcon",
    text: t("labels.centerHorizontally"),
    title: t("labels.centerHorizontally"),
  }));

  private readonly alignRightOption = translated(() => ({
    action: actionAlignRight,
    icon: "alignRightIcon",
    text: t("labels.alignRight"),
    title: `${t("labels.alignRight")} — ${getShortcutKey(
      "CtrlOrCmd+Shift+Right",
    )}`,
  }));

  protected readonly verticalOptions = translated<AlignOption[]>(() => [
    {
      action: actionAlignTop,
      icon: "alignTopIcon",
      text: t("labels.alignTop"),
      title: `${t("labels.alignTop")} — ${getShortcutKey(
        "CtrlOrCmd+Shift+Up",
      )}`,
    },
    {
      action: actionAlignVerticallyCentered,
      icon: "centerVerticallyIcon",
      text: t("labels.centerVertically"),
      title: t("labels.centerVertically"),
    },
    {
      action: actionAlignBottom,
      icon: "alignBottomIcon",
      text: t("labels.alignBottom"),
      title: `${t("labels.alignBottom")} — ${getShortcutKey(
        "CtrlOrCmd+Shift+Down",
      )}`,
    },
  ]);

  protected readonly distributeHorizontallyOption = translated<AlignOption>(
    () => ({
      action: distributeHorizontally,
      icon: "distributeHorizontallyIcon",
      text: t("labels.distributeHorizontally"),
      title: `${t("labels.distributeHorizontally")} — ${getShortcutKey(
        "Alt+H",
      )}`,
    }),
  );

  protected readonly distributeVerticallyOption = translated<AlignOption>(
    () => ({
      action: distributeVertically,
      icon: "distributeVerticallyIcon",
      text: t("labels.distributeVertically"),
      title: `${t("labels.distributeVertically")} — ${getShortcutKey("Alt+V")}`,
    }),
  );

  /** upstream mirrors the row for RTL so the leftmost button aligns left */
  protected horizontalOptions(): AlignOption[] {
    const isRTL = document.documentElement.getAttribute("dir") === "rtl";

    return isRTL
      ? [
          this.alignRightOption(),
          this.alignHorizontallyCenteredOption(),
          this.alignLeftOption(),
        ]
      : [
          this.alignLeftOption(),
          this.alignHorizontallyCenteredOption(),
          this.alignRightOption(),
        ];
  }

  protected alignHidden() {
    const editor = this.host;
    editor.changeGeneration();
    return !alignActionsPredicate(editor.state, editor as any);
  }

  protected distributeHidden() {
    const editor = this.host;
    editor.changeGeneration();
    return !enableActionGroup(editor.state, editor as any);
  }

  protected visible() {
    const editor = this.host;
    editor.changeGeneration();
    return isSomeElementSelected(
      getNonDeletedElements(editor.scene.getElementsIncludingDeleted()),
      editor.state,
    );
  }

  protected execute(action: Action) {
    this.host.actionManager.executeAction(action, "ui");
  }
}
