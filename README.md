# Caliburn

Caliburn is a production-ready Angular port of [Excalidraw](https://github.com/excalidraw/excalidraw): a hand-drawn infinite canvas with Excalidraw's element model, geometry engine, and `.excalidraw` file format behind a native Angular UI.

[Open the live demo](https://amedviediev.github.io/caliburn/).

The port was forked at [`abeeaeb`](https://github.com/excalidraw/excalidraw/commit/abeeaeba217ab3b5193b78c8d8d63c373b518ced) and continues to track Excalidraw upstream. Caliburn is not affiliated with the Excalidraw team.

The name is Excalibur's older form - Latin _Caliburnus_, from the Welsh _Caledfwlch_.

## Highlights

- A complete Angular 22, zoneless editor exposed as a standalone component.
- Excalidraw-compatible elements, geometry, canvas rendering, and files.
- The full desktop, tablet, and mobile editor UI, including libraries, search, command palette, export, Mermaid-to-diagram, embeds, and flowcharts.
- An imperative API for scene updates and editor events, plus an Angular signal helper for reactive host integrations.
- A framework-agnostic Vite example and a complete Angular application with persistence, internationalization, collaboration, and shareable links.

## Installation

Install the Angular editor from npm:

```bash
npm install ngx-caliburn
```

See the [`ngx-caliburn` package README](packages/caliburn/README.md) for the required styles, a minimal Angular setup, and integration guidance.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`packages/caliburn`](packages/caliburn) | The publishable Angular editor package. |
| [`caliburn-app`](caliburn-app) | The Angular port of excalidraw.com's free application. |
| [`examples/with-vite`](examples/with-vite) | A minimal full-screen editor integration. |
| [`packages/element`](packages/element) | Excalidraw's vendored element model and geometry engine. |
| [`packages/common`](packages/common), [`packages/math`](packages/math), [`packages/utils`](packages/utils) | Vendored framework-independent Excalidraw packages. |

Excalidraw+ surfaces and analytics scripts are intentionally not part of this repository.

## Development

This repository uses Yarn 1 workspaces. Install dependencies and start the full application with:

```bash
yarn install
yarn start
```

Run the minimal Vite example with:

```bash
yarn demo
```

The primary verification commands are:

```bash
yarn vitest run
yarn e2e
```

## Why a port

Most of Excalidraw is not React. The element model, geometry, arrow binding, collision and export - over 40,000 lines - are plain TypeScript with no framework in them, and they come with a large test suite. Only the UI layer is React. Caliburn vendors the framework-free core unchanged and rewrites the UI layer in Angular, so Angular applications get the same element engine and the same file format without shipping React.

## How the port works

- The core packages - `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/common`, `@excalidraw/utils` - are vendored upstream source and are never edited here. That keeps `git merge upstream/main` cheap and keeps their tests passing as-is. A fix that belongs in them goes upstream as a pull request and comes back through a merge.
- The upstream test suite is the oracle. Its tests drive DOM pointer events against a canvas and assert on editor state, not on React internals, so they can gate the Angular port slice by slice.
- Geometry snapshots are never re-recorded to make a test pass. A snapshot that looks wrong is a bug to investigate, not a file to update.

Upstream is tracked as a plain Git remote:

```bash
git remote add upstream https://github.com/excalidraw/excalidraw.git
```

## Known limitations

- Collaboration presence is verified against a protocol-compatible stand-in because `excalidraw-room` is not published to npm. The live two-client smoke test covers remote cursors, selections, the user list, and follow mode, but does not run against excalidraw.com's production room server.
- Two upstream `appStateHooks.test.tsx` cases remain skipped because they measure React component renders, which have no Angular signal-graph equivalent. Their underlying behavior is covered by Caliburn's `onStateChange` and `appStateValue()` tests.

## License

MIT - see [LICENSE](LICENSE). The license retains Excalidraw's copyright notice: this repository holds Excalidraw source verbatim, Excalidraw source translated, and new code, all under the same license. `packages/laser-pointer/LICENSE` is that package's own MIT notice and stays with it.

Fonts bundled in the repository are separate works and are not covered by the code's MIT license. Every bundled family is licensed under SIL OFL 1.1 or MIT and carries its license text alongside its files. See [`packages/excalidraw/fonts`](packages/excalidraw/fonts/README.md).

## Trademark

“Excalidraw” and the Excalidraw logo belong to the Excalidraw team. The MIT license grants no trademark rights, and this project does not use the Excalidraw name or logo for branding. Excalidraw is named in prose only to credit the origin of the code.
