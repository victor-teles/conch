import type { ChangeEvent, KeyboardEvent } from "react";

import { PlugIcon, SlidersHorizontalIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { SourceTarget } from "@/lib/ipc";

import { FooterLocation } from "@/components/launcher/footer-location";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInput } from "@/components/launcher/launcher-input";
import {
  LauncherListbox,
  LauncherSection,
} from "@/components/launcher/launcher-list";
import { LauncherRow, optionId } from "@/components/launcher/launcher-row";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import { useListSelection } from "@/components/launcher/use-list-selection";

import type { SourcesState } from "./sources-provider";

import { SourceGlyph } from "./source-glyph";
import { useSources } from "./sources-provider";

const PICKER_LIST_ID = "launcher-source-picker";
const SETTINGS_ID = "open-sources-settings";

interface PickerItem {
  id: string;
  title: string;
  detail: string;
  target: SourceTarget | null;
}

const itemsOf = (state: SourcesState, needle: string): PickerItem[] => {
  const sources =
    state.status === "ready"
      ? [
          ...state.servers.map((server) => ({
            detail:
              server.transport === "stdio"
                ? "MCP · local command"
                : "MCP · remote",
            id: `mcp:${server.id}`,
            target: { id: server.id, type: "mcp" as const },
            title: server.name,
          })),
          ...state.endpoints.map((endpoint) => ({
            detail: `HTTP · ${endpoint.baseUrl}`,
            id: `http:${endpoint.id}`,
            target: { id: endpoint.id, type: "http" as const },
            title: endpoint.name,
          })),
        ]
      : [];
  return [
    ...sources.filter((item) => item.title.toLowerCase().includes(needle)),
    {
      detail: "Add or test MCP servers and HTTP endpoints",
      id: SETTINGS_ID,
      target: null,
      title: "Open Sources Settings…",
    },
  ];
};

interface SourcePickerViewProps {
  onChoose: (target: SourceTarget) => void;
  onOpenSettings: () => void;
  onBack: () => void;
}

export function SourcePickerView({
  onChoose,
  onOpenSettings,
}: SourcePickerViewProps) {
  const { state } = useSources();
  const [query, setQuery] = useState("");
  const items = useMemo(
    () => itemsOf(state, query.trim().toLowerCase()),
    [query, state]
  );
  const { move, select, selected } = useListSelection(items);

  const choose = useCallback(
    (item: PickerItem | null | undefined) => {
      if (!item) {
        return;
      }
      if (item.target) {
        onChoose(item.target);
      } else {
        onOpenSettings();
      }
    },
    [onChoose, onOpenSettings]
  );
  const runById = useCallback(
    (id: string) => choose(items.find((item) => item.id === id)),
    [choose, items]
  );
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      select(null);
    },
    [select]
  );
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        choose(selected);
      }
    },
    [choose, move, selected]
  );
  const handleSubmit = useCallback(() => choose(selected), [choose, selected]);
  const empty = items.length === 1;

  return (
    <div className="flex min-h-0 flex-col">
      <LauncherInput
        inputProps={{
          "aria-activedescendant": selected ? optionId(selected.id) : undefined,
          "aria-autocomplete": "list",
          "aria-controls": PICKER_LIST_ID,
          "aria-expanded": true,
          "aria-label": "Search sources",
          autoFocus: true,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          placeholder: "Build a widget from which source?",
          role: "combobox",
          value: query,
        }}
        onSubmit={handleSubmit}
      />
      <LauncherScrollArea className="flex-1 pt-1">
        {empty && state.status === "ready" && !query ? (
          <p className="px-4 pb-2 type-meta text-panel-muted">
            No sources yet. Connect an MCP server or an HTTP API in Settings.
          </p>
        ) : null}
        <LauncherListbox id={PICKER_LIST_ID} label="Sources">
          <LauncherSection label="New Widget from a Source">
            {items.map((item) => (
              <LauncherRow
                id={item.id}
                key={item.id}
                onHover={select}
                onRun={runById}
                selected={item.id === selected?.id}
              >
                {item.target ? (
                  <SourceGlyph kind={item.target.type} name={item.title} />
                ) : (
                  <span className="relative grid size-6 place-items-center rounded-[7px] bg-row-hover text-panel-muted">
                    <SlidersHorizontalIcon aria-hidden className="size-3.5" />
                  </span>
                )}
                <span className="relative flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate type-body text-foreground">
                    {item.title}
                  </span>
                  <span className="truncate type-meta text-panel-muted">
                    {item.detail}
                  </span>
                </span>
              </LauncherRow>
            ))}
          </LauncherSection>
        </LauncherListbox>
      </LauncherScrollArea>
      <LauncherFooter
        actionLabel={selected?.target ? "Choose" : "Open"}
        status={<FooterLocation icon={PlugIcon} label="Sources" />}
      />
    </div>
  );
}
