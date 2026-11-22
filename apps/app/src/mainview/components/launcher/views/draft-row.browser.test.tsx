import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { INITIAL_STATE } from "@/components/connection-form/connection-form-state";

import { DraftRow, draftSubtitle } from "./draft-row";

describe("draftRow", () => {
  it("names the draft by its connection name, then its host", () => {
    expect(draftSubtitle({ ...INITIAL_STATE, name: "billing" })).toBe(
      "billing"
    );
    expect(draftSubtitle({ ...INITIAL_STATE, host: "db.internal" })).toBe(
      "db.internal"
    );
    expect(draftSubtitle({ ...INITIAL_STATE, host: " " })).toBe("Unsaved");
  });

  it("renders a New Connection row marked as a draft and runs on click", async () => {
    const onRun = vi.fn();
    const screen = await render(
      <div role="listbox">
        <DraftRow
          draft={{ ...INITIAL_STATE, host: "db.internal" }}
          id="draft-connection"
          onHover={vi.fn()}
          onRun={onRun}
          selected
          tone="default"
        />
      </div>
    );
    const row = screen.getByRole("option", { name: /New Connection/ });
    await expect.element(row).toHaveTextContent("db.internalDraft");
    await row.click();
    expect(onRun).toHaveBeenCalledWith("draft-connection");
  });
});
