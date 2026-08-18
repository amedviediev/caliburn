# Caliburn

Caliburn is an Angular port of [Excalidraw](https://github.com/excalidraw/excalidraw). It keeps Excalidraw's element model, geometry engine and `.excalidraw` file format, and replaces the React UI with Angular. Forked at [`abeeaeb`](https://github.com/excalidraw/excalidraw/commit/abeeaeba217ab3b5193b78c8d8d63c373b518ced). Not affiliated with the Excalidraw team.

The name is Excalibur's older form — Latin _Caliburnus_, from the Welsh _Caledfwlch_.

## Status

The editor's full chrome is ported: the toolbar and its tools (eraser and frame included), the properties panel down to its align, distribute and arrowhead controls, context menu, main menu, command palette, search, library, stats panel, lasso selection, hyperlink and image/JSON export dialogs, the welcome screen, and the text-to-diagram (Mermaid) dialog with its lazily-loaded CodeMirror editor — each driven by the upstream tests that gate it. A stylus puts the editor into pen mode on its first touch, as upstream does. Web embeds mount as sandboxed iframes layered over the canvas — validated against upstream's own allow-list, kept out of the DOM until they scroll into view, and taking pointer events only once a centre click activates them. Ctrl/Cmd+arrow grows a flowchart out of the selected node and Alt+arrow walks it, the shortcuts the help dialog and the hint viewer advertise. The editor measures its container and picks its form factor from it, so phones get the mobile menu, the bottom toolbar and its grouped tool popovers, and tablets the compact styles panel, exactly as upstream does. A host watches editor state through the imperative API's `onStateChange` and the `appStateValue()` signal helper built on it. `packages/caliburn` is the Angular editor package (Angular 22, zoneless), vendoring Excalidraw's element model, geometry engine and canvas renderers unchanged behind an Angular UI. Nothing is published to npm yet; the planned package name is `ngx-caliburn`.

`caliburn-app` (`yarn start`) is the Angular port of excalidraw.com's free app: local persistence, the language selector (i18n), live collaboration, shareable links, the library, the command palette, search, the Mermaid-to-Excalidraw dialog, and the dev-only visual debugger. Excalidraw+ (Pro) surfaces and the analytics scripts are not part of the port. A framework-agnostic demo lives at `examples/with-vite` (`yarn demo`), embedding the editor full-screen with no app chrome around it.

The full workspace suite passes: 3,522 tests passed, 93 skipped (91 are upstream's own skips; the other 2 are gated on React render counting, itemized under Known gaps), 2 todo, 0 failed, across 246 test files (`yarn vitest run`). A real-browser interaction harness (`yarn e2e`) drives the app in Chrome with 89 strict checks, eleven of them under phone emulation (real viewport, user agent and taps). Two suites flake under load and pass on re-run: `caliburn-app/tests/presence.test.tsx` (itemized under Known gaps) and vendored upstream's own `packages/excalidraw/tests/MermaidToExcalidraw.test.tsx`, whose `.ttd-dialog-input` query can match `TTDDialogInput`'s loading spinner when the lazily-imported editor chunk takes longer than 300 ms to settle — measured at one failure in eight full-suite runs. Two e2e checks also flake under load and pass on re-run: `dialog.image-export-toggle-clickable` and `mermaid.codemirror-drives-preview`.

Known gaps:

- **Two `appStateHooks.test.tsx` cases stay skipped.** Both measure React _renders_ of a hook consumer, which has no counterpart in a signal graph. What they assert underneath is ported and covered by caliburn's own suites: `onStateChange` on the imperative API (`onStateChange.test.tsx`) and the `appStateValue()` signal helper it drives (`appStateValue.test.ts`).
- **Collaboration presence is verified against a protocol stand-in, not the production room server.** `excalidraw-room` isn't published to npm and Docker wasn't available during development, so the live two-client collaboration smoke test (remote cursors, selections, the user list, follow mode) ran against a stand-in server speaking the same socket protocol, not excalidraw.com's actual room server. `caliburn-app/tests/presence.test.tsx` additionally has two known intermittently-flaky cases — one asserting follow-mode viewport bounds, one asserting a remote idle state lands in render config — that pass on re-run.

## Why a port

Most of Excalidraw is not React. The element model, geometry, arrow binding, collision and export — over 40,000 lines — are plain TypeScript with no framework in them, and they come with a large test suite. Only the UI layer is React. Caliburn vendors the framework-free core unchanged and rewrites the UI layer in Angular, so Angular applications get the same element engine and the same file format without shipping React.

## Approach

- The core packages — `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/common`, `@excalidraw/utils` — are vendored upstream source and are never edited here. That keeps `git merge upstream/main` cheap and keeps their tests passing as-is. A fix that belongs in them goes upstream as a pull request and comes back through a merge.
- The upstream test suite is the oracle. Its tests drive DOM pointer events against a canvas and assert on editor state, not on React internals, so they can gate the Angular port slice by slice.
- Geometry snapshots are never re-recorded to make a test pass. A snapshot that looks wrong is a bug to investigate, not a file to update.

Upstream is tracked as a plain git remote:

```
git remote add upstream https://github.com/excalidraw/excalidraw.git
```

## License

MIT — see [LICENSE](LICENSE). The license retains Excalidraw's copyright notice: this repository holds Excalidraw source verbatim, Excalidraw source translated, and new code, all under the one license. `packages/laser-pointer/LICENSE` is that package's own MIT notice and stays with it.

Fonts bundled in the repository are separate works and are not covered by the code's MIT license. Every bundled family is SIL OFL 1.1 or MIT, and each carries its license text alongside its font files — see [packages/excalidraw/fonts](packages/excalidraw/fonts/README.md).

## Trademark

"Excalidraw" and the Excalidraw logo belong to the Excalidraw team. The MIT license grants no trademark rights, and this project does not use the Excalidraw name or logo for branding — Excalidraw is named in prose only, to credit the origin of the code.
