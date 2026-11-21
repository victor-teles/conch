import {
  ClockIcon,
  HistoryIcon,
  LayoutGridIcon,
  MessageSquareTextIcon,
} from "lucide-react";

import { CONNECTION, RECENT_ASKS, WIDGETS } from "@/data/revenue";
import { COLOR } from "@/theme";

import { KeyCombo } from "./kbd";
import { LauncherRow, SectionLabel } from "./launcher-row";

export const ROOT_LIST_HEIGHT = 12 + 24 * 2 + 40 * 5;
export const ASK_LIST_HEIGHT = 12 + 40 * 2;

export function RootList() {
  return (
    <div style={{ padding: "6px 6px" }}>
      <SectionLabel>Recent</SectionLabel>
      {RECENT_ASKS.map((prompt, index) => (
        <LauncherRow icon={ClockIcon} key={prompt} selected={index === 0}>
          <span style={{ color: COLOR.foreground }}>{prompt}</span>
          <span style={{ color: COLOR.muted }}>{CONNECTION.name}</span>
        </LauncherRow>
      ))}
      <SectionLabel>Widgets</SectionLabel>
      {WIDGETS.map((widget) => (
        <LauncherRow
          icon={LayoutGridIcon}
          key={widget.name}
          trailing={<KeyCombo keys={["⇥"]} />}
        >
          <span style={{ color: COLOR.foreground }}>{widget.name}</span>
          <span style={{ color: COLOR.muted }}>{widget.params}</span>
        </LauncherRow>
      ))}
    </div>
  );
}

export function AskList({ prompt }: { prompt: string }) {
  return (
    <div style={{ padding: "6px 6px" }}>
      <LauncherRow icon={MessageSquareTextIcon} selected>
        <span style={{ color: COLOR.muted, flexShrink: 0 }}>
          Ask {CONNECTION.name}:
        </span>
        <span style={{ color: COLOR.foreground }}>“{prompt}”</span>
      </LauncherRow>
      <LauncherRow icon={HistoryIcon}>
        <span style={{ color: COLOR.foreground }}>Search History</span>
        <span style={{ color: COLOR.muted }}>for “{prompt}”</span>
      </LauncherRow>
    </div>
  );
}
