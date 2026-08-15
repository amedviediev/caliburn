import "@excalidraw/excalidraw/css/app.scss";
import "@excalidraw/excalidraw/css/styles.scss";

import "../../packages/caliburn/src/styles.scss";

import "./index.scss";

import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import polyfill from "@excalidraw/excalidraw/polyfill";

import { CaliburnAppComponent } from "./app.component";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

// resolve font assets against the dev server rather than the npm CDN
(window as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH =
  window.origin;

bootstrapApplication(CaliburnAppComponent, {
  providers: [provideZonelessChangeDetection()],
}).catch((error) => console.error(error));
