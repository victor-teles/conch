import { useCallback, useEffect, useState } from "react";

import type { WriteTargetKind } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { listWritePermissions, setWriteActionsAllowed } from "@/lib/ipc";

export type WritePermissionState =
  | { status: "loading" }
  | {
      status: "ready";
      allowed: boolean;
      asking: boolean;
      error: string | null;
    };

// Never optimistic: the switch moves only after bun's native dialog answers.
export const useWritePermission = (kind: WriteTargetKind, id: string) => {
  const [state, setState] = useState<WritePermissionState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const permissions = await listWritePermissions();
        if (!cancelled) {
          setState({
            allowed: permissions.some(
              (item) => item.kind === kind && item.id === id
            ),
            asking: false,
            error: null,
            status: "ready",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            allowed: false,
            asking: false,
            error: getErrorMessage(error, "Couldn't read the setting."),
            status: "ready",
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const toggle = useCallback(async () => {
    if (state.status !== "ready" || state.asking) {
      return;
    }
    const wanted = !state.allowed;
    setState({ ...state, asking: true, error: null });
    try {
      const { allowed } = await setWriteActionsAllowed(kind, id, wanted);
      setState({ allowed, asking: false, error: null, status: "ready" });
    } catch (error) {
      setState({
        allowed: state.allowed,
        asking: false,
        error: getErrorMessage(error, "The setting could not be changed."),
        status: "ready",
      });
    }
  }, [id, kind, state]);

  return { state, toggle };
};
