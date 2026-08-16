import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type {
  OnUserFollowedPayload,
  UserToFollow,
} from "@excalidraw/excalidraw/types";

import { CaliburnEditorComponent } from "../../src/editor.component";

import type { CaliburnViewportStatusFrame } from "../../src/components/viewport-status-frame/viewport-status-frame";

/**
 * Host app for the presence tests: upstream passes `currentUserControls` as
 * a React node prop, caliburn hands the editor the template that renders it
 * (the `currentUserControls` slot). The follow-mode props ride along so a
 * single host covers the whole surface.
 *
 * Lives in a `.ts` module rather than in the `.tsx` test file because only
 * `.ts` goes through the Angular compiler in this project.
 */
@Component({
  selector: "caliburn-test-collab-host",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CaliburnEditorComponent],
  templateUrl: "./collab-host.component.html",
})
export class CaliburnCollabHostComponent {
  readonly userToFollow = input<UserToFollow | null>(null);
  readonly onUserFollow = input<
    ((payload: OnUserFollowedPayload) => void) | null
  >(null);
  readonly viewportStatusFrame = input<CaliburnViewportStatusFrame | null>(
    null,
  );
  readonly onPointerUpdate = input<
    | ((payload: {
        pointer: { x: number; y: number; tool: "pointer" | "laser" };
        button: "down" | "up";
        pointersMap: Map<number, { x: number; y: number }>;
      }) => void)
    | null
  >(null);
}
