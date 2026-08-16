import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
} from "@angular/core";

import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
} from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";

import { THEME } from "@excalidraw/common";

import { mermaidLite } from "@excalidraw/excalidraw/components/TTDDialog/mermaid-lang-lite";

import type { Theme } from "@excalidraw/element/types";

import type { Extension } from "@codemirror/state";

import type { OnDestroy } from "@angular/core";

// ---- Dark theme ----

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#1e1e1e",
      color: "#d4d4d4",
    },
    ".cm-content": { caretColor: "#fff" },
    ".cm-cursor": { borderLeftColor: "#fff" },
    ".cm-gutters": {
      backgroundColor: "#1e1e1e",
      color: "#858585",
      border: "none",
    },
    ".cm-activeLineGutter": { backgroundColor: "#2a2a2a" },
    ".cm-activeLine": { backgroundColor: "#2a2a2a" },
    ".cm-errorLine": { backgroundColor: "rgba(255, 0, 0, 0.15)" },
  },
  { dark: true },
);

const darkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#569cd6" },
  { tag: tags.string, color: "#ce9178" },
  { tag: tags.comment, color: "#6a9955" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: tags.operator, color: "#d4d4d4" },
  { tag: tags.punctuation, color: "#d4d4d4" },
  { tag: tags.variableName, color: "#9cdcfe" },
  { tag: tags.bracket, color: "#ffd700" },
]);

// ---- Light theme ----

const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#1e1e1e",
  },
  ".cm-content": { caretColor: "#000" },
  ".cm-cursor": { borderLeftColor: "#000" },
  ".cm-gutters": {
    backgroundColor: "#fff",
    color: "#999",
    border: "none",
  },
  ".cm-activeLineGutter": { backgroundColor: "#e8e8e8" },
  ".cm-activeLine": { backgroundColor: "#e8e8e8" },
  ".cm-errorLine": { backgroundColor: "rgba(255, 0, 0, 0.1)" },
});

const lightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#0000ff" },
  { tag: tags.string, color: "#a31515" },
  { tag: tags.comment, color: "#008000" },
  { tag: tags.number, color: "#098658" },
  { tag: tags.operator, color: "#1e1e1e" },
  { tag: tags.punctuation, color: "#1e1e1e" },
  { tag: tags.variableName, color: "#001080" },
  { tag: tags.bracket, color: "#af00db" },
]);

// ---- Error line decoration ----

const errorLineDeco = Decoration.line({ class: "cm-errorLine" });

/**
 * Upstream freezes the decoration against the document it read the line from
 * (`EditorView.decorations.of(Decoration.set([…]))`) and only recomputes it
 * when `errorLine` changes. That set is a static facet value, so it is
 * re-applied verbatim to every later document: shrink the document below the
 * decorated position before the compartment is reconfigured — select-all plus
 * delete while a parse error is showing does it — and CodeMirror throws
 * `RangeError: Position N is out of range for changeset of length M`.
 * `decorations.compute(["doc"], …)` is the same decoration, recomputed from
 * whichever document is current, so it can never be stale. The guards, the
 * class and the resulting DOM are upstream's.
 */
const getErrorLineExtension = (
  errorLine: number | null | undefined,
): Extension => {
  if (!errorLine || errorLine < 1) {
    return EditorView.decorations.of(Decoration.none);
  }
  return EditorView.decorations.compute(["doc"], (state) => {
    if (errorLine > state.doc.lines) {
      return Decoration.none;
    }
    return Decoration.set([
      errorLineDeco.range(state.doc.line(errorLine).from),
    ]);
  });
};

// ---- Helpers ----

const getThemeExtensions = (theme: Theme) => {
  if (theme === THEME.DARK) {
    return [darkTheme, syntaxHighlighting(darkHighlight)];
  }
  return [lightTheme, syntaxHighlighting(lightHighlight)];
};

/**
 * Angular port of upstream `TTDDialog/CodeMirrorEditor.tsx`. Everything below
 * the component — the two `EditorView.theme` palettes, the two
 * `HighlightStyle`s, the error-line decoration and the extension list — is
 * upstream's verbatim: `@codemirror/{view,state,commands,language}` and
 * `@lezer/highlight` are plain DOM libraries with no framework in them, and
 * the mermaid stream parser is imported straight from vendored
 * `TTDDialog/mermaid-lang-lite.ts` rather than re-typed.
 *
 * Only the React shell is translated:
 *
 * - upstream's three `useRef` compartments become plain fields, and its four
 *   `useEffect`s become `afterNextRender` (mount) plus three `effect()`s
 *   (theme, error line, external value), each guarding on the view existing
 *   the way upstream's guard on `viewRef.current` does;
 * - upstream renders `<div className="ttd-dialog-input
 *   ttd-dialog-input--codemirror">` and mounts into it; caliburn puts the same
 *   two classes on the component host and mounts into that, so the rendered
 *   DOM is the same single styled element (a custom-element tag rather than a
 *   `div`, so `styles.scss` gives it the `display: block` a `div` has by
 *   default). Its template file is therefore empty — the host element is the
 *   whole render;
 * - the `onChange`/`onKeyboardSubmit` props become `valueChange`/
 *   `keyboardSubmit` outputs. Upstream keeps them in refs so the mount effect
 *   never re-runs; Angular outputs are stable identities, so the extension
 *   list can call them directly.
 * - `theme === "dark"` is written as `THEME.DARK`, the constant upstream's own
 *   `Theme` type is built from.
 */
@Component({
  selector: "caliburn-code-mirror-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "ttd-dialog-input ttd-dialog-input--codemirror",
  },
  templateUrl: "./code-mirror-editor.component.html",
})
export class CaliburnCodeMirrorEditorComponent implements OnDestroy {
  readonly value = input("");
  readonly placeholder = input<string>();
  readonly theme = input<Theme>(THEME.LIGHT);
  readonly errorLine = input<number | null>(null);

  readonly valueChange = output<string>();
  readonly keyboardSubmit = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly themeCompartment = new Compartment();
  private readonly errorLineCompartment = new Compartment();
  private view: EditorView | null = null;

  constructor() {
    afterNextRender(() => this.mount());

    // swap theme dynamically via compartment
    effect(() => {
      const theme = this.theme();
      this.view?.dispatch({
        effects: this.themeCompartment.reconfigure(getThemeExtensions(theme)),
      });
    });

    // update error line highlight
    effect(() => {
      const errorLine = this.errorLine();
      this.applyErrorLine(errorLine);
    });

    // sync external value changes into EditorView
    effect(() => {
      const value = this.value();
      const view = this.view;
      if (!view) {
        return;
      }
      const currentDoc = view.state.doc.toString();
      if (value !== currentDoc) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: value },
        });
      }
    });
  }

  ngOnDestroy() {
    this.view?.destroy();
    this.view = null;
  }

  private mount() {
    const placeholder = this.placeholder();

    const view = new EditorView({
      state: EditorState.create({
        doc: this.value(),
        extensions: [
          keymap.of([
            {
              key: "Mod-Enter",
              run: () => {
                this.keyboardSubmit.emit();
                return true;
              },
            },
            // historyKeymap binds Mod-Shift-z only on Mac; add it for all platforms
            { key: "Mod-Shift-z", run: redo, preventDefault: true },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.valueChange.emit(update.state.doc.toString());
            }
          }),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          lineNumbers(),
          EditorView.lineWrapping,
          this.themeCompartment.of(getThemeExtensions(this.theme())),
          this.errorLineCompartment.of([]),
          mermaidLite(),
          drawSelection({ drawRangeCursor: true }),
          ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        ],
      }),
      parent: this.host.nativeElement,
    });

    this.view = view;
    // upstream's error-line `useEffect` runs on mount too, so an editor that
    // opens onto an already-failing definition is decorated straight away
    this.applyErrorLine(this.errorLine());
    view.focus();
  }

  private applyErrorLine(errorLine: number | null) {
    const view = this.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: this.errorLineCompartment.reconfigure(
        getErrorLineExtension(errorLine),
      ),
    });
  }
}
