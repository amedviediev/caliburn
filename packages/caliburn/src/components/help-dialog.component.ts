import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  output,
} from "@angular/core";

import { KEYS, isDarwin, isFirefox, isWindows } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { probablySupportsClipboardBlob } from "@excalidraw/excalidraw/clipboard";
import { t } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import { NgIcon } from "@ng-icons/core";

import { actionToggleTheme } from "../actions/actionCanvas";
import { CaliburnEditorComponent as CaliburnEditorComponentToken } from "../editor.component";

import { CaliburnDialogComponent } from "./dialog.component";

import type { CaliburnEditorComponent } from "../editor.component";

type ShortcutRowSpec = {
  label: string;
  shortcuts: string[];
  isOr?: boolean;
};

type ShortcutPart = { keys: string[] } | { delim: string };

type ShortcutRow = {
  label: string;
  parts: ShortcutPart[];
};

const upperCaseSingleChars = (str: string) => {
  return str.replace(/\b[a-z]\b/, (c) => c.toUpperCase());
};

const buildRow = ({ label, shortcuts, isOr = true }: ShortcutRowSpec) => {
  const parts: ShortcutPart[] = [];
  for (const shortcut of shortcuts) {
    if (parts.length) {
      parts.push({ delim: isOr ? t("helpDialog.or") : "" });
    }
    const keys = shortcut.endsWith("++")
      ? [...shortcut.slice(0, -2).split("+"), "+"]
      : shortcut.split("+");
    parts.push({ keys: keys.map(upperCaseSingleChars) });
  }
  return { label, parts };
};

const buildRows = (specs: ShortcutRowSpec[]): ShortcutRow[] =>
  specs.map(buildRow);

/**
 * Angular port of upstream `HelpDialog.tsx`. Upstream writes the three
 * shortcut islands out as JSX; the same rows are data here (the rendered DOM
 * — `.HelpDialog__shortcut` / `.HelpDialog__key-container` / `kbd.HelpDialog__key`
 * and the "or" separators from upstream's `intersperse` — is unchanged).
 */
@Component({
  selector: "caliburn-help-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnDialogComponent, NgIcon],
  templateUrl: "./help-dialog.component.html",
})
export class CaliburnHelpDialogComponent {
  private readonly editor = inject<CaliburnEditorComponent>(
    forwardRef(() => CaliburnEditorComponentToken),
  );

  readonly close = output<void>();

  protected readonly title = t("helpDialog.title");
  protected readonly shortcutsTitle = t("helpDialog.shortcuts");
  protected readonly isMobile =
    this.editor.editorInterface.formFactor === "phone";

  protected readonly links = [
    {
      href: "https://github.com/amedviediev/caliburn",
      rel: "noopener noreferrer",
      icon: "githubIcon",
      label: t("helpDialog.github"),
    },
  ];

  private readonly toolRows = buildRows([
    { label: t("toolBar.hand"), shortcuts: [KEYS.H] },
    { label: t("toolBar.selection"), shortcuts: [KEYS.V, KEYS["1"]] },
    { label: t("toolBar.rectangle"), shortcuts: [KEYS.R, KEYS["2"]] },
    { label: t("toolBar.diamond"), shortcuts: [KEYS.D, KEYS["3"]] },
    { label: t("toolBar.ellipse"), shortcuts: [KEYS.O, KEYS["4"]] },
    { label: t("toolBar.arrow"), shortcuts: [KEYS.A, KEYS["5"]] },
    { label: t("toolBar.line"), shortcuts: [KEYS.L, KEYS["6"]] },
    { label: t("toolBar.freedraw"), shortcuts: [KEYS.P, KEYS["7"]] },
    { label: t("toolBar.text"), shortcuts: [KEYS.T, KEYS["8"]] },
    { label: t("toolBar.image"), shortcuts: [KEYS["9"]] },
    { label: t("toolBar.eraser"), shortcuts: [KEYS.E, KEYS["0"]] },
    { label: t("toolBar.frame"), shortcuts: [KEYS.F] },
    { label: t("toolBar.laser"), shortcuts: [KEYS.K] },
    { label: t("toolBar.bucketfill"), shortcuts: [KEYS.B] },
    {
      label: t("labels.eyeDropper"),
      shortcuts: [KEYS.I, "Shift+S", "Shift+G"],
    },
    {
      label: t("helpDialog.editLineArrowPoints"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Enter")],
    },
    { label: t("helpDialog.editText"), shortcuts: [getShortcutKey("Enter")] },
    {
      label: t("helpDialog.textNewLine"),
      shortcuts: [getShortcutKey("Enter"), getShortcutKey("Shift+Enter")],
    },
    {
      label: t("helpDialog.textFinish"),
      shortcuts: [getShortcutKey("Esc"), getShortcutKey("CtrlOrCmd+Enter")],
    },
    {
      label: t("helpDialog.curvedArrow"),
      shortcuts: [
        "A",
        t("helpDialog.click"),
        t("helpDialog.click"),
        t("helpDialog.click"),
      ],
      isOr: false,
    },
    {
      label: t("helpDialog.curvedLine"),
      shortcuts: [
        "L",
        t("helpDialog.click"),
        t("helpDialog.click"),
        t("helpDialog.click"),
      ],
      isOr: false,
    },
    {
      label: t("helpDialog.cropStart"),
      shortcuts: [t("helpDialog.doubleClick"), getShortcutKey("Enter")],
      isOr: true,
    },
    {
      label: t("helpDialog.cropFinish"),
      shortcuts: [getShortcutKey("Enter"), getShortcutKey("Escape")],
      isOr: true,
    },
    { label: t("toolBar.lock"), shortcuts: [KEYS.Q] },
    {
      label: t("helpDialog.preventBinding"),
      shortcuts: [getShortcutKey("CtrlOrCmd")],
    },
    { label: t("toolBar.link"), shortcuts: [getShortcutKey("CtrlOrCmd+K")] },
    {
      label: t("toolBar.convertElementType"),
      shortcuts: ["Tab", "Shift+Tab"],
      isOr: true,
    },
  ]);

  private readonly viewRows = buildRows([
    { label: t("buttons.zoomIn"), shortcuts: [getShortcutKey("CtrlOrCmd++")] },
    { label: t("buttons.zoomOut"), shortcuts: [getShortcutKey("CtrlOrCmd+-")] },
    {
      label: t("buttons.resetZoom"),
      shortcuts: [getShortcutKey("CtrlOrCmd+0")],
    },
    { label: t("helpDialog.zoomToFit"), shortcuts: ["Shift+1"] },
    { label: t("helpDialog.zoomToSelection"), shortcuts: ["Shift+2"] },
    { label: t("helpDialog.movePageUpDown"), shortcuts: ["PgUp/PgDn"] },
    {
      label: t("helpDialog.movePageLeftRight"),
      shortcuts: ["Shift+PgUp/PgDn"],
    },
    { label: t("buttons.zenMode"), shortcuts: [getShortcutKey("Alt+Z")] },
    {
      label: t("buttons.objectsSnapMode"),
      shortcuts: [getShortcutKey("Alt+S")],
    },
    {
      label: t("labels.toggleGrid"),
      shortcuts: [getShortcutKey("CtrlOrCmd+'")],
    },
    { label: t("labels.viewMode"), shortcuts: [getShortcutKey("Alt+R")] },
  ]);

  private readonly themeRow = buildRow({
    label: t("labels.toggleTheme"),
    shortcuts: [getShortcutKey("Alt+Shift+D")],
  });

  private readonly viewTrailingRows = buildRows([
    { label: t("stats.fullTitle"), shortcuts: [getShortcutKey("Alt+/")] },
    {
      label: t("search.title"),
      shortcuts: [getShortcutFromShortcutName("searchMenu")],
    },
    {
      label: t("commandPalette.title"),
      shortcuts: isFirefox
        ? [getShortcutFromShortcutName("commandPalette")]
        : [
            getShortcutFromShortcutName("commandPalette"),
            getShortcutFromShortcutName("commandPalette", 1),
          ],
    },
  ]);

  private readonly editorRows = buildRows([
    {
      label: t("helpDialog.createFlowchart"),
      shortcuts: [getShortcutKey(`CtrlOrCmd+Arrow Key`)],
      isOr: true,
    },
    {
      label: t("helpDialog.navigateFlowchart"),
      shortcuts: [getShortcutKey(`Alt+Arrow Key`)],
      isOr: true,
    },
    {
      label: t("labels.moveCanvas"),
      shortcuts: [
        getShortcutKey(`Space+${t("helpDialog.drag")}`),
        getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
      ],
      isOr: true,
    },
    {
      label: t("buttons.clearReset"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Delete")],
    },
    { label: t("labels.delete"), shortcuts: [getShortcutKey("Delete")] },
    { label: t("labels.cut"), shortcuts: [getShortcutKey("CtrlOrCmd+X")] },
    { label: t("labels.copy"), shortcuts: [getShortcutKey("CtrlOrCmd+C")] },
    { label: t("labels.paste"), shortcuts: [getShortcutKey("CtrlOrCmd+V")] },
    {
      label: t("labels.pasteAsPlaintext"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+V")],
    },
    {
      label: t("labels.selectAll"),
      shortcuts: [getShortcutKey("CtrlOrCmd+A")],
    },
    {
      label: t("labels.multiSelect"),
      shortcuts: [getShortcutKey(`Shift+${t("helpDialog.click")}`)],
    },
    {
      label: t("helpDialog.deepSelect"),
      shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)],
    },
    {
      label: t("helpDialog.deepBoxSelect"),
      shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)],
    },
  ]);

  // firefox supports clipboard API under a flag, so we'll show users what
  // they can do in the error message
  private readonly copyAsPngRow = buildRow({
    label: t("labels.copyAsPng"),
    shortcuts: [getShortcutKey("Shift+Alt+C")],
  });

  private readonly editorTrailingRows = buildRows([
    {
      label: t("labels.copyStyles"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Alt+C")],
    },
    {
      label: t("labels.pasteStyles"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Alt+V")],
    },
    {
      label: t("labels.sendToBack"),
      shortcuts: [
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+[")
          : getShortcutKey("CtrlOrCmd+Shift+["),
      ],
    },
    {
      label: t("labels.bringToFront"),
      shortcuts: [
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]"),
      ],
    },
    {
      label: t("labels.sendBackward"),
      shortcuts: [getShortcutKey("CtrlOrCmd+[")],
    },
    {
      label: t("labels.bringForward"),
      shortcuts: [getShortcutKey("CtrlOrCmd+]")],
    },
    {
      label: t("labels.alignTop"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Up")],
    },
    {
      label: t("labels.alignBottom"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Down")],
    },
    {
      label: t("labels.alignLeft"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Left")],
    },
    {
      label: t("labels.alignRight"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Right")],
    },
    {
      label: t("labels.duplicateSelection"),
      shortcuts: [
        getShortcutKey("CtrlOrCmd+D"),
        getShortcutKey(`Alt+${t("helpDialog.drag")}`),
      ],
    },
    {
      label: t("helpDialog.toggleElementLock"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+L")],
    },
    { label: t("buttons.undo"), shortcuts: [getShortcutKey("CtrlOrCmd+Z")] },
    {
      label: t("buttons.redo"),
      shortcuts: isWindows
        ? [getShortcutKey("CtrlOrCmd+Y"), getShortcutKey("CtrlOrCmd+Shift+Z")]
        : [getShortcutKey("CtrlOrCmd+Shift+Z")],
    },
    { label: t("labels.group"), shortcuts: [getShortcutKey("CtrlOrCmd+G")] },
    {
      label: t("labels.ungroup"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+G")],
    },
    {
      label: t("labels.flipHorizontal"),
      shortcuts: [getShortcutKey("Shift+H")],
    },
    { label: t("labels.flipVertical"), shortcuts: [getShortcutKey("Shift+V")] },
    { label: t("labels.showStroke"), shortcuts: [getShortcutKey("S")] },
    { label: t("labels.showBackground"), shortcuts: [getShortcutKey("G")] },
    { label: t("labels.showFonts"), shortcuts: [getShortcutKey("Shift+F")] },
    {
      label: t("labels.decreaseFontSize"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+<")],
    },
    {
      label: t("labels.increaseFontSize"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+>")],
    },
  ]);

  protected islands() {
    this.editor.changeGeneration();
    return [
      {
        className: "HelpDialog__island--tools",
        caption: t("helpDialog.tools"),
        rows: this.toolRows,
      },
      {
        className: "HelpDialog__island--view",
        caption: t("helpDialog.view"),
        rows: [
          ...this.viewRows,
          ...(this.editor.actionManager.isActionEnabled(actionToggleTheme)
            ? [this.themeRow]
            : []),
          ...this.viewTrailingRows,
        ],
      },
      {
        className: "HelpDialog__island--editor",
        caption: t("helpDialog.editor"),
        rows: [
          ...this.editorRows,
          ...(probablySupportsClipboardBlob || isFirefox
            ? [this.copyAsPngRow]
            : []),
          ...this.editorTrailingRows,
        ],
      },
    ];
  }

  protected isDelim(part: ShortcutPart): boolean {
    return "delim" in part;
  }

  protected asDelim(part: ShortcutPart): string {
    return "delim" in part ? part.delim : "";
  }

  protected asKeys(part: ShortcutPart): string[] {
    return "keys" in part ? part.keys : [];
  }
}
