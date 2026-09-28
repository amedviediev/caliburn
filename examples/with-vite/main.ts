import "@excalidraw/excalidraw/css/app.scss";
import "@excalidraw/excalidraw/css/styles.scss";
import "@excalidraw/excalidraw/fonts/fonts.css";

import { Component, provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";

import { convertToExcalidrawElements } from "@excalidraw/element";

import "../../packages/caliburn/src/styles.scss";

import { CaliburnEditorComponent } from "../../packages/caliburn/src/index";

// Resolve runtime-loaded assets relative to the demo's deployment URL.
(window as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = new URL(
  import.meta.env.BASE_URL,
  window.location.href,
).href;

const initialData = {
  elements: convertToExcalidrawElements([
    {
      type: "text",
      x: 180,
      y: 80,
      fontSize: 28,
      text: "Caliburn",
    },
    {
      type: "rectangle",
      x: 140,
      y: 160,
      width: 200,
      height: 120,
      backgroundColor: "#a5d8ff",
      label: { text: "drag me" },
    },
    {
      type: "ellipse",
      x: 480,
      y: 340,
      width: 180,
      height: 120,
      backgroundColor: "#b2f2bb",
    },
    {
      type: "arrow",
      x: 360,
      y: 250,
      width: 110,
      height: 100,
    },
  ]),
};

@Component({
  selector: "demo-root",
  imports: [CaliburnEditorComponent],
  templateUrl: "./demo-root.component.html",
})
class DemoRoot {
  readonly initialData = initialData;
}

bootstrapApplication(DemoRoot, {
  providers: [provideZonelessChangeDetection()],
}).catch((error) => console.error(error));
