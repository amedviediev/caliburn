import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { NgIcon } from "@ng-icons/core";

import { EVENT, KEYS, supportsResizeObserver } from "@excalidraw/common";

import { t } from "@excalidraw/excalidraw/i18n";

import type { Collaborator, SocketId } from "@excalidraw/excalidraw/types";

import { translated } from "../i18n";

import { provideCaliburnIcons } from "./icons";
import { CaliburnIslandComponent } from "./island.component";
import { CaliburnQuickSearchComponent } from "./quick-search.component";
import { CaliburnScrollableListComponent } from "./scrollable-list.component";
import { CaliburnTooltipComponent } from "./tooltip.component";
import { CaliburnUserListCollaboratorComponent } from "./user-list-collaborator.component";

import type { AfterViewInit, OnDestroy, TemplateRef } from "@angular/core";

const DEFAULT_MAX_AVATARS = 4;
const SHOW_COLLABORATORS_FILTER_AT = 8;

// avatar (28px) + gap (10px)
const AVATAR_SLOT_WIDTH = 38;
// the current user's pill (avatar + chevron + its own padding/border) is
// wider than a plain avatar — reserving this extra width for it keeps it
// from ever being the item that tips the row over and wraps onto its own
// line (chevron 15px + pill's right padding 4px + pill's border 2px)
const PILL_EXTRA_WIDTH = 21;
/** upstream's Radix placement for the dropdown: `align="end" sideOffset={10}` */
const POPOVER_SIDE_OFFSET = 10;

type UserListCollaborator = Collaborator & { socketId: SocketId };

/**
 * Angular port of upstream `UserList.tsx` — the top-right collaborator
 * avatars plus the current user's pill, which opens the "who's here"
 * dropdown. Host-bound so the rendered DOM is exactly upstream's
 * `.UserList__wrapper` (the element the ResizeObserver measures).
 *
 * Two upstream surfaces are left out rather than stubbed: the `mobile`
 * layout (caliburn's LayerUI ports the desktop layout only) and the
 * `React.memo` comparator (OnPush + signals cover it). Radix's `Popover`
 * becomes an inline island with explicit outside-pointerdown / Escape
 * dismissal, the same substitution `properties-popover.component.ts` makes;
 * Radix's decorative `Popover.Arrow` is omitted with it.
 */
@Component({
  selector: "caliburn-user-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CaliburnIslandComponent,
    CaliburnQuickSearchComponent,
    CaliburnScrollableListComponent,
    CaliburnTooltipComponent,
    CaliburnUserListCollaboratorComponent,
    NgIcon,
    NgTemplateOutlet,
  ],
  providers: [provideCaliburnIcons()],
  host: {
    class: "UserList__wrapper",
  },
  templateUrl: "./user-list.component.html",
})
export class CaliburnUserListComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly collaborators = input.required<Map<SocketId, Collaborator>>();
  readonly userToFollow = input<SocketId | null>(null);
  readonly currentUserControls = input<TemplateRef<unknown> | null>(null);

  protected readonly showCollaboratorsFilterAt = SHOW_COLLABORATORS_FILTER_AT;
  protected readonly searchPlaceholder = translated(() =>
    t("quickSearch.placeholder"),
  );
  protected readonly emptyLabel = translated(() => t("userList.empty"));
  protected readonly hintText = translated(() => t("userList.hint.text"));
  protected readonly unknownUserLabel = "Unknown user";

  protected readonly searchTerm = signal("");
  protected readonly isOpen = signal(false);
  /** Radix places the dropdown for upstream (`align="end" sideOffset={10}`);
   * caliburn measures the pill and positions it the same way */
  protected readonly popoverTop = signal(0);
  protected readonly popoverRight = signal(0);

  private resizeObserver: ResizeObserver | null = null;

  protected readonly wrapperWidth = signal(
    DEFAULT_MAX_AVATARS * AVATAR_SLOT_WIDTH,
  );

  protected readonly collaboratorsArray = computed<UserListCollaborator[]>(() =>
    Array.from(this.collaborators(), ([socketId, collaborator]) => ({
      ...collaborator,
      socketId,
    })).filter((collaborator) => collaborator.username?.trim()),
  );

  protected readonly currentUser = computed(() =>
    this.collaboratorsArray().find((c) => c.isCurrentUser),
  );

  protected readonly filteredCollaborators = computed(() =>
    this.collaboratorsArray().filter((collaborator) =>
      collaborator.username?.toLowerCase().includes(this.searchTerm()),
    ),
  );

  /**
   * The avatars that fit the row. The current user's avatar is always shown,
   * reserved as the last slot — it's the single entry point for the
   * collaborators + currentUserControls dropdown, so it's never hidden
   * by/counted in overflow. Its width (wider than a plain avatar) is carved
   * out of the available width up front so it always shares a row with the
   * other avatars — if there's only room for the pill itself, it renders
   * alone rather than wrapping onto its own line.
   */
  protected readonly firstNCollaborators = computed<UserListCollaborator[]>(
    () => {
      const currentUser = this.currentUser();
      const otherCollaborators = this.collaboratorsArray().filter(
        (c) => !c.isCurrentUser,
      );

      const availableWidth = currentUser
        ? this.wrapperWidth() - PILL_EXTRA_WIDTH
        : this.wrapperWidth();
      const totalSlots = Math.max(
        1,
        Math.min(8, Math.floor(availableWidth / AVATAR_SLOT_WIDTH)),
      );
      const otherSlots = currentUser ? Math.max(0, totalSlots - 1) : totalSlots;
      const visibleOthers = otherCollaborators.slice(0, otherSlots);

      return currentUser ? [...visibleOthers, currentUser] : visibleOthers;
    },
  );

  protected readonly maxAvatars = computed(
    () =>
      this.firstNCollaborators().length +
      (this.currentUser() ? PILL_EXTRA_WIDTH / AVATAR_SLOT_WIDTH : 0),
  );

  ngAfterViewInit() {
    const wrapper = this.host.nativeElement;
    this.wrapperWidth.set(wrapper.clientWidth);

    if (!supportsResizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.wrapperWidth.set(entry.contentRect.width);
      }
    });
    this.resizeObserver.observe(wrapper);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.detachDismissListeners();
  }

  protected onSearchTermChange(term: string) {
    this.searchTerm.set(term);
  }

  protected togglePill(event: MouseEvent) {
    if (this.isOpen()) {
      this.close();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.popoverTop.set(rect.bottom + POPOVER_SIDE_OFFSET);
    this.popoverRight.set(window.innerWidth - rect.right);
    this.isOpen.set(true);
    document.addEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.addEventListener(EVENT.KEYDOWN, this.onDocKeydown, {
      capture: true,
    });
  }

  protected close() {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    this.detachDismissListeners();
  }

  private detachDismissListeners() {
    document.removeEventListener(EVENT.POINTER_DOWN, this.onDocPointerDown);
    document.removeEventListener(EVENT.KEYDOWN, this.onDocKeydown, {
      capture: true,
    });
  }

  private readonly onDocPointerDown = (event: Event) => {
    const target = event.target as Node | null;
    if (!target || !document.documentElement.contains(target)) {
      return;
    }
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    this.close();
  };

  private readonly onDocKeydown = (event: KeyboardEvent) => {
    if (event.key === KEYS.ESCAPE) {
      this.close();
    }
  };
}
