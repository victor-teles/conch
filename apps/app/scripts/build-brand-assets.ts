#!/usr/bin/env bun
import type { Page } from "playwright";

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const at = (...parts: string[]) => join(ROOT, ...parts);

const INK = "#121212";
const VERMILION = "#fc4738";
const VERMILION_ON_LIGHT = "#e31510";
const WORDMARK_ON_DARK = "#f2f2f2";
const WORDMARK_ON_LIGHT = "#181818";

const ICONSET: readonly (readonly [string, number])[] = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];
const ICO_SIZES = [16, 32, 48, 64, 128, 256] as const;

const SHELL_PATH = (() => {
  const svg = readFileSync(at(".github", "brand", "conch-mark.svg"), "utf8");
  const match = svg.match(/<path[^>]*\sd="([^"]+)"/);
  if (!match?.[1]) {
    throw new Error("conch-mark.svg has no path");
  }
  return match[1];
})();

const shell = (fill: string) =>
  `<path fill="${fill}" transform="translate(15 0)" d="${SHELL_PATH}"/>`;

// An exponent-5 superellipse approximates the continuous-curvature corners
// of a macOS icon body better than a circular radius.
const squirclePath = (x: number, y: number, size: number): string => {
  const half = size / 2;
  const cx = x + half;
  const cy = y + half;
  const steps = 360;
  const points = Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const px = cx + half * Math.sign(cos) * Math.abs(cos) ** (2 / 5);
    const py = cy + half * Math.sign(sin) * Math.abs(sin) ** (2 / 5);
    return `${px.toFixed(2)} ${py.toFixed(2)}`;
  });
  return `M ${points.join(" L ")} Z`;
};

const iconSvg = (): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%">
  <defs>
    <filter id="lift" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <path filter="url(#lift)" fill="${INK}" d="${squirclePath(100, 100, 824)}"/>
  <g transform="scale(1.024)">${shell(VERMILION)}</g>
</svg>`;

const lockupSvg = (shellFill: string, wordFill: string): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" width="1200" height="360">
  <g transform="translate(-9 -19) scale(0.4)">${shell(shellFill)}</g>
  <text x="348" y="252" fill="${wordFill}" font-family="Optima" font-weight="700" font-size="236">Conch</text>
</svg>`;

const page = (body: string, background = "transparent") => `<!doctype html>
<html><head><style>
  html, body { margin: 0; background: ${background}; }
  svg { display: block; }
</style></head><body>${body}</body></html>`;

const render = async (
  browser: Page,
  html: string,
  width: number,
  height: number,
  transparent = true
): Promise<Buffer> => {
  await browser.setViewportSize({ height, width });
  await browser.setContent(html);
  await browser.evaluate(() => document.fonts.ready);
  return browser.screenshot({
    clip: { height, width, x: 0, y: 0 },
    omitBackground: transparent,
  });
};

const renderIcon = (browser: Page, size: number) =>
  render(
    browser,
    page(`<div style="width:${size}px;height:${size}px">${iconSvg()}</div>`),
    size,
    size
  );

const encodeIco = (frames: readonly { size: number; png: Buffer }[]) => {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  for (const [index, { size, png }] of frames.entries()) {
    const entry = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
};

const dataUrl = (png: Buffer) =>
  `data:image/png;base64,${png.toString("base64")}`;

const reviewSheet = (assets: {
  icon: Buffer;
  small: readonly { size: number; png: Buffer }[];
  tray: Buffer;
  dark: Buffer;
  light: Buffer;
}) =>
  page(
    `<div style="width:1200px;height:920px;font:0/0 a">
      <div style="height:440px;background:#242424;display:flex;align-items:center;gap:48px;padding:0 56px;box-sizing:border-box">
        <img src="${dataUrl(assets.icon)}" width="320" height="320">
        ${assets.small
          .map(
            ({ size, png }) =>
              `<img src="${dataUrl(png)}" width="${size}" height="${size}">`
          )
          .join("")}
        <div style="background:#f0f0f1;padding:24px;border-radius:12px">
          <img src="${dataUrl(assets.tray)}" width="72" height="72" style="image-rendering:pixelated">
        </div>
      </div>
      <div style="height:240px;background:${INK}"><img src="${dataUrl(assets.dark)}" width="800" height="240" style="display:block;margin:0 auto"></div>
      <div style="height:240px;background:#f7f7f7"><img src="${dataUrl(assets.light)}" width="800" height="240" style="display:block;margin:0 auto"></div>
    </div>`
  );

const main = async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    const iconAt = new Map<number, Buffer>();
    const sizes = new Set([...ICONSET.map(([, size]) => size), ...ICO_SIZES]);
    for (const size of sizes) {
      iconAt.set(size, await renderIcon(tab, size));
    }
    const icon = (size: number): Buffer => {
      const png = iconAt.get(size);
      if (!png) {
        throw new Error(`no icon rendered at ${size}`);
      }
      return png;
    };

    for (const [name, size] of ICONSET) {
      writeFileSync(at("apps/app/assets/icon.iconset", name), icon(size));
    }
    writeFileSync(at("apps/app/assets/icon.png"), icon(512));
    writeFileSync(at(".github/brand/icon-1024.png"), icon(1024));
    writeFileSync(
      at("apps/app/assets/icon.ico"),
      encodeIco(ICO_SIZES.map((size) => ({ png: icon(size), size })))
    );

    const dark = await render(
      tab,
      page(lockupSvg(VERMILION, WORDMARK_ON_DARK)),
      1200,
      360
    );
    const light = await render(
      tab,
      page(lockupSvg(VERMILION_ON_LIGHT, WORDMARK_ON_LIGHT)),
      1200,
      360
    );
    writeFileSync(at(".github/logo-dark.png"), dark);
    writeFileSync(at(".github/logo-light.png"), light);

    const review = await render(
      tab,
      reviewSheet({
        dark,
        icon: icon(1024),
        light,
        small: [16, 32, 64, 128].map((size) => ({ png: icon(size), size })),
        tray: readFileSync(at("apps/app/assets/tray-template.png")),
      }),
      1200,
      920,
      false
    );
    writeFileSync(at(".github/brand/asset-review.png"), review);
  } finally {
    await browser.close();
  }
};

await main();
