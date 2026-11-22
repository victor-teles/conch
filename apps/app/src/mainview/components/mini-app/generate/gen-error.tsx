import type { MiniAppGenErrorCode } from "@/lib/ipc";

import { ErrorNotice } from "@/components/ask/error-notice";

interface GenErrorProps {
  error: { code: MiniAppGenErrorCode; message: string };
  onRetry: () => void;
  onOpenSettings: () => void;
}

const TITLES: Record<MiniAppGenErrorCode, string> = {
  AI_AUTH: "The AI provider rejected the key or model.",
  AI_NETWORK: "The AI provider could not be reached.",
  AI_RATE_LIMIT: "The AI provider is limiting requests. Try again in a moment.",
  CANCELLED: "Stopped.",
  INVALID_APP:
    "Couldn't build a working app from that. Try naming the data you want.",
  NO_AI_SETTINGS: "Add an AI provider to build apps.",
  TIMEOUT: "Building the app took too long.",
};

const NEEDS_SETTINGS: ReadonlySet<MiniAppGenErrorCode> = new Set([
  "AI_AUTH",
  "NO_AI_SETTINGS",
]);

export function GenError({ error, onRetry, onOpenSettings }: GenErrorProps) {
  const settings = NEEDS_SETTINGS.has(error.code);
  return (
    <ErrorNotice
      action={
        settings
          ? { label: "Set up AI", onRun: onOpenSettings }
          : { label: "Try Again", onRun: onRetry }
      }
      detail={error.code === "NO_AI_SETTINGS" ? null : error.message}
      title={TITLES[error.code]}
    />
  );
}
