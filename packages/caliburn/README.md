# Caliburn

**Caliburn** is exported as a standalone Angular component that you can embed directly in your application. It provides the Excalidraw editor experience and file format without adding React to an Angular project.

## Installation

Install the package in an Angular 22 application.

```bash
npm install ngx-caliburn
# or
yarn add ngx-caliburn
```

## Quick start

The minimum working setup has two easy-to-miss requirements:

1. Import the package CSS in your application's global stylesheet or entry point:

```ts
import "ngx-caliburn/index.css";
```

2. Render Caliburn inside a container with a non-zero height.

```ts
import { Component } from "@angular/core";
import { CaliburnEditorComponent } from "ngx-caliburn";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CaliburnEditorComponent],
  template: `
    <main class="editor-container">
      <caliburn-editor />
    </main>
  `,
  styles: `
    .editor-container {
      height: 100vh;
    }
  `,
})
export class AppComponent {}
```

Caliburn fills `100%` of its parent's width and height. If the parent has no height, the canvas will not be visible.

Caliburn is designed for zoneless Angular. Enable zoneless change detection in your application bootstrap if it is not already configured:

```ts
import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
});
```

## SSR frameworks

Caliburn uses browser canvas and DOM APIs, so render it only in the browser. For Angular SSR, gate the editor behind an `isPlatformBrowser()` check or load the containing route or component on the client.

```ts
import { isPlatformBrowser } from "@angular/common";
import { Component, inject, PLATFORM_ID } from "@angular/core";
import { CaliburnEditorComponent } from "ngx-caliburn";

@Component({
  selector: "app-editor",
  standalone: true,
  imports: [CaliburnEditorComponent],
  template: `
    @if (isBrowser) {
      <div class="editor-container">
        <caliburn-editor />
      </div>
    }
  `,
  styles: `.editor-container { height: 100vh; }`,
})
export class EditorComponent {
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
}
```

## LLM / agent tips

If an LLM or coding agent is setting up Caliburn, these shortcuts usually save more time than re-prompting:

- Start with a plain `<caliburn-editor />` in a `100vh` container. Add `initialData`, API callbacks, persistence, or custom UI only after the base embed works.
- If the canvas is blank, check the global style imports and parent height first. Those are the two most common integration failures.
- In SSR applications, assume browser-only rendering first before debugging hydration errors or missing browser globals.
- Caliburn is a standalone component. Add `CaliburnEditorComponent` directly to the host component's `imports`; no `NgModule` is required.
- Use `[initialData]` to seed a scene and `[onExcalidrawAPI]` to capture the imperative API.
- When package exports or entry points are unclear, inspect `node_modules/ngx-caliburn/package.json`; the installed package is the source of truth.
- Do not set `window.EXCALIDRAW_ASSET_PATH` unless you are intentionally self-hosting fonts or other assets.
- When documentation and generated code drift, copy the working [`examples/with-vite`](https://github.com/amedviediev/caliburn/tree/master/examples/with-vite) integration from the repository.

## Initial data and imperative API

Pass Excalidraw-compatible elements through `initialData`. The `onExcalidrawAPI` callback receives the editor API when the editor mounts and `null` when it unmounts.

```ts
import { Component } from "@angular/core";
import {
  CaliburnEditorComponent,
  type CaliburnImperativeAPI,
} from "ngx-caliburn";

@Component({
  selector: "app-editor",
  standalone: true,
  imports: [CaliburnEditorComponent],
  template: `
    <caliburn-editor
      [autoFocus]="true"
      [initialData]="initialData"
      [onExcalidrawAPI]="captureApi"
    />
  `,
})
export class EditorComponent {
  protected readonly initialData = {
    elements: [],
    appState: { viewBackgroundColor: "#f8f9fa" },
  };

  private api: CaliburnImperativeAPI | null = null;

  protected readonly captureApi = (api: CaliburnImperativeAPI | null) => {
    this.api = api;
  };
}
```

The imperative API exposes scene updates, element and file access, history, viewport controls, active-tool selection, library updates, and editor event subscriptions.

## Vendored Excalidraw subpaths

Caliburn bundles Excalidraw's core packages rather than depending on them, so the modules a host app needs for collaboration, persistence, and geometry are published as subpath entries alongside the root barrel:

| Subpath | Contents |
| --- | --- |
| `ngx-caliburn/data/reconcile` | `reconcileElements`, `shouldDiscardRemoteElement` |
| `ngx-caliburn/data/restore` | `restore*` helpers for elements, app state, and library items |
| `ngx-caliburn/data/encryption` | `encryptData`, `decryptData`, `generateEncryptionKey` |
| `ngx-caliburn/data/encode` | `compressData`, `decompressData` |
| `ngx-caliburn/data/json` | `serializeAsJSON`, `serializeLibraryAsJSON` |
| `ngx-caliburn/data/blob` | `loadFromBlob`, `getDataURL`, and related file helpers |
| `ngx-caliburn/element` | the `@excalidraw/element` barrel (`getSceneVersion`, `newElementWith`, `CaptureUpdateAction`, …) |
| `ngx-caliburn/element/types` | element type declarations |
| `ngx-caliburn/common` | the `@excalidraw/common` barrel |
| `ngx-caliburn/math` | the `@excalidraw/math` barrel |
| `ngx-caliburn/utils` | the `@excalidraw/utils` barrel (`exportToBlob`, `exportToSvg`, …) |
| `ngx-caliburn/types` | editor type declarations (`AppState`, `BinaryFiles`, …) |

```ts
import { reconcileElements } from "ngx-caliburn/data/reconcile";
import { getSceneVersion } from "ngx-caliburn/element";

import type { OrderedExcalidrawElement } from "ngx-caliburn/element/types";
import type { AppState } from "ngx-caliburn/types";
```

Each subpath is its own build entry, and the code they share with the root barrel lives in common chunks — importing both does not duplicate module state.

## Self-hosting fonts

By default, Caliburn downloads the fonts it needs from the package CDN.

To self-host them, copy the contents of `node_modules/ngx-caliburn/dist/fonts` into a public asset directory, then set `window.EXCALIDRAW_ASSET_PATH` to the URL from which that directory is served:

```html
<script>
  window.EXCALIDRAW_ASSET_PATH = "/";
</script>
```

Set this value before the editor is initialized.

## Building and publishing

The npm package is built and published from `packages/caliburn`, mirroring the upstream Excalidraw package layout. From that directory:

```bash
yarn build
npm pack --dry-run
npm publish
```

`npm publish` is the release step; the repository build and verification commands do not publish automatically.

## Demo

Run the repository's minimal Vite integration:

```bash
yarn demo
```

See [`examples/with-vite`](https://github.com/amedviediev/caliburn/tree/master/examples/with-vite) for the complete setup.

## Integration

The editor supports Excalidraw-compatible initial data, host-provided menus and UI slots, custom command-palette items, theme and interaction controls, scene persistence callbacks, embeddable validation and rendering, and live-collaboration state supplied by the host.

See the public exports in [`src/index.ts`](https://github.com/amedviediev/caliburn/blob/master/packages/caliburn/src/index.ts) and the complete app integration in [`caliburn-app`](https://github.com/amedviediev/caliburn/tree/master/caliburn-app).

## API

`CaliburnEditorComponent` is the primary public entry point. `CaliburnImperativeAPI` describes its imperative surface, while `appStateValue()` exposes selected editor state as an Angular signal for components rendered inside the editor tree.

See [`CaliburnImperativeAPI`](https://github.com/amedviediev/caliburn/blob/master/packages/caliburn/src/editor.component.ts) for the current API and [`src/index.ts`](https://github.com/amedviediev/caliburn/blob/master/packages/caliburn/src/index.ts) for all public components, utilities, and types.

## Contributing

Read the [repository README](https://github.com/amedviediev/caliburn#development) for local development and verification commands.

## License

MIT. Caliburn includes source derived from Excalidraw and retains Excalidraw's copyright notice. See the repository [license](https://github.com/amedviediev/caliburn/blob/master/LICENSE).
