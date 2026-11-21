import type { BrowserCommand } from "vitest/node";

declare module "vitest/browser" {
  interface BrowserCommands {
    resetPointer: () => Promise<void>;
  }
}

export const resetPointer: BrowserCommand<[]> = async ({ page }) => {
  await page.mouse.move(-1, -1);
};
