import { CaptureUpdateAction } from "@excalidraw/element";

import { invariant } from "@excalidraw/common";

import type { Collaborator } from "@excalidraw/excalidraw/types";

import { register } from "./register";

import type { CaliburnEditorComponent } from "../editor.component";

/**
 * Port of upstream `actionNavigate.tsx`'s `actionGoToCollaborator`, minus its
 * `PanelComponent` — caliburn's action manager has no `renderAction`, so the
 * avatar/row markup lives in `user-list-collaborator.component.ts`, which
 * executes this action in place of upstream's `updateData`.
 *
 * `app.props.userToFollow` is `app.userToFollow()` here: caliburn's props are
 * signal inputs read live, not the per-render `props` snapshot upstream's
 * `AppClassProperties` exposes.
 */
export const actionGoToCollaborator = register<Collaborator>({
  name: "goToCollaborator",
  label: "Go to a collaborator",
  viewMode: true,
  trackEvent: { category: "collab" },
  perform: (_elements, appState, collaborator, app) => {
    invariant(
      collaborator,
      "actionGoToCollaborator: collaborator should be defined when actionGoToCollaborator is called",
    );

    const userToFollow = (
      app as unknown as CaliburnEditorComponent
    ).userToFollow();

    if (
      !collaborator.socketId ||
      userToFollow?.socketId === collaborator.socketId ||
      collaborator.isCurrentUser
    ) {
      app.requestUnfollow();
      return {
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    app.emitUserFollowIntent({
      userToFollow: {
        socketId: collaborator.socketId,
        username: collaborator.username || "",
      },
      action: "FOLLOW",
    });

    return {
      appState: {
        ...appState,
        // Close mobile menu
        openMenu: appState.openMenu === "canvas" ? null : appState.openMenu,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
