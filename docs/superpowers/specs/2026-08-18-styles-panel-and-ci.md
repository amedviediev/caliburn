# Styles Panel and CI Design

The desktop selected-shape controls must mirror Excalidraw's `LayerUI.tsx` structure. The controls render only when `showSelectedShapeActions()` is true, inside the upstream `Section` and `Island` primitives. The full panel uses the `App-menu__left` class, padding `2`, and a maximum height of `appState.height - 166` pixels; the compact panel uses `compact-shape-actions-island`, padding `0`, and the same maximum height. This reuses upstream card, scrolling, and stacking CSS instead of adding a Caliburn override.

The GitHub test workflow must keep all three Vitest projects visible while avoiding the single-process, all-project run that exhausted GitHub runner workers. Run `editor`, `caliburn`, and `caliburn-app` in separate matrix jobs with at most two workers per job. Known intermittent failures remain reported honestly; they are not skipped or converted to successful failures.

Verification includes focused DOM regression tests, the Caliburn build and demo build, project-level tests, a local browser check of panel scrolling and menu stacking, and post-push verification of GitHub Actions and Pages.
