import { useEffect, useState } from "react";

import { listWritePermissions } from "@/lib/ipc";

// Read fresh each time the review opens, since the opt-in lives in Settings.
export const useWritePermissions = (open: boolean): ReadonlySet<string> => {
  const [keys, setKeys] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const permissions = await listWritePermissions();
        if (!cancelled) {
          setKeys(
            new Set(permissions.map((item) => `${item.kind}:${item.id}`))
          );
        }
      } catch (error) {
        console.error("[app] could not read write permissions", error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);
  return keys;
};
