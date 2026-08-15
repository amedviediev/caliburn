export { CaliburnEditorComponent } from "./editor.component";
export type { CaliburnImperativeAPI } from "./editor.component";
export { createTestHook, h } from "./test-hook";
export type { TestHandle } from "./test-hook";

export interface ExcalidrawCompatProps {
  handleKeyboardGlobally?: boolean;
  onExcalidrawAPI?: (api: any) => void;
  [key: string]: unknown;
}

/**
 * JSX-compat shim: upstream tests render `<Excalidraw ...props />`. The
 * harness never invokes this function — `render()` reads the props off the
 * created element and maps them onto the Angular component's inputs, so
 * ported test bodies keep their render call unchanged.
 */
export const Excalidraw = (_props: ExcalidrawCompatProps): null => null;
