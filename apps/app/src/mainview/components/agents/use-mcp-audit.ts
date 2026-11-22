import { MAX_MCP_AUDIT_LIST } from "@conch/rpc";
import { useCallback, useEffect, useRef, useState } from "react";

import type { McpAuditEntry } from "@/lib/ipc";

import { clearMcpAudit, listMcpAudit, onMcpActivity } from "@/lib/ipc";

export type AuditLoad = "loading" | "ready" | "error";

const newestFirst = (a: McpAuditEntry, b: McpAuditEntry): number =>
  b.at.localeCompare(a.at);

export const useMcpAudit = () => {
  const [entries, setEntries] = useState<McpAuditEntry[]>([]);
  const [load, setLoad] = useState<AuditLoad>("loading");
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const known = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEntries = async () => {
      try {
        const listed = await listMcpAudit(MAX_MCP_AUDIT_LIST);
        if (cancelled) {
          return;
        }
        const previous = known.current;
        const added = previous
          ? listed.filter((entry) => !previous.has(entry.id))
          : [];
        known.current = new Set(listed.map((entry) => entry.id));
        setEntries(listed.toSorted(newestFirst));
        setLoad("ready");
        if (added.length > 0) {
          setFresh(
            (current) =>
              new Set([...current, ...added.map((entry) => entry.id)])
          );
        }
      } catch {
        if (!cancelled) {
          setLoad((current) => (current === "ready" ? current : "error"));
        }
      }
    };
    fetchEntries();
    const unsubscribe = onMcpActivity(() => {
      fetchEntries();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoad("loading");
    setAttempt((value) => value + 1);
  }, []);

  const clear = useCallback(async () => {
    await clearMcpAudit();
    known.current = new Set();
    setEntries([]);
    setFresh(new Set());
  }, []);

  const settleFresh = useCallback((id: string) => {
    setFresh((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  return { clear, entries, fresh, load, retry, settleFresh };
};
