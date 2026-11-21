import {
  CopyPlusIcon,
  DownloadIcon,
  LayoutGridIcon,
  LinkIcon,
  PencilIcon,
  PlayIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { WatchActionId } from "@/components/watches/watch-actions";
import type { Watch } from "@/lib/ipc";

import {
  PRIMARY_KEYS,
  SECOND_KEYS,
} from "@/components/launcher/actions/menu-action";
import { watchActions } from "@/components/watches/watch-actions";

import type { RootItem } from "./root-items";

export type CatalogActionId =
  | "open-board"
  | "rename-board"
  | "duplicate-board"
  | "delete-board"
  | "run-widget"
  | "add-to-board"
  | "export-board"
  | "export-widget"
  | "copy-link"
  | WatchActionId;

export interface CatalogAction extends MenuAction {
  id: CatalogActionId;
}

export type CatalogItem = Extract<RootItem, { kind: "board" | "widget" }>;

const COPY_LINK: CatalogAction = {
  icon: LinkIcon,
  id: "copy-link",
  label: "Copy Link",
  tone: "default",
};

export const isCatalogItem = (item: RootItem | null): item is CatalogItem =>
  item?.kind === "board" || item?.kind === "widget";

export const catalogActions = (
  item: CatalogItem,
  watch: Watch | null = null
): CatalogAction[] =>
  item.kind === "board"
    ? [
        {
          icon: SquareArrowOutUpRightIcon,
          id: "open-board",
          keys: PRIMARY_KEYS,
          label: "Open",
          tone: "default",
        },
        {
          icon: PencilIcon,
          id: "rename-board",
          keys: SECOND_KEYS,
          label: "Rename",
          tone: "default",
        },
        {
          icon: CopyPlusIcon,
          id: "duplicate-board",
          label: "Duplicate",
          tone: "default",
        },
        COPY_LINK,
        {
          icon: DownloadIcon,
          id: "export-board",
          label: "Export Board",
          tone: "default",
        },
        {
          icon: Trash2Icon,
          id: "delete-board",
          label: "Delete",
          tone: "destructive",
        },
      ]
    : [
        {
          icon: PlayIcon,
          id: "run-widget",
          keys: PRIMARY_KEYS,
          label: "Run",
          tone: "default",
        },
        {
          icon: LayoutGridIcon,
          id: "add-to-board",
          keys: SECOND_KEYS,
          label: "Add to Board…",
          tone: "default",
        },
        COPY_LINK,
        {
          icon: DownloadIcon,
          id: "export-widget",
          label: "Export Widget",
          tone: "default",
        },
        ...watchActions(item.widget, watch),
      ];

export const catalogTitle = (item: CatalogItem): string =>
  item.kind === "board" ? item.board.name : item.widget.name;
