import type { ChangeEvent } from "react";

import { PaletteIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";

import type { ThemeEditSource } from "@/components/themes/theme-edit-source";

import { ActionsMenu } from "@/components/launcher/actions/actions-menu";
import { FooterLocation } from "@/components/launcher/footer-location";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherInput } from "@/components/launcher/launcher-input";
import {
  LauncherListbox,
  LauncherSection,
} from "@/components/launcher/launcher-list";
import { optionId } from "@/components/launcher/launcher-row";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import { useListSelection } from "@/components/launcher/use-list-selection";
import { useFlashMessage } from "@/hooks/use-flash-message";
import { useThemePreview, useThemeSnapshot } from "@/lib/theme/theme-store";

import type { ThemeItem } from "./theme-items";

import { DELETE_THEME_KEYS } from "./theme-actions";
import { themeSections } from "./theme-items";
import { ThemeRow } from "./theme-row";
import { useThemesHotkeys } from "./use-themes-hotkeys";
import { useThemesMenu } from "./use-themes-menu";

const LIST_ID = "launcher-themes";
const MENU_KEYS = ["⌘", "K"] as const;
const NOTICE_MS = 2400;

interface ThemesViewProps {
  selectedId?: string;
  onEdit: (source: ThemeEditSource) => void;
}

export function ThemesView({ selectedId, onEdit }: ThemesViewProps) {
  const { state, systemAppearance } = useThemeSnapshot();
  const [query, setQuery] = useState("");
  const sections = useMemo(() => themeSections(state, query), [query, state]);
  const items = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections]
  );
  const { move, select, selected } = useListSelection(
    items,
    selectedId ?? null
  );
  const { flash, message } = useFlashMessage(NOTICE_MS);
  useThemePreview(selected?.theme ?? null);

  const onUsed = useCallback(
    (item: ThemeItem) => {
      const waits =
        state?.settings.mode === "system" &&
        systemAppearance !== item.theme.appearance;
      flash(
        waits
          ? `Used when your Mac is in ${item.theme.appearance} mode`
          : `Using ${item.theme.name}`
      );
    },
    [flash, state, systemAppearance]
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => inputRef.current?.focus(), []);
  const menu = useThemesMenu({
    notify: flash,
    onClosed: focusSearch,
    onEdit,
    onImported: select,
    onUsed,
  });
  const {
    run,
    disarm,
    open,
    close: handleCloseMenu,
    runMenuAction: handleMenuAction,
  } = menu;

  const runOnSelected = useCallback(
    (id: Parameters<typeof run>[0]) => run(id, selected),
    [run, selected]
  );
  const handleKeyDown = useThemesHotkeys({
    move: (delta) => {
      disarm();
      move(delta);
    },
    openMenu: () => {
      if (selected) {
        open(selected);
      }
    },
    run: runOnSelected,
  });
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
      select(null);
    },
    [select]
  );
  const handleSubmit = useCallback(() => runOnSelected("use"), [runOnSelected]);
  const useById = useCallback(
    (id: string) => run("use", items.find((item) => item.id === id) ?? null),
    [items, run]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <LauncherInput
        inputProps={{
          "aria-activedescendant": selected ? optionId(selected.id) : undefined,
          "aria-autocomplete": "list",
          "aria-controls": LIST_ID,
          "aria-expanded": true,
          "aria-label": "Search themes",
          autoFocus: true,
          onChange: handleChange,
          onKeyDown: handleKeyDown,
          placeholder: "Search themes…",
          ref: inputRef,
          role: "combobox",
          value: query,
        }}
        onSubmit={handleSubmit}
      />
      <LauncherScrollArea className="flex-1 pt-1">
        <LauncherListbox id={LIST_ID} label="Themes">
          {sections.map((section) => (
            <LauncherSection key={section.appearance} label={section.label}>
              {section.items.map((item) => (
                <ThemeRow
                  item={item}
                  key={item.id}
                  onHover={select}
                  onRun={useById}
                  selected={item.id === selected?.id}
                />
              ))}
            </LauncherSection>
          ))}
        </LauncherListbox>
        {items.length === 0 ? (
          <p className="px-4 py-3 type-body text-panel-muted">
            No themes match
          </p>
        ) : null}
      </LauncherScrollArea>
      <LauncherFooter
        actionLabel={selected ? "Use Theme" : null}
        hints={[
          ...(menu.armed && selected
            ? [{ keys: DELETE_THEME_KEYS, label: "Press again to delete" }]
            : []),
          { keys: MENU_KEYS, label: "Actions" },
        ]}
        status={
          <span aria-live="polite">
            {message ?? <FooterLocation icon={PaletteIcon} label="Themes" />}
          </span>
        }
      />
      <AnimatePresence>
        {menu.menuItem ? (
          <ActionsMenu
            actions={menu.actions}
            anchorId={optionId(menu.menuItem.id)}
            armedId={menu.armed ? "delete" : null}
            key={menu.menuItem.id}
            onClose={handleCloseMenu}
            onRun={handleMenuAction}
            title={menu.menuItem.theme.name}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
