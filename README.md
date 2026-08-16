# Caliburn

Caliburn is an Angular port of [Excalidraw](https://github.com/excalidraw/excalidraw). It keeps Excalidraw's element model, geometry engine and `.excalidraw` file format, and replaces the React UI with Angular. Forked at [`abeeaeb`](https://github.com/excalidraw/excalidraw/commit/abeeaeba217ab3b5193b78c8d8d63c373b518ced). Not affiliated with the Excalidraw team.

The name is Excalibur's older form — Latin _Caliburnus_, from the Welsh _Caledfwlch_.

## Status

The editor's full chrome is ported: toolbar, properties panel, context menu, main menu, command palette, search, library, stats panel, lasso selection, hyperlink and image/JSON export dialogs, the welcome screen, and the text-to-diagram (Mermaid) dialog — each driven by the upstream tests that gate it. `packages/caliburn` is the Angular editor package (Angular 22, zoneless), vendoring Excalidraw's element model, geometry engine and canvas renderers unchanged behind an Angular UI. Nothing is published to npm yet; the planned package name is `ngx-caliburn`.

`caliburn-app` (`yarn start`) is the Angular port of excalidraw.com's free app: local persistence, the language selector (i18n), live collaboration, shareable links, the library, the command palette, search, and the Mermaid-to-Excalidraw dialog. Excalidraw+ (Pro) surfaces and the analytics scripts are not part of the port. A framework-agnostic demo lives at `examples/with-vite` (`yarn demo`), embedding the editor full-screen with no app chrome around it.

The full workspace suite passes: 2,648 tests passed, 90 skipped (upstream's own skips), 1 todo, 0 failed, across 181 test files (`yarn vitest run`).

Known gaps:

- **Mobile chrome is unported.** `editorInterface.formFactor` is hardcoded to `"desktop"` and `userAgent.isMobileDevice` to `false` (`packages/caliburn/src/editor.component.ts`). The `formFactor === "phone"` branches scattered through the toolbar, dialogs and menus exist, mirroring upstream, but are unreachable — nothing ever sets `formFactor` to `"phone"`.
- **Collaboration presence is verified against a protocol stand-in, not the production room server.** `excalidraw-room` isn't published to npm and Docker wasn't available during development, so the live two-client collaboration smoke test (remote cursors, selections, the user list, follow mode) ran against a stand-in server speaking the same socket protocol, not excalidraw.com's actual room server.
- **The Mermaid dialog's text input is a textarea, not CodeMirror.** Upstream lazily imports a `CodeMirrorEditor`; that import isn't ported, so the dialog always renders the same textarea fallback upstream itself falls back to when the CodeMirror chunk fails to load, including the loss of CodeMirror's error-line decoration.
- **Image crop's "move region" drag is unported.** Dragging a resize handle on a cropped image works; dragging inside the crop region to pan the underlying image without resizing the frame does not — `maybeHandleCrop` (`packages/caliburn/src/crop-interaction.ts`) requires a transform handle.
- **`setPointerCapture` is never called.** Upstream captures the pointer to the canvas on pointer-down so a drag never reports a foreign target; Caliburn doesn't, so an off-canvas move can land on a toolbar `<svg>`. The pointer-session code compensates with a widened `instanceof Element` guard instead of porting capture itself.
- **The `ui` prop doesn't exist.** Upstream's `<Excalidraw ui={...}>`, for hiding UI regions, was never implemented — the fan-out (13+ call sites in `App.tsx`, 20+ in `LayerUI`) is past what a mechanical port covers. Caliburn's chrome behaves as if `ui` were always the default, fully-shown value; a host that needs to hide regions can't yet.
- **A class of chrome labels resolve their language once, at construction, not reactively.** `LayerUI`'s `scrollBackToContentLabel` (and siblings like `welcomeScreenHeading`) call `t()` in a field initializer. `caliburn-app` papers over this for its own top-level labels with `computed()` wrappers, and forces a full editor remount on language change (flipping between two branches of the same template) so the rest refresh incidentally — but the editor package itself has no mechanism to update these labels without a remount.

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
