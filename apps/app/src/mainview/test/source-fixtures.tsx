import type { ReactNode } from "react";

import { render } from "vitest-browser-react";

import type {
  McpToolSummary,
  RedactedHttpEndpoint,
  RedactedMcpServer,
  Widget,
} from "@/lib/ipc";

import { AppProviders } from "@/components/app-providers";
import { ConnectionsProvider } from "@/components/launcher/connections/connections-provider";
import { SourcesProvider } from "@/components/sources/sources-provider";
import { WatchesProvider } from "@/components/watches/watches-provider";
import { WidgetsProvider } from "@/components/widgets/widgets-provider";

import { makeWidget } from "./widget-fixtures";

export const makeServer = (
  overrides: Partial<Extract<RedactedMcpServer, { transport: "stdio" }>> = {}
): RedactedMcpServer => ({
  args: ["-y", "@stripe/mcp"],
  command: "/opt/homebrew/bin/npx",
  createdAt: "2026-11-20T00:00:00.000Z",
  env: [{ hasValue: true, hint: "9f2c", name: "STRIPE_KEY" }],
  id: "stripe",
  lastTest: null,
  name: "Stripe",
  readTools: [],
  transport: "stdio",
  updatedAt: "2026-11-20T00:00:00.000Z",
  ...overrides,
});

export const makeEndpoint = (
  overrides: Partial<RedactedHttpEndpoint> = {}
): RedactedHttpEndpoint => ({
  auth: { hasValue: true, hint: "4242", kind: "header", name: "Authorization" },
  baseUrl: "https://status.example.com/api",
  createdAt: "2026-11-20T00:00:00.000Z",
  id: "status",
  lastTest: null,
  name: "Status API",
  updatedAt: "2026-11-20T00:00:00.000Z",
  ...overrides,
});

export const TOOLS: McpToolSummary[] = [
  {
    description: "List disputes by status.",
    inputSchema: { type: "object" },
    markedRead: false,
    name: "list_disputes",
    readEligible: true,
    readOnlyHint: true,
    title: "List disputes",
  },
  {
    description: "Refund a charge.",
    inputSchema: { type: "object" },
    markedRead: false,
    name: "refund_charge",
    readEligible: false,
    readOnlyHint: false,
    title: null,
  },
];

export const makeMcpWidget = (overrides: Partial<Widget> = {}): Widget =>
  makeWidget({
    id: "w-disputes",
    name: "Open disputes",
    params: [
      {
        default: "needs_response",
        label: "Status",
        name: "status",
        options: ["needs_response", "won"],
        type: "select",
      },
    ],
    source: {
      args: { status: { $param: "status" } },
      kind: "mcp",
      select: "$.data[*]",
      serverId: "stripe",
      tool: "list_disputes",
    },
    ...overrides,
  });

export const renderWithSources = (ui: ReactNode) =>
  render(
    <AppProviders>
      <ConnectionsProvider>
        <WidgetsProvider>
          <WatchesProvider>
            <SourcesProvider>{ui}</SourcesProvider>
          </WatchesProvider>
        </WidgetsProvider>
      </ConnectionsProvider>
    </AppProviders>
  );
