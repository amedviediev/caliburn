# Styles Panel and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Excalidraw's scrollable desktop styles card and make the GitHub test workflow resource-safe without concealing known flakes.

**Architecture:** The Angular `LayerUI` template will reproduce upstream's semantic section and Island hierarchy, letting the existing upstream SCSS provide card, overflow, and stacking behavior. CI will isolate the three existing Vitest workspace projects in a matrix and cap worker concurrency.

**Tech Stack:** Angular 22 templates, Excalidraw SCSS, Vitest 3, GitHub Actions, Vite.

**Spec:** `docs/superpowers/specs/2026-08-18-styles-panel-and-ci.md`

## Global Constraints

- Work directly on `master` as requested.
- Keep known flakes visible; do not skip them or use `continue-on-error`.
- Mirror upstream structure and CSS rather than adding Caliburn-only layout rules.
- Keep npm package version `0.18.0` unchanged.

---

### Task 1: Styles panel regression

**Files:**

- Modify: `packages/caliburn/tests/editorInterface.test.tsx`
- Modify: `packages/caliburn/src/components/layer-ui.component.ts`
- Modify: `packages/caliburn/src/components/layer-ui.component.html`

**Interfaces:**

- Consumes: `shouldRenderSelectedShapeActions`, `CaliburnIslandComponent`, and `CaliburnSectionComponent`.
- Produces: `.selected-shape-actions > .Island.App-menu__left` in full mode and `.selected-shape-actions > .Island.compact-shape-actions-island` in compact mode.

- [ ] Add a full-mode test that selects a rectangle and expects the semantic section, Island classes, padding, viewport attributes, and `634px` max-height for an `800px` editor.
- [ ] Run the focused test and confirm it fails because `.Island.App-menu__left` is absent.
- [ ] Import the Island and Section components and mirror upstream's guarded full/compact template branches.
- [ ] Run the focused test and the existing styles-panel viewport tests and confirm they pass.

### Task 2: Menu stacking regression

**Files:**

- Modify: `packages/caliburn/tests/menusAndDialogs.test.tsx`
- Modify only if evidence requires it: `packages/caliburn/src/components/dropdown-menu/dropdown-menu-content.component.html`

**Interfaces:**

- Consumes: `.main-menu` and the existing `--zIndex-ui-main-menu` CSS token.
- Produces: a fixed-position dropdown surface that paints above the selected-shape Island.

- [ ] Add a DOM assertion that the opened main menu is the fixed dropdown surface and carries the `main-menu` stacking class.
- [ ] Run the focused test; if it already passes, retain it as coverage and rely on the restored upstream panel hierarchy rather than adding redundant CSS.
- [ ] Verify the overlap in a real browser and change dropdown markup only if computed stacking evidence still shows a defect.

### Task 3: Resource-safe GitHub tests

**Files:**

- Modify: `.github/workflows/test.yml`

**Interfaces:**

- Consumes: Vitest project names `editor`, `caliburn`, and `caliburn-app` from the workspace configuration.
- Produces: one GitHub Actions matrix job per project with `--maxWorkers=2`.

- [ ] Replace the combined `yarn test:app` step with a project matrix and `yarn vitest run --project "${{ matrix.project }}" --maxWorkers=2`.
- [ ] Keep failures blocking and preserve all three projects.
- [ ] Validate the workflow syntax and run release-project tests locally with the same worker cap.

### Task 4: Release verification and deployment

**Files:**

- Verify: `packages/caliburn/src/**`, `caliburn-app/**`, `.github/workflows/**`

**Interfaces:**

- Consumes: repository scripts `build:caliburn`, `demo:build`, test projects, and Pages workflow.
- Produces: a pushed `master` commit and verified live demo.

- [ ] Run formatting checks, focused regressions, `yarn build:caliburn`, and `yarn demo:build`.
- [ ] Start the local demo and verify card scrolling and menu overlap in a browser at desktop dimensions.
- [ ] Commit and push the scoped changes to `master`.
- [ ] Wait for Tests and Pages workflows, inspect any failure, and verify `https://amedviediev.github.io/caliburn/` after deployment.
