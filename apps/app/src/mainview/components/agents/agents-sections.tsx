import { MCP_ROW_LIMITS } from "@conch/rpc";
import { ChevronRightIcon } from "lucide-react";
import { useCallback } from "react";

import type { McpSettingsUpdate, RedactedMcpSettings } from "@/lib/ipc";

import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { SettingsGroup } from "@/components/launcher/views/settings/settings-group";
import { Pressable } from "@/components/motion/pressable";
import { Reveal } from "@/components/motion/reveal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { staggerDelay } from "@/lib/motion";

import { ClientSetup } from "./client-setup";
import { ExposedConnections } from "./exposed-connections";
import { TokenRow } from "./token-row";

const ROW_LIMIT_OPTIONS = MCP_ROW_LIMITS.map((limit) => ({
  label: String(limit),
  value: String(limit),
}));

export const AI_USAGE_NOTE =
  "Asks from agents use your AI provider and count toward its usage.";

interface AgentsSectionsProps {
  settings: RedactedMcpSettings;
  onUpdate: (update: McpSettingsUpdate) => void;
  onRotate: () => Promise<boolean>;
  onOpenAudit: () => void;
}

export function AgentsSections({
  settings,
  onUpdate,
  onRotate,
  onOpenAudit,
}: AgentsSectionsProps) {
  const handleExposure = useCallback(
    (exposedConnectionIds: string[]) => onUpdate({ exposedConnectionIds }),
    [onUpdate]
  );
  const handleRowLimit = useCallback(
    (value: string) => onUpdate({ rowLimit: Number(value) }),
    [onUpdate]
  );
  return (
    <>
      <Reveal delay={staggerDelay(0)}>
        <SettingsGroup title="Connections">
          <ExposedConnections
            disabled={false}
            exposedIds={settings.exposedConnectionIds}
            onChange={handleExposure}
          />
          <SettingRow
            description="Most rows an agent gets back from one call."
            label="Row limit"
          >
            <SegmentedControl
              label="Row limit"
              onChange={handleRowLimit}
              options={ROW_LIMIT_OPTIONS}
              value={String(settings.rowLimit)}
            />
          </SettingRow>
        </SettingsGroup>
      </Reveal>
      <Reveal delay={staggerDelay(1)}>
        <SettingsGroup title="Set up a client">
          <ClientSetup
            socketPath={settings.socketPath}
            tokenPreview={settings.tokenPreview}
          />
          <TokenRow onRotate={onRotate} />
        </SettingsGroup>
      </Reveal>
      <Reveal delay={staggerDelay(2)}>
        <SettingsGroup title="Activity">
          <SettingRow
            description="Every agent call, newest first."
            label="Agent calls"
          >
            <Pressable
              aria-label="Open agent activity"
              className="flex h-7 items-center gap-1 rounded-[8px] bg-row-hover px-2.5 type-meta text-foreground hover:bg-row-active focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none"
              onClick={onOpenAudit}
            >
              Open
              <ChevronRightIcon aria-hidden className="size-3" />
            </Pressable>
          </SettingRow>
        </SettingsGroup>
        <p className="px-4 pt-3 pb-2 type-meta text-panel-muted">
          {AI_USAGE_NOTE}
        </p>
      </Reveal>
    </>
  );
}
