import { beforeEach, describe, expect, it, vi } from "vitest";

import type { McpSettingsUpdate, RedactedMcpSettings } from "@/lib/ipc";
import type { CommandHandlers } from "@/test/ipc-mock";

import { makeConnection } from "@/test/connection-fixture";
import { emitIpcMessage } from "@/test/ipc-mock";
import { mockLauncherIpc, renderWithConnections } from "@/test/launcher-ipc";
import { makeMcpSettings } from "@/test/mcp-fixtures";
import { swapsSettled } from "@/test/wait";

import { AGENTS_EXPLAINER } from "./agents-states";
import { AgentsView } from "./agents-view";
import { TOKEN_HELP } from "./client-setup";
import { PRODUCTION_WARNING } from "./exposed-connections";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const CONNECTIONS = [
  makeConnection({ environment: "dev" }),
  makeConnection({ environment: "prod", id: "conn-billing", name: "billing" }),
];

interface SetupOptions {
  settings?: RedactedMcpSettings;
  handlers?: CommandHandlers;
  connections?: typeof CONNECTIONS;
}

const setup = ({
  settings = makeMcpSettings(),
  handlers = {},
  connections = CONNECTIONS,
}: SetupOptions = {}) => {
  const store = { settings };
  const ipc = {
    copyMcpClientConfig: vi.fn((_payload: Record<string, unknown>) => null),
    rotateMcpToken: vi.fn(() => {
      store.settings = { ...store.settings, tokenPreview: "conch_…z9z9" };
      return store.settings;
    }),
    saveMcpSettings: vi.fn((payload: Record<string, unknown>) => {
      const update = payload as McpSettingsUpdate;
      const enabled = update.enabled ?? store.settings.enabled;
      store.settings = {
        ...store.settings,
        ...update,
        enabled,
        listening: enabled,
        startError: null,
      };
      return store.settings;
    }),
  };
  mockLauncherIpc({
    connections,
    handlers: {
      ...ipc,
      getMcpSettings: () => store.settings,
      ...handlers,
    },
  });
  const onOpenAudit = vi.fn();
  const screen = renderWithConnections(
    <div style={{ width: 760 }}>
      <AgentsView onBack={vi.fn()} onOpenAudit={onOpenAudit} />
    </div>
  );
  return { ipc, onOpenAudit, screen, store };
};

const ON = makeMcpSettings({ enabled: true, listening: true });

describe("agentsView", () => {
  beforeEach(() => {
    reduced.value = false;
  });

  it("explains the feature while it is off", async () => {
    const { screen } = setup();

    await expect.element(screen.getByText(AGENTS_EXPLAINER)).toBeVisible();
    await expect
      .element(screen.getByText("Off", { exact: true }).first())
      .toBeVisible();
    expect(
      screen
        .getByRole("checkbox", { name: "Let local agents use Conch" })
        .element()
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.container).toMatchSnapshot();
  });

  it("turns on, says it is starting, then reveals the sections", async () => {
    const pending = Promise.withResolvers<RedactedMcpSettings>();
    const { screen } = setup({
      handlers: { saveMcpSettings: () => pending.promise },
    });

    await screen.getByRole("button", { name: "Turn on" }).click();
    await expect.element(screen.getByText("Starting…")).toBeVisible();
    pending.resolve(ON);

    await expect
      .element(screen.getByText("Listening", { exact: true }))
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("list", { name: "Connections agents can read" })
      )
      .toBeVisible();
    await expect.element(screen.getByText(TOKEN_HELP)).toBeVisible();
    await expect
      .poll(() => screen.getByText(AGENTS_EXPLAINER).query())
      .toBeNull();
    await expect.poll(() => screen.getByText("Starting…").query()).toBeNull();
    expect(screen.container).toMatchSnapshot();
  });

  it("keeps every connection unexposed by default and saves a toggle", async () => {
    const { ipc, screen } = setup({ settings: ON });

    const analytics = screen.getByRole("checkbox", { name: /analytics/ });
    await expect.element(analytics).toHaveAttribute("aria-checked", "false");
    await expect
      .element(screen.getByRole("checkbox", { name: /billing/ }))
      .toHaveAttribute("aria-checked", "false");

    await analytics.click();
    expect(ipc.saveMcpSettings).toHaveBeenCalledWith({
      exposedConnectionIds: ["conn-analytics"],
    });
    await expect.element(analytics).toHaveAttribute("aria-checked", "true");
    await expect.element(screen.getByText("On · 1 connection")).toBeVisible();

    await analytics.click();
    expect(ipc.saveMcpSettings).toHaveBeenLastCalledWith({
      exposedConnectionIds: [],
    });
  });

  it("warns under an exposed production connection", async () => {
    const { screen } = setup({ settings: ON });

    expect(screen.getByText(PRODUCTION_WARNING).query()).toBeNull();
    await screen.getByRole("checkbox", { name: /billing/ }).click();

    await expect.element(screen.getByText(PRODUCTION_WARNING)).toBeVisible();
    await expect.poll(() => swapsSettled(screen.container)).toBe(true);
    expect(screen.container).toMatchSnapshot();
  });

  it("asks for a connection first when there are none", async () => {
    const { screen } = setup({ connections: [], settings: ON });

    await expect
      .element(screen.getByText("Add a connection first."))
      .toBeVisible();
  });

  it("saves the row limit", async () => {
    const { ipc, screen } = setup({ settings: ON });

    await screen.getByRole("radio", { name: "250" }).click();

    expect(ipc.saveMcpSettings).toHaveBeenCalledWith({ rowLimit: 250 });
    await expect
      .element(screen.getByRole("radio", { name: "250" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("copies a client config through bun and confirms it", async () => {
    const { ipc, screen } = setup({ settings: ON });

    const row = screen.getByRole("button", { name: "Copy Claude Code config" });
    await row.click();

    expect(ipc.copyMcpClientConfig).toHaveBeenCalledWith({
      client: "claude-code",
    });
    await expect.element(row.getByText("Copied")).toBeVisible();
    await expect
      .element(row.getByRole("img", { name: "Copied" }))
      .toBeVisible();
    expect(screen.container.textContent).toContain("conch_…a1b2");
  });

  it("reports a copy that failed", async () => {
    const { screen } = setup({
      handlers: {
        copyMcpClientConfig: vi
          .fn()
          .mockRejectedValue(new Error("Pasteboard busy")),
      },
      settings: ON,
    });

    await screen.getByRole("button", { name: "Copy Cursor config" }).click();

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Pasteboard busy");
  });

  it("rotates the token only on a second press", async () => {
    const { ipc, screen } = setup({ settings: ON });

    await screen.getByRole("button", { name: "Rotate" }).click();
    const armed = screen.getByRole("button", { name: "Press again to rotate" });
    await expect.element(armed).toBeVisible();
    expect(ipc.rotateMcpToken).not.toHaveBeenCalled();

    await armed.click();
    expect(ipc.rotateMcpToken).toHaveBeenCalledOnce();
    await expect
      .element(screen.getByText("Clients disconnected"))
      .toBeVisible();
    await expect.element(screen.getByText(/conch_…z9z9/)).toBeVisible();
  });

  it("shows a start failure with a retry that turns it on again", async () => {
    const { ipc, screen } = setup({
      settings: makeMcpSettings({ enabled: true, startError: "socket in use" }),
    });

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Couldn't start the agent server: socket in use");
    expect(screen.container).toMatchSnapshot();

    await screen.getByRole("button", { name: "Retry" }).click();
    expect(ipc.saveMcpSettings).toHaveBeenCalledWith({ enabled: true });
    await expect
      .element(screen.getByText("Listening", { exact: true }))
      .toBeVisible();
  });

  it("puts the setting back and says so when a save fails", async () => {
    const { screen } = setup({
      handlers: {
        saveMcpSettings: vi.fn().mockRejectedValue(new Error("Disk is full")),
      },
    });

    await screen.getByRole("button", { name: "Turn on" }).click();

    await expect.element(screen.getByText("Disk is full")).toBeVisible();
    await expect.element(screen.getByText(AGENTS_EXPLAINER)).toBeVisible();
  });

  it("retries when the settings fail to load", async () => {
    const { screen } = setup({
      handlers: {
        getMcpSettings: vi
          .fn()
          .mockRejectedValueOnce(new Error("Locked"))
          .mockResolvedValue(makeMcpSettings()),
      },
    });

    await expect.element(screen.getByRole("alert")).toHaveTextContent("Locked");
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect.element(screen.getByText(AGENTS_EXPLAINER)).toBeVisible();
  });

  it("shows skeleton rows while a slow load is pending", async () => {
    const pending = Promise.withResolvers<RedactedMcpSettings>();
    const { screen } = setup({
      handlers: { getMcpSettings: () => pending.promise },
    });

    await expect
      .element(screen.getByRole("status", { name: "Loading agent settings" }))
      .toBeVisible();
    pending.resolve(makeMcpSettings());
    await expect.element(screen.getByText(AGENTS_EXPLAINER)).toBeVisible();
  });

  it("names connected clients after agent activity", async () => {
    const { screen, store } = setup({ settings: ON });
    await expect
      .element(screen.getByText("Listening", { exact: true }))
      .toBeVisible();

    store.settings = {
      ...ON,
      clients: [
        { connectedAt: ON.socketPath, name: "claude-code", version: "2.1.0" },
      ],
    };
    emitIpcMessage("mcpActivity", { active: [] });

    await expect
      .element(screen.getByText("Listening · Claude Code connected"))
      .toBeVisible();
  });

  it("opens the activity log", async () => {
    const { onOpenAudit, screen } = setup({ settings: ON });

    await screen.getByRole("button", { name: "Open agent activity" }).click();

    expect(onOpenAudit).toHaveBeenCalledOnce();
  });

  it("draws the exposure check instantly with reduced motion", async () => {
    reduced.value = true;
    const { screen } = setup({ settings: ON });

    await screen.getByRole("checkbox", { name: /analytics/ }).click();

    await expect
      .poll(() => screen.container.querySelector("[data-motion='instant']"))
      .not.toBeNull();
  });
});
