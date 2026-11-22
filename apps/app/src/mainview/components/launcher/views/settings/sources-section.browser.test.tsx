import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockLauncherIpc } from "@/test/launcher-ipc";
import {
  makeEndpoint,
  makeServer,
  renderWithSources,
} from "@/test/source-fixtures";

import { SOURCES_EMPTY, SourcesSection } from "./sources-section";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

const setup = (
  handlers: Record<string, (payload: Record<string, unknown>) => unknown>
) => {
  mockLauncherIpc({ handlers });
  const onOpen = vi.fn();
  const screen = renderWithSources(
    <div style={{ width: 760 }}>
      <SourcesSection onOpen={onOpen} />
    </div>
  );
  return { onOpen, screen };
};

describe.each([false, true])(
  "sources section (reduced motion %s)",
  (isReduced) => {
    beforeEach(() => {
      reduced.value = isReduced;
    });

    it("shows one quiet line and both add buttons when there are no sources", async () => {
      const { onOpen, screen } = setup({
        listHttpEndpoints: () => [],
        listMcpServers: () => [],
      });
      await expect.element(screen.getByText(SOURCES_EMPTY)).toBeVisible();
      await screen.getByRole("button", { name: "Add MCP Server" }).click();
      await screen.getByRole("button", { name: "Add HTTP Endpoint" }).click();
      expect(onOpen.mock.calls).toStrictEqual([
        [{ id: null, type: "mcp" }],
        [{ id: null, type: "http" }],
      ]);
      expect(screen.container).toMatchSnapshot();
    });

    it("lists servers and endpoints with their last test", async () => {
      const { onOpen, screen } = setup({
        listHttpEndpoints: () => [
          makeEndpoint({
            lastTest: {
              latencyMs: 40,
              message: "Status API answered 503.",
              ok: false,
            },
          }),
        ],
        listMcpServers: () => [
          makeServer({
            lastTest: {
              latencyMs: 86,
              message: "Connected · 2 tools · 1 read",
              ok: true,
            },
          }),
        ],
      });
      const list = screen.getByRole("list", { name: "Sources" });
      await expect.element(list).toHaveTextContent("Stripe");
      await expect
        .element(list)
        .toHaveTextContent("Connected · 2 tools · 1 read");
      await expect
        .element(list)
        .toHaveTextContent("/opt/homebrew/bin/npx -y @stripe/mcp");
      await expect
        .element(screen.getByText("Status API answered 503."))
        .toBeVisible();
      await screen.getByRole("button", { name: "Edit Status API" }).click();
      expect(onOpen).toHaveBeenCalledWith({ id: "status", type: "http" });
      expect(list.element()).toMatchSnapshot();
    });
  }
);

describe("sources section load states", () => {
  it("reports a failed load and retries", async () => {
    const { screen } = setup({
      listHttpEndpoints: () => [],
      listMcpServers: vi
        .fn()
        .mockRejectedValueOnce(new Error("Sources could not load."))
        .mockReturnValue([makeServer()]),
    });
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Sources could not load.");
    await screen.getByRole("button", { name: "Retry" }).click();
    await expect
      .element(screen.getByRole("button", { name: "Edit Stripe" }))
      .toBeVisible();
  });

  it("shows placeholders only when loading takes a while", async () => {
    const pending = Promise.withResolvers<unknown>();
    const { screen } = setup({
      listHttpEndpoints: () => pending.promise,
      listMcpServers: () => [],
    });
    await expect
      .element(screen.getByRole("status", { name: "Loading sources" }))
      .toBeVisible();
    pending.resolve([]);
    await expect.element(screen.getByText(SOURCES_EMPTY)).toBeVisible();
  });
});
