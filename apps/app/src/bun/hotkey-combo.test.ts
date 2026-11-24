import { describe, expect, it } from "vitest";

import { parseHotkeyCombo } from "./hotkey-combo.ts";

const OPTION = 0x8_00;
const SHIFT = 0x2_00;
const COMMAND = 0x1_00;
const CONTROL = 0x10_00;

describe("parseHotkeyCombo", () => {
  it("reads the default launcher hotkey", () => {
    expect(parseHotkeyCombo("Option+Shift+Space")).toStrictEqual({
      keyCode: 49,
      modifiers: OPTION + SHIFT,
    });
  });

  it.each([
    ["Cmd+K", { keyCode: 40, modifiers: COMMAND }],
    ["Control+Alt+F5", { keyCode: 96, modifiers: CONTROL + OPTION }],
    ["CommandOrControl + 1", { keyCode: 18, modifiers: COMMAND }],
    ["ctrl+return", { keyCode: 36, modifiers: CONTROL }],
  ])("reads %s", (accelerator, combo) => {
    expect(parseHotkeyCombo(accelerator)).toStrictEqual(combo);
  });

  it("counts a repeated modifier once", () => {
    expect(parseHotkeyCombo("Cmd+Command+Space")).toStrictEqual({
      keyCode: 49,
      modifiers: COMMAND,
    });
  });

  it.each(["", "Space", "Option+", "Option+Nope", "Hyper+Space"])(
    "refuses %j",
    (accelerator) => {
      expect(parseHotkeyCombo(accelerator)).toBeNull();
    }
  );
});
