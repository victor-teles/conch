import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { RedactedMcpServer } from "@/lib/ipc";

import { mockLauncherIpc } from "@/test/launcher-ipc";
import {
  makeEndpoint,
  makeMcpWidget,
  makeServer,
  renderWithSources,
  TOOLS,
} from "@/test/source-fixtures";
import { swapsSettled } from "@/test/wait";

import { SourceEditView } from "./source-edit-view";
import { MARKED_NOTE, READ_CAUTION } from "./tool-row";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

type Handler = (payload: Record<string, unknown>) => unknown;

const setup = (
  target: { type: "mcp" | "http"; id: string | null },
  handlers: Record<string, Handler> = {}
) => {
  const calls = {
    saveHttpEndpoint: vi.fn((payload: Record<string, unknown>) => {
      const { endpoint } = payload as { endpoint: { name: string } };
      return makeEndpoint({ name: endpoint.name });
    }),
    saveMcpServer: vi.fn((payload: Record<string, unknown>) => {
      const { server } = payload as { server: { name: string } };
      return makeServer({ id: "stripe-new", name: server.name });
    }),
    testHttpEndpoint: vi.fn(() => ({
      latencyMs: 31,
      message: "Connected · 200",
      ok: true,
    })),
    testMcpServer: vi.fn(() => ({
      latencyMs: 86,
      message: "Connected · 2 tools · 1 read",
      ok: true,
      readToolCount: 1,
      toolCount: 2,
    })),
  };
  mockLauncherIpc({
    handlers: {
      ...calls,
      deleteMcpServer: () => ({ widgetNames: ["Open disputes"] }),
      listHttpEndpoints: () => [makeEndpoint()],
      listMcpServers: () => [makeServer()],
      listMcpTools: () => TOOLS,
      listWidgets: () => [makeMcpWidget()],
      ...handlers,
    },
  });
  const onBack = vi.fn();
  const screen = renderWithSources(
    <div style={{ width: 760 }}>
      <SourceEditView onBack={onBack} target={target} />
    </div>
  );
  return { calls, onBack, screen };
};

describe.each([false, true])(
  "mCP server editor (reduced motion %s)",
  (isReduced) => {
    beforeEach(() => {
      reduced.value = isReduced;
    });

    it("saves a new local command on ⌘T, tests it and lists its tools", async () => {
      const { calls, screen } = setup({ id: null, type: "mcp" });
      await screen
        .getByRole("textbox", { exact: true, name: "Name" })
        .fill("Stripe");
      await screen.getByRole("textbox", { name: "Command" }).fill("npx");
      await screen
        .getByRole("textbox", { name: "Arguments" })
        .fill("-y\n@stripe/mcp");
      await screen.getByRole("button", { name: "Add variable" }).click();
      await screen
        .getByRole("textbox", { name: "Variable name" })
        .fill("STRIPE_KEY");
      await screen.getByLabelText("STRIPE_KEY value").fill("sk_test_123");
      await userEvent.keyboard("{Meta>}t{/Meta}");

      await expect
        .element(screen.getByText("Connected · 2 tools · 1 read · 86 ms"))
        .toBeVisible();
      expect(calls.saveMcpServer).toHaveBeenCalledWith({
        server: {
          args: ["-y", "@stripe/mcp"],
          command: "npx",
          env: [{ name: "STRIPE_KEY", value: "sk_test_123" }],
          name: "Stripe",
          transport: "stdio",
        },
      });
      expect(calls.testMcpServer).toHaveBeenCalledWith({
        serverId: "stripe-new",
      });
      const tools = screen.getByRole("list", { name: "Tools" });
      await expect.element(tools).toHaveTextContent("Read-only");
      await expect
        .element(
          screen.getByRole("checkbox", { name: "Treat refund_charge as read" })
        )
        .not.toBeChecked();
      await expect.poll(() => swapsSettled(screen.container)).toBeTruthy();
      expect(tools.element()).toMatchSnapshot();
    });

    it("says when the system dialog was cancelled and saves nothing", async () => {
      const { screen } = setup(
        { id: null, type: "mcp" },
        { saveMcpServer: () => null }
      );
      await screen
        .getByRole("textbox", { exact: true, name: "Name" })
        .fill("Stripe");
      await screen.getByRole("textbox", { name: "Command" }).fill("npx");
      await userEvent.keyboard("{Meta>}s{/Meta}");
      await expect
        .element(
          screen.getByText("Not saved. The system dialog was cancelled.")
        )
        .toBeVisible();
    });
  }
);

describe("treat as read", () => {
  const openTools = async (handlers: Record<string, Handler>) => {
    const view = setup({ id: "stripe", type: "mcp" }, handlers);
    await view.screen.getByRole("button", { name: "Test" }).click();
    const box = view.screen.getByRole("checkbox", {
      name: "Treat refund_charge as read",
    });
    await expect.element(box).toBeVisible();
    return { ...view, box };
  };

  it("shows the caution while the system dialog is open and draws the check once approved", async () => {
    const reply = Promise.withResolvers<RedactedMcpServer | null>();
    const { box, screen } = await openTools({
      setMcpToolRead: () => reply.promise,
    });
    await box.click();
    await expect.element(screen.getByText(READ_CAUTION)).toBeVisible();
    reply.resolve(makeServer({ readTools: ["refund_charge"] }));
    await expect.element(box).toBeChecked();
    await expect.element(screen.getByText(MARKED_NOTE)).toBeVisible();
  });

  it("leaves the tool unmarked when the dialog is declined", async () => {
    const setRead = vi.fn(() => null);
    const { box, screen } = await openTools({ setMcpToolRead: setRead });
    await box.click();
    await expect.poll(() => setRead.mock.calls.length).toBe(1);
    await expect.element(box).not.toBeChecked();
    await expect.poll(() => screen.getByText(READ_CAUTION).query()).toBeNull();
  });
});

describe("server problems", () => {
  it("reports a failed test and asks for a name first", async () => {
    const { screen } = setup(
      { id: "stripe", type: "mcp" },
      {
        testMcpServer: () => ({
          latencyMs: 12,
          message: "Stripe: spawn ENOENT",
          ok: false,
        }),
      }
    );
    await screen.getByRole("button", { name: "Test" }).click();
    await expect
      .element(screen.getByText("Stripe: spawn ENOENT"))
      .toBeVisible();
    await expect
      .element(screen.getByText("Test the server to see its tools."))
      .toBeVisible();
    await screen.getByRole("textbox", { exact: true, name: "Name" }).fill("");
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await expect
      .element(screen.getByText("Give the server a name."))
      .toBeVisible();
  });

  it("switches to a remote URL and removes the server after confirming", async () => {
    const { onBack, screen } = setup({ id: "stripe", type: "mcp" });
    await screen.getByRole("radio", { name: "Remote URL" }).click();
    await expect
      .element(screen.getByRole("textbox", { name: "URL" }))
      .toBeVisible();
    const remove = screen.getByRole("button", { name: "Remove" });
    await remove.click();
    await expect
      .element(screen.getByText("Used by 1 widget · remove again"))
      .toBeVisible();
    await screen.getByRole("button", { name: /remove again/ }).click();
    await expect.poll(() => onBack.mock.calls.length).toBe(1);
  });
});

describe("hTTP endpoint editor", () => {
  it("keeps the stored header unless a new value is typed, and tests the base URL", async () => {
    const { calls, screen } = setup({ id: "status", type: "http" });
    const value = screen.getByLabelText("Header value");
    await expect
      .element(value)
      .toHaveAttribute("placeholder", "Unchanged · ends in 4242");
    await screen
      .getByRole("textbox", { exact: true, name: "Name" })
      .fill("Status");
    await userEvent.keyboard("{Meta>}t{/Meta}");
    await expect
      .element(screen.getByText("Connected · 200 · 31 ms"))
      .toBeVisible();
    expect(calls.saveHttpEndpoint).toHaveBeenCalledWith({
      endpoint: {
        auth: { kind: "header", name: "Authorization", value: undefined },
        baseUrl: "https://status.example.com/api",
        id: "status",
        name: "Status",
      },
    });
    expect(calls.testHttpEndpoint).toHaveBeenCalledWith({
      endpointId: "status",
    });
  });

  it("drops the header when auth is None", async () => {
    const { calls, screen } = setup({ id: null, type: "http" });
    await screen
      .getByRole("textbox", { exact: true, name: "Name" })
      .fill("Open data");
    await screen
      .getByRole("textbox", { name: "Base URL" })
      .fill("https://data.example.com");
    await screen.getByRole("radio", { name: "None" }).click();
    await expect
      .poll(() => screen.getByLabelText("Header value").query())
      .toBeNull();
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await expect.poll(() => calls.saveHttpEndpoint.mock.calls.length).toBe(1);
    expect(calls.saveHttpEndpoint.mock.calls[0]?.[0]).toMatchObject({
      endpoint: { auth: { kind: "none" }, baseUrl: "https://data.example.com" },
    });
  });
});
