import { ChevronRightIcon } from "lucide-react";

import type { SourceEditTarget } from "@/components/launcher/use-launcher-stack";

import { AgentsSettingRow } from "@/components/agents/agents-setting-row";
import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { ViewHeader } from "@/components/launcher/view-header";
import { Pressable } from "@/components/motion/pressable";

import { AboutSection } from "./settings/about-section";
import { AiSettingsSection } from "./settings/ai-settings-section";
import { ClipboardLookupRow } from "./settings/clipboard-lookup-row";
import { HotkeyRow } from "./settings/hotkey-row";
import { SettingRow } from "./settings/setting-row";
import { SettingsGroup } from "./settings/settings-group";
import { SourcesSection } from "./settings/sources-section";
import { ThemeControl } from "./settings/theme-control";
import { ThemeSettingRow } from "./settings/theme-setting-row";

const BACK_KEYS = ["esc"] as const;
const STATUS = <span>Conch</span>;

interface SettingsViewProps {
  onBack: () => void;
  onOpenActivity: () => void;
  onOpenWatches: () => void;
  onOpenAgents: () => void;
  onOpenSource: (target: SourceEditTarget) => void;
  onOpenThemes: () => void;
}

export function SettingsView({
  onBack,
  onOpenActivity,
  onOpenWatches,
  onOpenAgents,
  onOpenSource,
  onOpenThemes,
}: SettingsViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Settings" />
      <div className="min-h-0 flex-1 launcher-body overflow-y-auto">
        <SettingsGroup title="AI">
          <AiSettingsSection />
        </SettingsGroup>
        <SettingsGroup title="Launcher">
          <HotkeyRow />
          <ClipboardLookupRow />
          <SettingRow
            description="Dark is the default for long sessions."
            label="Appearance"
          >
            <ThemeControl />
          </SettingRow>
          <ThemeSettingRow onOpen={onOpenThemes} />
        </SettingsGroup>
        <SettingsGroup title="Background">
          <SettingRow
            description="Widgets that refresh on their own, alert you, or sit in the menu bar."
            label="Watching"
          >
            <Pressable
              aria-label="Open watched widgets"
              className="flex h-7 items-center gap-1 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
              onClick={onOpenWatches}
            >
              Open
              <ChevronRightIcon aria-hidden className="size-3" />
            </Pressable>
          </SettingRow>
        </SettingsGroup>
        <SettingsGroup title="Actions">
          <SettingRow
            description="Every write and link an action ran, in an encrypted, verified log."
            label="Activity"
          >
            <Pressable
              aria-label="Open activity"
              className="flex h-7 items-center gap-1 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
              onClick={onOpenActivity}
            >
              Open
              <ChevronRightIcon aria-hidden className="size-3" />
            </Pressable>
          </SettingRow>
        </SettingsGroup>
        <SettingsGroup title="Sources">
          <SourcesSection onOpen={onOpenSource} />
        </SettingsGroup>
        <SettingsGroup title="Agents">
          <AgentsSettingRow onOpen={onOpenAgents} />
        </SettingsGroup>
        <AboutSection />
      </div>
      <LauncherFooter
        actionKeys={BACK_KEYS}
        actionLabel="Back"
        status={STATUS}
      />
    </div>
  );
}
