import type { Theme } from "@conch/rpc";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";

import type { ThemeEditSource } from "./theme-edit-source";

import { ThemeEditHeader } from "./theme-edit-header";
import { ThemePreview } from "./theme-preview";
import { ThemeTokenList } from "./theme-token-list";
import { useThemeEditHotkeys } from "./use-theme-edit-hotkeys";
import { useThemeEditor } from "./use-theme-editor";

const SAVE_KEYS = ["⌘", "S"] as const;
const SAVE_UNAVAILABLE = [{ disabled: true, keys: SAVE_KEYS, label: "Save" }];

interface ThemeEditViewProps {
  source: ThemeEditSource;
  onBack: () => void;
  onSaved: (theme: Theme) => void;
}

export function ThemeEditView({ source, onBack, onSaved }: ThemeEditViewProps) {
  const editor = useThemeEditor({ onBack, onSaved, source });
  const { draft, requestBack, save, setAppearance, setName, setToken } = editor;
  const handleKeyDown = useThemeEditHotkeys({
    onBack: requestBack,
    onSave: save,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <ThemeEditHeader
        appearance={draft.appearance}
        canChangeAppearance={source.kind === "new"}
        name={draft.name}
        onAppearance={setAppearance}
        onBack={requestBack}
        onName={setName}
      />
      <ThemePreview theme={editor.theme} />
      <LauncherScrollArea className="flex-1 border-t border-panel-border">
        <ThemeTokenList
          onToken={setToken}
          report={editor.report}
          tokens={draft.tokens}
        />
      </LauncherScrollArea>
      <LauncherFooter
        actionKeys={SAVE_KEYS}
        actionLabel={editor.canSave ? "Save" : null}
        hints={editor.canSave ? [] : SAVE_UNAVAILABLE}
        status={
          <span
            aria-live="polite"
            className={editor.blocked ? "text-danger-ink" : undefined}
          >
            {editor.status}
          </span>
        }
      />
    </div>
  );
}
