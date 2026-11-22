import { describe, expect, it, vi } from "vitest";

import { LauncherListbox } from "@/components/launcher/launcher-list";
import { makeConnection } from "@/test/connection-fixture";
import { mockLauncherIpc } from "@/test/launcher-ipc";
import {
  makeMcpWidget,
  makeServer,
  renderWithSources,
} from "@/test/source-fixtures";
import { makeWidget } from "@/test/widget-fixtures";

import { WidgetRow } from "./widget-row";

const events = { onHover: vi.fn(), onRun: vi.fn() };

describe("widget rows by source", () => {
  it("shows the connection for SQL and the server for MCP and HTTP", async () => {
    mockLauncherIpc({ handlers: { listMcpServers: () => [makeServer()] } });
    const screen = renderWithSources(
      <LauncherListbox id="rows" label="Widgets">
        <WidgetRow
          connection={makeConnection()}
          events={events}
          id="sql"
          selected={false}
          widget={makeWidget()}
        />
        <WidgetRow
          connection={null}
          events={events}
          id="mcp"
          selected={false}
          widget={makeMcpWidget()}
        />
        <WidgetRow
          connection={null}
          events={events}
          id="http"
          selected={false}
          widget={makeWidget({
            id: "w-http",
            name: "Incidents",
            params: [],
            source: {
              endpointId: "gone",
              kind: "http",
              method: "GET",
              path: "/incidents",
              query: {},
              select: "$",
            },
          })}
        />
      </LauncherListbox>
    );
    await expect
      .element(screen.getByRole("img", { name: "Stripe · MCP" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("img", { name: "HTTP" }))
      .toBeVisible();
    expect(
      screen.container.querySelectorAll("[data-source-kind]")
    ).toHaveLength(2);
  });
});
