import { defaultThemeFor } from "@conch/rpc";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { AppProviders } from "@/components/app-providers";
import { hexOf } from "@/components/themes/hex-color";
import { makeCustomTheme, mockThemes, rootToken } from "@/test/theme-fixtures";

import type { ThemeEditSource } from "./theme-edit-source";

import { ThemeEditView } from "./theme-edit-view";

const conchDark = defaultThemeFor("dark");

const NEW_FROM_CONCH: ThemeEditSource = { from: conchDark, kind: "new" };

const renderEditor = async (source: ThemeEditSource = NEW_FROM_CONCH) => {
  await mockThemes({
    custom: source.kind === "existing" ? [source.theme] : [],
  });
  const onBack = vi.fn();
  const onSaved = vi.fn();
  const screen = render(
    <AppProviders>
      <ThemeEditView onBack={onBack} onSaved={onSaved} source={source} />
    </AppProviders>
  );
  return { onBack, onSaved, screen };
};

type Screen = Awaited<ReturnType<typeof renderEditor>>["screen"];

const status = (screen: Screen) =>
  screen.container.querySelector("[data-slot='footer-status']");

const group = (screen: Screen, name: string) =>
  screen.getByRole("group", { exact: true, name });

describe("theme editor", () => {
  it("starts a copy named after its source and reads as readable", async () => {
    const { screen } = await renderEditor();

    await expect
      .element(screen.getByRole("textbox", { exact: true, name: "Theme name" }))
      .toHaveValue("Conch Dark copy");
    await expect
      .element(screen.getByRole("radiogroup", { name: "Appearance" }))
      .toBeVisible();
    expect(status(screen)?.textContent).toContain("Readable");
    expect(group(screen, "Text").element()).toMatchSnapshot();
  });

  it("hides the appearance control when editing a saved theme", async () => {
    const { screen } = await renderEditor({
      kind: "existing",
      theme: makeCustomTheme(),
    });
    await expect
      .element(screen.getByRole("textbox", { exact: true, name: "Theme name" }))
      .toHaveValue("Ink");
    expect(
      screen.getByRole("radiogroup", { name: "Appearance" }).query()
    ).toBeNull();
  });

  it("previews a hex edit across the launcher and keeps the opacity", async () => {
    const { screen } = await renderEditor();
    const field = screen.getByRole("textbox", {
      exact: true,
      name: "Selected row hex",
    });

    await expect.element(field).toHaveValue("#ffffff");
    await expect
      .element(
        screen.getByRole("textbox", {
          exact: true,
          name: "Selected row opacity",
        })
      )
      .toHaveValue("10");
    await field.fill("#f00");
    expect(rootToken("row-active")).toBe("#ff00001a");
    await field.fill("#00ff0080");
    expect(rootToken("row-active")).toBe("#00ff0080");
    await screen
      .getByRole("textbox", { exact: true, name: "Selected row opacity" })
      .fill("50");
    expect(rootToken("row-active")).toBe("#00ff0080");
    await screen
      .getByRole("textbox", { exact: true, name: "Selected row opacity" })
      .fill("25");
    expect(rootToken("row-active")).toBe("#00ff0040");
  });

  it("shows an error for a bad hex value and does not apply it", async () => {
    const { screen } = await renderEditor();
    const field = screen.getByRole("textbox", {
      exact: true,
      name: "Text hex",
    });

    await field.fill("#zz");
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Use #rgb, #rrggbb or #rrggbbaa");
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    expect(rootToken("foreground")).toBe(conchDark.tokens.foreground);

    await screen
      .getByRole("textbox", { exact: true, name: "Theme name" })
      .click();
    await expect.element(field).toHaveValue(hexOf(conchDark.tokens.foreground));
    expect(screen.getByRole("alert").query()).toBeNull();
  });

  it("offers opacity only on translucent tokens", async () => {
    const { screen } = await renderEditor();
    await expect
      .element(
        screen.getByRole("textbox", { exact: true, name: "Panel opacity" })
      )
      .toBeVisible();
    expect(
      screen.getByRole("textbox", { exact: true, name: "Text opacity" }).query()
    ).toBeNull();
  });

  it("notes a weak pair and counts it in the footer", async () => {
    const { screen } = await renderEditor();

    await screen
      .getByRole("textbox", { exact: true, name: "Panel muted text hex" })
      .fill("#555555");
    await expect
      .element(group(screen, "Panel muted text"))
      .toHaveTextContent(/aim for 4\.5/);
    expect(status(screen)?.textContent).toMatch(/\d contrast notes?/);
    expect(group(screen, "Text").element()).toMatchSnapshot();
  });

  it("blocks saving a theme whose text cannot be read", async () => {
    const { onSaved, screen } = await renderEditor();

    await screen
      .getByRole("textbox", { exact: true, name: "Text hex" })
      .fill(hexOf(conchDark.tokens.background));
    await expect.element(screen.getByText(/Raise it to save\./)).toBeVisible();
    expect(rootToken("foreground")).toBe(conchDark.tokens.foreground);
    await userEvent.keyboard("{Meta>}s{/Meta}");
    expect(onSaved).not.toHaveBeenCalled();
    expect(group(screen, "Text").element()).toMatchSnapshot();
  });

  it("saves with ⌘S", async () => {
    const { onSaved, screen } = await renderEditor();

    await screen
      .getByRole("textbox", { exact: true, name: "Theme name" })
      .fill("Night");
    await userEvent.keyboard("{Meta>}s{/Meta}");
    await expect.poll(() => onSaved.mock.calls.length).toBe(1);
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      appearance: "dark",
      id: expect.stringMatching(/^theme_/),
      name: "Night",
    });
  });

  it("asks for a second Esc before discarding changes", async () => {
    const { onBack, screen } = await renderEditor();

    await screen
      .getByRole("textbox", { exact: true, name: "Theme name" })
      .fill("Night");
    await userEvent.keyboard("{Escape}");
    await expect
      .element(screen.getByText("Press Esc again to discard"))
      .toBeVisible();
    expect(onBack).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("leaves at once when nothing changed", async () => {
    const { onBack } = await renderEditor();
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("edits with the picker by keyboard, and Esc closes only the picker", async () => {
    const { onBack, screen } = await renderEditor();

    await screen.getByRole("button", { name: "Pick Brand" }).click();
    const hue = screen.getByRole("slider", { name: "Hue" });
    await expect.element(hue).toBeVisible();
    await hue.click();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect
      .poll(() => rootToken("brand"))
      .not.toBe(conchDark.tokens.brand);

    await userEvent.keyboard("{Escape}");
    await expect.element(hue).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText("Press Esc again to discard").query()).toBeNull();
  });
});
