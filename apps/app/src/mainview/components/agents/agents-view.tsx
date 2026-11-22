import { AnimatePresence } from "motion/react";
import { useCallback } from "react";

import type { RedactedMcpSettings } from "@/lib/ipc";

import { LauncherFooter } from "@/components/launcher/launcher-footer";
import { LauncherScrollArea } from "@/components/launcher/launcher-scroll-area";
import { ViewHeader } from "@/components/launcher/view-header";
import { SettingRow } from "@/components/launcher/views/settings/setting-row";
import { SwapText } from "@/components/motion/swap-text";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { McpSettingsState } from "./use-mcp-settings";

import { agentsStatusLine, agentsSummary } from "./agents-copy";
import { AgentsSections } from "./agents-sections";
import {
  AgentsExplainer,
  AgentsProblem,
  AgentsSkeleton,
} from "./agents-states";
import { useExposedCount } from "./use-exposed-count";
import { useMcpSettings } from "./use-mcp-settings";

const BACK_KEYS = ["esc"] as const;
const ENABLE_LABEL = "Let local agents use Conch";

type ReadyState = Extract<McpSettingsState, { status: "ready" }>;

interface ReadyBodyProps {
  ready: ReadyState;
  controls: Omit<ReturnType<typeof useMcpSettings>, "state" | "retry">;
  onOpenAudit: () => void;
}

function ReadyBody({ ready, controls, onOpenAudit }: ReadyBodyProps) {
  const { settings, saving, error } = ready;
  const { update, rotate } = controls;
  const setEnabled = useCallback(
    (enabled: boolean) => update({ enabled }),
    [update]
  );
  const turnOn = useCallback(() => update({ enabled: true }), [update]);
  return (
    <>
      <SettingRow
        description={
          <span aria-live="polite" className={cn(error && "text-danger-ink")}>
            <SwapText value={error ?? agentsStatusLine(settings, saving)} />
          </span>
        }
        label={ENABLE_LABEL}
      >
        <Checkbox
          aria-label={ENABLE_LABEL}
          checked={settings.enabled}
          onCheckedChange={setEnabled}
        />
      </SettingRow>
      {settings.enabled && settings.startError ? (
        <AgentsProblem
          message={`Couldn't start the agent server: ${settings.startError}`}
          onRetry={turnOn}
        />
      ) : null}
      <AnimatePresence initial={false} mode="popLayout">
        {settings.enabled ? (
          <div key="on">
            <AgentsSections
              onOpenAudit={onOpenAudit}
              onRotate={rotate}
              onUpdate={update}
              settings={settings}
            />
          </div>
        ) : (
          <AgentsExplainer key="off" onTurnOn={turnOn} />
        )}
      </AnimatePresence>
    </>
  );
}

function FooterSummary({ settings }: { settings: RedactedMcpSettings }) {
  const count = useExposedCount(settings.exposedConnectionIds);
  return <SwapText value={agentsSummary(settings, count)} />;
}

interface AgentsViewProps {
  onBack: () => void;
  onOpenAudit: () => void;
}

export function AgentsView({ onBack, onOpenAudit }: AgentsViewProps) {
  const { state, retry, ...controls } = useMcpSettings();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader onBack={onBack} title="Agents (MCP)" />
      <LauncherScrollArea className="flex-1">
        {state.status === "loading" ? (
          <AgentsSkeleton label="Loading agent settings" />
        ) : null}
        {state.status === "error" ? (
          <AgentsProblem message={state.message} onRetry={retry} />
        ) : null}
        {state.status === "ready" ? (
          <ReadyBody
            controls={controls}
            onOpenAudit={onOpenAudit}
            ready={state}
          />
        ) : null}
      </LauncherScrollArea>
      <LauncherFooter
        actionKeys={BACK_KEYS}
        actionLabel="Back"
        status={
          state.status === "ready" ? (
            <FooterSummary settings={state.settings} />
          ) : (
            <span>Agents (MCP)</span>
          )
        }
      />
    </div>
  );
}
