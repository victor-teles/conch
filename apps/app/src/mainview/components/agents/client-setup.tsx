import { CopyIcon } from "lucide-react";
import { useCallback, useState } from "react";

import type { McpClientKind } from "@/lib/ipc";

import { CheckDraw } from "@/components/motion/check-draw";
import { Pressable } from "@/components/motion/pressable";
import { SwapText } from "@/components/motion/swap-text";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { getErrorMessage } from "@/lib/error-message";
import { copyMcpClientConfig } from "@/lib/ipc";

interface ClientOption {
  kind: McpClientKind;
  label: string;
  detail: string;
}

const CLIENTS: readonly ClientOption[] = [
  {
    detail: "Copies a claude mcp add command. Run it in your terminal.",
    kind: "claude-code",
    label: "Claude Code",
  },
  {
    detail: "Paste into ~/.cursor/mcp.json",
    kind: "cursor",
    label: "Cursor",
  },
  {
    detail: "Copies an mcpServers entry for any other client.",
    kind: "json",
    label: "JSON",
  },
];

export const TOKEN_HELP =
  "The token lets local agents connect. Anyone who can read your files can read it too.";

interface ClientRowProps {
  client: ClientOption;
  onError: (message: string | null) => void;
}

function ClientRow({ client, onError }: ClientRowProps) {
  const { copied, flash } = useCopyFeedback();
  const handleCopy = useCallback(async () => {
    try {
      await copyMcpClientConfig(client.kind);
      onError(null);
      flash();
    } catch (error) {
      onError(getErrorMessage(error, "The config could not be copied."));
    }
  }, [client.kind, flash, onError]);
  return (
    <li>
      <Pressable
        aria-label={`Copy ${client.label} config`}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-row-hover focus-visible:bg-row-hover focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:outline-none focus-visible:ring-inset"
        onClick={handleCopy}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-body text-foreground">{client.label}</span>
          <span className="truncate type-meta text-panel-muted">
            {client.detail}
          </span>
        </span>
        <span
          aria-live="polite"
          className="flex shrink-0 items-center gap-1.5 type-meta text-panel-muted"
        >
          {copied ? (
            <CheckDraw label="Copied" />
          ) : (
            <CopyIcon aria-hidden className="size-3" />
          )}
          <SwapText value={copied ? "Copied" : "Copy"} />
        </span>
      </Pressable>
    </li>
  );
}

interface ClientSetupProps {
  tokenPreview: string;
  socketPath: string;
}

export function ClientSetup({ tokenPreview, socketPath }: ClientSetupProps) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col">
      <ul aria-label="Set up a client" className="divide-y divide-panel-border">
        {CLIENTS.map((client) => (
          <ClientRow client={client} key={client.kind} onError={setError} />
        ))}
      </ul>
      <div className="flex flex-col gap-1 px-4 pt-2 pb-3">
        <code className="truncate font-mono type-meta text-panel-muted">
          CONCH_MCP_TOKEN={tokenPreview} · {socketPath}
        </code>
        <p className="type-meta text-panel-muted">{TOKEN_HELP}</p>
        {error ? (
          <p className="type-meta text-danger-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
