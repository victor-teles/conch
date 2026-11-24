export interface HotkeyCombo {
  keyCode: number;
  modifiers: number;
}

// Carbon modifier masks (Events.h).
const COMMAND = 0x1_00;
const SHIFT = 0x2_00;
const OPTION = 0x8_00;
const CONTROL = 0x10_00;

const MODIFIER_MASKS: Record<string, number> = {
  alt: OPTION,
  cmd: COMMAND,
  cmdorctrl: COMMAND,
  command: COMMAND,
  commandorcontrol: COMMAND,
  control: CONTROL,
  ctrl: CONTROL,
  meta: COMMAND,
  option: OPTION,
  shift: SHIFT,
  super: COMMAND,
};

// macOS virtual key codes for the ANSI layout (HIToolbox Events.h, kVK_*).
const KEY_CODES: Record<string, number> = {
  "0": 29,
  "1": 18,
  "2": 19,
  "3": 20,
  "4": 21,
  "5": 23,
  "6": 22,
  "7": 26,
  "8": 28,
  "9": 25,
  a: 0,
  b: 11,
  c: 8,
  d: 2,
  down: 125,
  e: 14,
  enter: 36,
  escape: 53,
  f: 3,
  f1: 122,
  f10: 109,
  f11: 103,
  f12: 111,
  f2: 120,
  f3: 99,
  f4: 118,
  f5: 96,
  f6: 97,
  f7: 98,
  f8: 100,
  f9: 101,
  g: 5,
  h: 4,
  i: 34,
  j: 38,
  k: 40,
  l: 37,
  left: 123,
  m: 46,
  n: 45,
  o: 31,
  p: 35,
  q: 12,
  r: 15,
  return: 36,
  right: 124,
  s: 1,
  space: 49,
  t: 17,
  tab: 48,
  u: 32,
  up: 126,
  v: 9,
  w: 13,
  x: 7,
  y: 16,
  z: 6,
};

export const parseHotkeyCombo = (accelerator: string): HotkeyCombo | null => {
  const parts = accelerator
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.at(-1);
  const keyCode = key === undefined ? undefined : KEY_CODES[key];
  if (keyCode === undefined) {
    return null;
  }
  const masks = new Set<number>();
  for (const name of parts.slice(0, -1)) {
    const mask = MODIFIER_MASKS[name];
    if (mask === undefined) {
      return null;
    }
    masks.add(mask);
  }
  const modifiers = [...masks].reduce((sum, mask) => sum + mask, 0);
  // A system hot key with no modifier would swallow a plain key everywhere.
  return modifiers === 0 ? null : { keyCode, modifiers };
};
