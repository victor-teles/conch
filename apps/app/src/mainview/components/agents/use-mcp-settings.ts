import { useCallback, useEffect, useRef, useState } from "react";

import type { McpSettingsUpdate, RedactedMcpSettings } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import {
  getMcpSettings,
  onMcpActivity,
  rotateMcpToken,
  saveMcpSettings,
} from "@/lib/ipc";

export type McpSettingsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      settings: RedactedMcpSettings;
      saving: boolean;
      error: string | null;
    };

const applyUpdate = (
  settings: RedactedMcpSettings,
  update: McpSettingsUpdate
): RedactedMcpSettings => ({
  ...settings,
  enabled: update.enabled ?? settings.enabled,
  exposedConnectionIds:
    update.exposedConnectionIds ?? settings.exposedConnectionIds,
  rowLimit: update.rowLimit ?? settings.rowLimit,
  startError: update.enabled === undefined ? settings.startError : null,
});

export const useMcpSettings = () => {
  const [state, setState] = useState<McpSettingsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const confirmed = useRef<RedactedMcpSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await getMcpSettings();
        if (!cancelled) {
          confirmed.current = settings;
          setState({ error: null, saving: false, settings, status: "ready" });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            message: getErrorMessage(error, "Agent settings could not load."),
            status: "error",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    let cancelled = false;
    const refreshClients = async () => {
      const ticket = latest.current;
      try {
        const settings = await getMcpSettings();
        if (!cancelled && ticket === latest.current) {
          confirmed.current = settings;
          setState((current) =>
            current.status === "ready" && !current.saving
              ? { ...current, settings }
              : current
          );
        }
      } catch {
        // The next activity message or a reopen tries again.
      }
    };
    const unsubscribe = onMcpActivity(() => {
      refreshClients();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const commit = useCallback(
    async (
      optimistic: (settings: RedactedMcpSettings) => RedactedMcpSettings,
      request: () => Promise<RedactedMcpSettings>,
      fallback: string
    ) => {
      latest.current += 1;
      const ticket = latest.current;
      setState((current) => {
        if (current.status !== "ready") {
          return current;
        }
        return {
          error: null,
          saving: true,
          settings: optimistic(current.settings),
          status: "ready",
        };
      });
      try {
        const settings = await request();
        confirmed.current = settings;
        if (ticket === latest.current) {
          setState({ error: null, saving: false, settings, status: "ready" });
        }
        return true;
      } catch (error) {
        const previous = confirmed.current;
        if (ticket === latest.current && previous) {
          setState({
            error: getErrorMessage(error, fallback),
            saving: false,
            settings: previous,
            status: "ready",
          });
        }
        return false;
      }
    },
    []
  );

  const update = useCallback(
    (patch: McpSettingsUpdate) =>
      commit(
        (settings) => applyUpdate(settings, patch),
        () => saveMcpSettings(patch),
        "The setting could not be saved."
      ),
    [commit]
  );

  const rotate = useCallback(
    () =>
      commit(
        (settings) => settings,
        rotateMcpToken,
        "The token could not be rotated."
      ),
    [commit]
  );

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { retry, rotate, state, update };
};
