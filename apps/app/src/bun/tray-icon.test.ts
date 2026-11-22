import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TRAY_ICON = join(import.meta.dirname, "../../assets/tray-template.png");
const METERS_PER_INCH = 0.0254;

const chunk = (png: Buffer, type: string): Buffer => {
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === type) {
      return png.subarray(offset + 8, offset + 8 + length);
    }
    offset += 12 + length;
  }
  throw new Error(`no ${type} chunk`);
};

// Electrobun hands the image to the status item before resizing it, so the
// menu bar sizes the item from the file's own point size, not the 18 pt we ask.
describe("tray icon", () => {
  it("is 36 px at 144 dpi, so its natural size is the 18 pt we draw", () => {
    const png = readFileSync(TRAY_ICON);
    const header = chunk(png, "IHDR");
    const density = chunk(png, "pHYs");
    expect(header.readUInt32BE(0)).toBe(36);
    expect(header.readUInt32BE(4)).toBe(36);
    const dpi = Math.round(density.readUInt32BE(0) * METERS_PER_INCH);
    expect(dpi).toBe(144);
  });
});
