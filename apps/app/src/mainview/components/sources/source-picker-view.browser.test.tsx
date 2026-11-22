import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { mockLauncherIpc } from "@/test/launcher-ipc";
import {
  makeEndpoint,
  makeServer,
  renderWithSources,
} from "@/test/source-fixtures";

import { SourcePickerView } from "./source-picker-view";

const setup = (servers = [makeServer()], endpoints = [makeEndpoint()]) => {
  mockLauncherIpc({
    handlers: {
      listHttpEndpoints: () => endpoints,
      listMcpServers: () => servers,
    },
  });
  const onChoose = vi.fn();
  const onOpenSettings = vi.fn();
  const screen = renderWithSources(
    <div style={{ width: 760 }}>
      <SourcePickerView
        onBack={vi.fn()}
        onChoose={onChoose}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
  return { onChoose, onOpenSettings, screen };
};

describe("source picker", () => {
  it("lists every source and chooses one with the keyboard", async () => {
    const { onChoose, screen } = setup();
    const list = screen.getByRole("listbox", { name: "Sources" });
    await expect.element(list).toHaveTextContent("Stripe");
    await expect
      .element(list)
      .toHaveTextContent("HTTP · https://status.example.com/api");
    expect(list.element()).toMatchSnapshot();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChoose).toHaveBeenCalledWith({ id: "status", type: "http" });
  });

  it("filters by name and still offers Settings", async () => {
    const { onChoose, onOpenSettings, screen } = setup();
    await screen
      .getByRole("combobox", { name: "Search sources" })
      .fill("strip");
    await expect.poll(() => screen.getByRole("option").all().length).toBe(2);
    await userEvent.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledWith({ id: "stripe", type: "mcp" });
    await screen.getByRole("option", { name: /Open Sources Settings/ }).click();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("points to Settings when there are no sources", async () => {
    const { onOpenSettings, screen } = setup([], []);
    await expect
      .element(
        screen.getByText(
          "No sources yet. Connect an MCP server or an HTTP API in Settings."
        )
      )
      .toBeVisible();
    await userEvent.keyboard("{Enter}");
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
