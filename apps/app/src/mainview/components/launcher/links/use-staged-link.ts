import { useCallback, useEffect, useMemo, useState } from "react";

import type { AskTarget } from "@/components/ask/use-ask";
import type { DatabaseConnection } from "@/lib/connections";
import type { ParamValues, Widget } from "@/lib/ipc";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { useWidgets } from "@/components/widgets/widgets-provider";

import type { LinkValues } from "./link-values";
import type { StagedLink, StagedLinkControls } from "./staged-link";

import { linkValues, rejectedNotice } from "./link-values";
import {
  linkAnnouncement,
  MISSING_WIDGET,
  resolveLinkConnection,
} from "./staged-link";

export const LINK_NOTICE_MS = 3000;

export interface LinkAsk {
  live: boolean;
  target: DatabaseConnection | null;
  problem: string | null;
}

interface LinkArguments {
  open: (widgetId: string, values: ParamValues) => void;
  close: () => void;
}

interface UseStagedLinkOptions {
  link: StagedLinkControls;
  linkAsk: LinkAsk;
  start: (prompt: string, target: AskTarget) => void;
  args: LinkArguments;
  selectAsk: () => void;
}

const useLinksReady = (): boolean => {
  const { state } = useConnections();
  const { status } = useWidgets();
  return state.load.status !== "loading" && status !== "loading";
};

// The staged ask lives while the input still holds exactly the link's text.
export const useLinkAsk = (
  staged: StagedLink | null,
  query: string
): LinkAsk => {
  const { state } = useConnections();
  const ready = useLinksReady();
  const live = staged?.kind === "ask" && staged.prompt === query;
  const resolved = useMemo(
    () =>
      live && ready
        ? resolveLinkConnection(staged.connection, state.connections)
        : null,
    [live, ready, staged, state.connections]
  );
  return {
    live,
    problem: resolved?.problem ?? null,
    target: resolved?.connection ?? null,
  };
};

interface WidgetLink {
  widget: Widget | null;
  values: LinkValues | null;
}

const widgetLinkOf = (
  staged: StagedLink | null,
  widgets: readonly Widget[]
): WidgetLink | null => {
  if (staged?.kind !== "widget-args") {
    return null;
  }
  const widget = widgets.find((item) => item.id === staged.widgetId) ?? null;
  return {
    values: widget ? linkValues(widget.params, staged.values) : null,
    widget,
  };
};

const stagedStatus = (
  staged: StagedLink,
  linkAsk: LinkAsk,
  widgetLink: WidgetLink | null
): string | null => {
  switch (staged.kind) {
    case "ask": {
      return linkAsk.live ? linkAsk.problem : null;
    }
    case "widget-args": {
      return widgetLink?.widget
        ? rejectedNotice(widgetLink.values?.rejected ?? [])
        : MISSING_WIDGET;
    }
    case "notice": {
      return staged.message;
    }
    default: {
      return null;
    }
  }
};

// Notices, and a link to a widget that is gone, clear themselves.
const flashNonceOf = (
  staged: StagedLink | null,
  widgetLink: WidgetLink | null
): number | null => {
  const flashes =
    staged?.kind === "notice" ||
    (widgetLink !== null && widgetLink.widget === null);
  return flashes && staged ? staged.nonce : null;
};

const useLinkFlash = (flashNonce: number | null, onDone: () => void) => {
  useEffect(() => {
    if (flashNonce === null) {
      return;
    }
    const timer = window.setTimeout(onDone, LINK_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [flashNonce, onDone]);
};

// ↵ on a staged ask for another connection switches to it first: the link
// never switches the active connection by itself.
const useLinkAskStart = (
  target: DatabaseConnection | null,
  start: UseStagedLinkOptions["start"],
  clear: () => void
) => {
  const { activeConnection, activate } = useConnections();
  const activeId = activeConnection?.id ?? null;
  return useCallback(
    async (prompt: string, askTarget: AskTarget) => {
      clear();
      if (
        target &&
        askTarget.connectionId === target.id &&
        target.id !== activeId
      ) {
        await activate(target);
        start(prompt, { connectionId: target.id, database: null });
        return;
      }
      start(prompt, askTarget);
    },
    [activate, activeId, clear, start, target]
  );
};

export const useStagedLink = ({
  link,
  linkAsk,
  start,
  args,
  selectAsk,
}: UseStagedLinkOptions) => {
  const { activeConnection } = useConnections();
  const { widgets } = useWidgets();
  const ready = useLinksReady();
  const { staged, onDone } = link;
  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  const widgetLink = useMemo(
    () => widgetLinkOf(staged, widgets),
    [staged, widgets]
  );

  // Applied once per link, during render, after connections and widgets load
  // (a cold-start link arrives before they do).
  if (staged && ready && staged.nonce !== appliedNonce) {
    setAppliedNonce(staged.nonce);
    if (staged.kind === "ask") {
      args.close();
      selectAsk();
    } else if (widgetLink?.widget && widgetLink.values) {
      args.open(widgetLink.widget.id, widgetLink.values.values);
    }
  }

  useLinkFlash(ready ? flashNonceOf(staged, widgetLink) : null, onDone);

  const clear = useCallback(() => {
    if (staged) {
      onDone();
    }
  }, [onDone, staged]);
  const startAsk = useLinkAskStart(linkAsk.target, start, clear);

  const status =
    staged && ready ? stagedStatus(staged, linkAsk, widgetLink) : null;
  const announcement =
    staged?.kind === "ask" && linkAsk.live
      ? linkAnnouncement(staged.prompt, linkAsk.target ?? activeConnection)
      : null;

  return { announcement, clear, startAsk, status };
};
