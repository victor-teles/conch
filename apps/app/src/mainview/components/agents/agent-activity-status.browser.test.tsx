import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { emitIpcMessage, mockIpc } from "@/test/ipc-mock";
import { makeActivity } from "@/test/mcp-fixtures";
import { wait } from "@/test/wait";

import {
  AgentActivityProvider,
  useAgentActivityStatus,
} from "./agent-activity-provider";
import { AgentActivityStatus } from "./agent-activity-status";
import { ACTIVITY_LINGER_MS } from "./use-agent-activity";

const reduced = vi.hoisted(() => ({ value: false }));

vi.mock(import("motion/react"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useReducedMotion: () => reduced.value };
});

function Probe() {
  return <AgentActivityStatus activity={useAgentActivityStatus()} />;
}

const setup = () => {
  mockIpc({});
  return render(
    <AgentActivityProvider>
      <Probe />
    </AgentActivityProvider>
  );
};

const PHRASE = "Claude Code is asking analytics";

describe("agentActivityStatus", () => {
  beforeEach(() => {
    reduced.value = false;
  });

  it("stays empty while no agent is calling", () => {
    const screen = setup();
    const live = screen.container.querySelector("[aria-live='polite']");
    expect(live?.textContent).toBe("");
  });

  it("names the newest call with a breathing dot", async () => {
    const screen = setup();

    emitIpcMessage("mcpActivity", {
      active: [
        makeActivity({
          id: "old",
          startedAt: "2026-11-21T09:40:00.000Z",
          tool: "list_widgets",
        }),
        makeActivity({ client: "claude-code" }),
      ],
    });

    await expect.element(screen.getByText(PHRASE)).toBeVisible();
    expect(
      screen.container.querySelector("[data-motion='breathe']")
    ).not.toBeNull();
    expect(screen.container).toMatchSnapshot();
  });

  it("lingers after the last call ends, then leaves", async () => {
    const screen = setup();
    emitIpcMessage("mcpActivity", { active: [makeActivity()] });
    await expect.element(screen.getByText(PHRASE)).toBeVisible();

    emitIpcMessage("mcpActivity", { active: [] });
    await wait(ACTIVITY_LINGER_MS / 2);
    await expect.element(screen.getByText(PHRASE)).toBeVisible();

    await expect
      .poll(() => screen.getByText(PHRASE).query(), {
        timeout: ACTIVITY_LINGER_MS * 2,
      })
      .toBeNull();
  });

  it("keeps the dot still with reduced motion", async () => {
    reduced.value = true;
    const screen = setup();

    emitIpcMessage("mcpActivity", { active: [makeActivity()] });

    await expect.element(screen.getByText(PHRASE)).toBeVisible();
    expect(
      screen.container.querySelector("[data-motion='static']")
    ).not.toBeNull();
    expect(
      screen.container.querySelector("[data-motion='breathe']")
    ).toBeNull();
  });

  it("reads null outside the provider", () => {
    mockIpc({});
    const screen = render(<Probe />);
    expect(screen.container.textContent).toBe("");
  });
});
