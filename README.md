# Caliburn

Caliburn is an Angular port of [Excalidraw](https://github.com/excalidraw/excalidraw). It keeps Excalidraw's element model, geometry engine and `.excalidraw` file format, and replaces the React UI with Angular. Forked at [`abeeaeb`](https://github.com/excalidraw/excalidraw/commit/abeeaeba217ab3b5193b78c8d8d63c373b518ced). Not affiliated with the Excalidraw team.

The name is Excalibur's older form — Latin _Caliburnus_, from the Welsh _Caledfwlch_.

## Status

The port is at its beginning. What is in this repository today is Excalidraw's source at the pinned commit, being cut down and translated in the order below. Nothing is published to npm yet; the planned package name is `caliburn-ng`.

- [x] Repository setup: README, license, brand assets, font licenses
- [x] Delete the React code that will never be used; measure what remains — after the cut, the editor package holds 44,408 lines of `.tsx` and 30,462 lines of `.ts` outside tests, and 1,733 upstream tests still pass
- [ ] Port the test harness so the upstream test suite drives the port
- [ ] Port the editor in slices: selection and viewport; rectangle, ellipse, diamond; arrows and binding; text; freehand; images, frames and groups

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
