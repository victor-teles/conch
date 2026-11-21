# video

Product videos for Conch, made with [Remotion](https://www.remotion.dev/docs). `ShowcaseReal` is built on screen recordings of the real app: the launcher is cut out of the footage and placed on a designed stage with headlines. `Showcase` is a frame-by-frame redraw of the launcher in React.

## Commands

Run these from `apps/video`:

```bash
bun run studio        # preview and scrub in Remotion Studio
bun run render:real   # render ShowcaseReal to out/showcase-real.mp4
bun run render        # render Showcase to out/showcase.mp4
bun run render:still  # render one frame to out/showcase.png
bun run test          # timing, chart and SQL-token unit tests
```

## Compositions

| ID             | Size      | FPS | Length | Use                                     |
| -------------- | --------- | --- | ------ | --------------------------------------- |
| `ShowcaseReal` | 1920×1080 | 30  | ~38 s  | Launch post on X, real footage (H.264). |
| `Showcase`     | 1920×1080 | 30  | ~38 s  | Redrawn version of the same story.      |

## Recording the real app

`ShowcaseReal` plays `public/footage/take8.mp4`. It is git-ignored, so record it again on a new machine:

1. Start the Docker fixtures (`infra/docker-compose.yaml`) and run `bun run capture:seed`. It creates a `showcase` database in Postgres and Mongo and fills Redis db 1. The `oh_my_query` fixtures and Redis db 0 stay untouched.
2. Run Conch with `bun run --cwd apps/app desktop:dev` and a separate `HOME`, so the demo shows only the demo connections. Add three connections: Production (Postgres, `showcase`), Orders (MongoDB, `showcase`) and Game cache (Redis, db 1).
3. Fill the screen behind the launcher with one flat colour: open a solid `rgb(18, 16, 14)` PNG in Preview and size the window to the screen. The edit cuts the panel out of that flat area and sets `BACKDROP_RGB` in `src/data/footage.ts` to the colour the footage decodes to (`rgb(16, 13, 12)` here), so the cut-out has no visible edge. Then run `python3 capture/take.py <out-dir> <path to Conch-dev.app>`. It needs `cua-driver` and Screen Recording permission for the app that runs it. It records the Retina display with `screencapture`, drives the launcher only while it is on screen, and writes `marks.json` with the time of every beat.
4. Convert the take to 30 fps H.264 under `public/footage/`, then set the clips and headlines in `src/data/footage.ts`. A shot can hold several clips, so the loading wait between a question and its answer is cut out.

`ShowcaseReal` is written for a broad audience: an intro card with the hotkey, then five real shots (a revenue bar chart, a refine to stacked quarters, a follow-up answered as a table, a MongoDB donut, and a plain-words "delete" that comes back as a read-only list), each with a headline beside the launcher, then the end card.

AI answers change between takes, so check each shot before using it.

## Redrawn showcase

`Showcase` has five scenes, joined by 14-frame fades:

1. **Ask**: the hotkey summons the launcher over an editor. A question is typed, the SQL streams in, and a line chart answers. A refine ("as stacked bars by quarter") turns the same card into stacked bars.
2. **Montage**: four quick asks on MongoDB, ClickHouse, Postgres and Redis, each answered with the chart that fits (donut, bars, a number, a table). It ends on a `delete` that is refused before it runs.
3. **Engines**: the eight supported engines.
4. **Board**: a board window with KPI, line, donut and table tiles.
5. **End**: the logo lockup, the tagline and the hotkey.

## Layout

- `src/scenes/`: one file per scene. `footage-timeline.ts` turns the shot list into frames; `ask-timeline.ts` and `montage-timeline.ts` hold the redrawn beats.
- `src/data/footage.ts`: the shot list for `ShowcaseReal` (clips in the take, headline copy) and the panel crop.
- `capture/`: demo-data seeds and the recording script.
- `src/data/asks.ts`: every question in the video, with its connection, query, card copy and chart data. Add an entry to `ENTRIES` in `montage-timeline.ts` to show another ask.
- `src/components/charts/`: line, stacked bar, donut, bar list, number and table charts, picked by `AskChart` from the ask's `chart.kind`.
- `src/components/`: launcher pieces redrawn for video (panel, rows, SQL block, answer card, board tiles). They are driven by `useCurrentFrame()`, not by Motion, so each frame renders the same way every time.
- `src/lib/`: pure helpers (typing, SQL tokens, chart math, height morphs) with unit tests.
- `src/theme.ts`: the dark tokens, type roles and springs from `apps/app`.

Panels are laid out at the app's real size (760 px wide) and scaled by `UI_SCALE` so the text reads on a phone.
