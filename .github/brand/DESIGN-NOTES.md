# Conch identity

The mark is **Whorl**: one continuous spiral with a broad negative-space channel, a compact circular core and a gently pointed outer lip at lower right. It is a single filled Bézier path in `conch-mark.svg` (square 1000-unit viewBox, `fill="currentColor"`), the source for every raster below and for the `ConchMark` component in the app.

## Colors

- Ink `#121212`: the icon tile.
- Vermilion `#fc4738` (`oklch(0.66 0.22 29)`): the shell on dark surfaces. It is the app's `--brand` token in dark mode.
- Vermilion on light `#e31510` (`oklch(0.58 0.23 29)`): the shell on light surfaces, the `--brand` token in light mode.
- Wordmark: Optima Bold, `#f2f2f2` on dark and `#181818` on light. It is rendered from the macOS system font into the transparent PNG lockups; no font file is distributed.

The warm ink and pale amber of the first identity (`#1a1614`, `#f6dcc0`) were retired with plan 024. The old app palette returns as the selectable Amber theme in plan 025.

## Geometry

The app-icon body is the centered 824-unit square from (100,100) to (924,924) on a 1024 canvas, drawn as an exponent-5 superellipse so the corners have continuous curvature, with transparent margin and a soft drop shadow. The shell is drawn at 1.024× its 1000-unit source, about 585 units wide. The tray icon is a tightly framed one-color version of the same shell; every RGB pixel is black and alpha carries the antialiasing.

## How the files are made

`bun run apps/app/scripts/build-brand-assets.ts` renders the SVG with Playwright's Chromium and writes the iconset, `icon.png`, `icon.ico` (16, 32, 48, 64, 128 and 256 PNG frames), `icon-1024.png`, both lockups and `asset-review.png`. Edit the path in `conch-mark.svg` or the colors in the script, then rerun it. The tray templates are not generated and stay as they are.

`verification.json` lists every output with its pixel size. The raster small sizes were inspected; Dock and menu-bar rendering in a running build was not tested.
