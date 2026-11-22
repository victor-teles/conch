import { BUILTIN_THEMES } from "@conch/rpc";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { AppProviders } from "@/components/app-providers";
import { makeCustomTheme, mockThemes, rootToken } from "@/test/theme-fixtures";

import { ThemesView } from "./themes-view";

const amberDark = BUILTIN_THEMES.find((theme) => theme.id === "amber-dark");
const conchDark = BUILTIN_THEMES.find((theme) => theme.id === "conch-dark");

const renderThemes = (selectedId?: string) => {
  const onEdit = vi.fn();
  const screen = render(
    <AppProviders>
      <ThemesView onEdit={onEdit} selectedId={selectedId} />
    </AppProviders>
  );
  return { onEdit, screen };
};

const option = (
  screen: ReturnType<typeof renderThemes>["screen"],
  name: string
) => screen.getByRole("option", { name: new RegExp(name) });

const otherAppearance = () =>
  matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";

describe("themes view", () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, "__conchThemeImport");
  });

  it("lists themes by appearance and marks the ones in use", async () => {
    await mockThemes({ custom: [makeCustomTheme()] });
    const { screen } = renderThemes();

    await expect
      .element(screen.getByRole("group", { name: "Dark" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("group", { name: "Light" }))
      .toBeVisible();
    await expect.element(option(screen, "Ink")).toHaveTextContent("Custom");
    await expect
      .element(
        option(screen, "Conch Dark").getByRole("img", { name: "In use" })
      )
      .toBeVisible();
    expect(
      option(screen, "Amber Dark").getByRole("img", { name: "In use" }).query()
    ).toBeNull();
    expect(screen.getByRole("listbox").element()).toMatchSnapshot();
  });

  it("previews the selection and restores the theme in use on leave", async () => {
    await mockThemes();
    const { screen } = renderThemes();

    await expect
      .element(option(screen, "Conch Dark"))
      .toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    await expect
      .element(option(screen, "Amber Dark"))
      .toHaveAttribute("aria-selected", "true");
    expect(rootToken("primary")).toBe(amberDark?.tokens.primary);

    screen.unmount();
    expect(rootToken("primary")).toBe(conchDark?.tokens.primary);
  });

  it("uses a theme and switches the mode to show it", async () => {
    await mockThemes();
    const { screen } = renderThemes("amber-light");

    await userEvent.keyboard("{Enter}");
    await expect.element(screen.getByText("Using Amber Light")).toBeVisible();
    await expect
      .element(
        option(screen, "Amber Light").getByRole("img", { name: "In use" })
      )
      .toBeVisible();
    expect(document.documentElement.classList.contains("light")).toBeTruthy();
  });

  it("explains a theme chosen for the other appearance in System mode", async () => {
    await mockThemes({ settings: { mode: "system" } });
    const system = otherAppearance();
    const { screen } = renderThemes(`amber-${system}`);

    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByText(`Used when your Mac is in ${system} mode`))
      .toBeVisible();
  });

  it("filters by typing", async () => {
    await mockThemes();
    const { screen } = renderThemes();

    await userEvent.keyboard("amber");
    await expect.element(option(screen, "Amber Light")).toBeVisible();
    await expect
      .poll(() => screen.getByRole("option").elements())
      .toHaveLength(2);
    await userEvent.keyboard("zzz");
    await expect.element(screen.getByText("No themes match")).toBeVisible();
  });

  it("leads the menu with Use Theme and duplicates into the editor", async () => {
    await mockThemes();
    const { onEdit, screen } = renderThemes();

    await userEvent.keyboard("{Meta>}k{/Meta}");
    const menu = screen.getByRole("menu", { name: "Actions for Conch Dark" });
    const items = menu.getByRole("menuitem").elements();
    expect(items.map((item) => item.textContent)).toStrictEqual([
      expect.stringContaining("Use Theme"),
      expect.stringContaining("Duplicate"),
      expect.stringContaining("Export"),
      expect.stringContaining("New Theme"),
      expect.stringContaining("Import Theme"),
    ]);
    await menu.getByRole("menuitem", { name: /Duplicate/ }).click();
    expect(onEdit).toHaveBeenCalledWith({ from: conchDark, kind: "new" });
  });

  it("edits a custom theme and deletes it with two presses", async () => {
    const ink = makeCustomTheme();
    await mockThemes({ custom: [ink] });
    const { onEdit, screen } = renderThemes(ink.id);

    await userEvent.keyboard("{Meta>}e{/Meta}");
    expect(onEdit).toHaveBeenCalledWith({ kind: "existing", theme: ink });

    await userEvent.keyboard("{Control>}x{/Control}");
    await expect
      .element(screen.getByText("Press again to delete"))
      .toBeVisible();
    await userEvent.keyboard("{Control>}x{/Control}");
    await expect.element(screen.getByText("Deleted Ink")).toBeVisible();
    await expect.element(option(screen, "Ink")).not.toBeInTheDocument();
  });

  it("does not edit or delete a built-in", async () => {
    await mockThemes();
    const { onEdit, screen } = renderThemes();

    await userEvent.keyboard("{Meta>}e{/Meta}{Control>}x{/Control}");
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("Press again to delete").query()).toBeNull();
  });

  it("exports and imports theme files", async () => {
    await mockThemes();
    const { screen } = renderThemes();

    await userEvent.keyboard("{Meta>}k{/Meta}");
    await screen.getByRole("menuitem", { name: /Export/ }).click();
    await expect
      .element(
        screen.getByText("Saved Conch Dark.conch-theme.json to Downloads")
      )
      .toBeVisible();

    await userEvent.keyboard("{Meta>}o{/Meta}");
    await expect
      .element(screen.getByText("That file is not a Conch theme."))
      .toBeVisible();

    const { id: _id, ...file } = makeCustomTheme({ name: "Imported" });
    Object.assign(globalThis, { __conchThemeImport: JSON.stringify(file) });
    await userEvent.keyboard("{Meta>}o{/Meta}");
    await expect.element(screen.getByText("Imported Imported")).toBeVisible();
    await expect
      .element(option(screen, "Imported"))
      .toHaveAttribute("aria-selected", "true");
  });
});
