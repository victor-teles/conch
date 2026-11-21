import { RefreshCwIcon } from "lucide-react";
import { useCurrentFrame } from "remotion";

import { Backdrop } from "@/components/backdrop";
import { BoardTile } from "@/components/board-tile";
import { AccountsTable, Kpi } from "@/components/board-widgets";
import { Caption } from "@/components/caption";
import { DonutChart } from "@/components/charts/donut-chart";
import { Legend } from "@/components/charts/legend";
import { LineChart } from "@/components/charts/line-chart";
import { ORDER_SLICES } from "@/data/asks";
import { MONTH_LABELS, REGION_MRR } from "@/data/revenue";
import { progress, useSpringAt } from "@/lib/anim";
import { COLOR, FONT, SPRING_SOFT, TYPE } from "@/theme";

export const BOARD_DURATION = 136;

const WINDOW = { height: 560, scale: 1.42, width: 1040 };
const TILE_STAGGER = 5;

const AREAS = `"mrr accounts trend" "orders orders trend" "table table table"`;

function TitleBar() {
  return (
    <div
      style={{
        ...TYPE.meta,
        alignItems: "center",
        borderBottom: `1px solid ${COLOR.panelBorder}`,
        display: "flex",
        gap: 8,
        height: 38,
        padding: "0 14px",
      }}
    >
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          style={{
            background: "oklch(1 0 0 / 0.14)",
            borderRadius: 999,
            height: 12,
            width: 12,
          }}
        />
      ))}
      <span style={{ flex: 1, fontWeight: 600, textAlign: "center" }}>
        Revenue
      </span>
      <span
        style={{
          alignItems: "center",
          color: COLOR.muted,
          display: "flex",
          gap: 6,
        }}
      >
        <RefreshCwIcon size={12} />
        every 5 min
      </span>
    </div>
  );
}

export function BoardScene() {
  const frame = useCurrentFrame();
  const springAt = useSpringAt(SPRING_SOFT);
  const enter = springAt(frame, 0);
  const tileAt = (index: number) => 6 + index * TILE_STAGGER;
  const mrr = Math.round(475 * progress(frame, tileAt(0), 30));
  return (
    <Backdrop>
      <div
        style={{
          background: COLOR.ink,
          border: `1px solid ${COLOR.panelBorder}`,
          borderRadius: 14,
          boxShadow: "0 40px 100px -24px oklch(0 0 0 / 0.7)",
          color: COLOR.foreground,
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT.sans,
          height: WINDOW.height,
          left: "50%",
          marginLeft: -WINDOW.width / 2,
          opacity: enter,
          overflow: "hidden",
          position: "absolute",
          top: 70,
          transform: `translateY(${(1 - enter) * 20}px) scale(${WINDOW.scale * (0.98 + enter * 0.02)})`,
          transformOrigin: "50% 0",
          width: WINDOW.width,
        }}
      >
        <TitleBar />
        <div
          style={{
            display: "grid",
            flex: 1,
            gap: 10,
            gridTemplateAreas: AREAS,
            gridTemplateColumns: "1fr 1fr 2fr",
            gridTemplateRows: "96px 1fr 168px",
            minHeight: 0,
            padding: 14,
          }}
        >
          <BoardTile area="mrr" enterAt={tileAt(0)} title="MRR">
            <Kpi delta="+54%" value={`$${mrr}k`} />
          </BoardTile>
          <BoardTile
            area="accounts"
            enterAt={tileAt(1)}
            title="Active accounts"
          >
            <Kpi delta="+12%" value="1,284" />
          </BoardTile>
          <BoardTile area="trend" enterAt={tileAt(2)} title="MRR by region">
            <Legend series={REGION_MRR} />
            <LineChart
              drawn={progress(frame, tileAt(2) + 4, 36)}
              height={208}
              labels={MONTH_LABELS}
              series={REGION_MRR}
              width={440}
            />
          </BoardTile>
          <BoardTile
            area="orders"
            enterAt={tileAt(3)}
            title="Orders by status this week"
          >
            <DonutChart
              size={130}
              slices={ORDER_SLICES}
              swept={progress(frame, tileAt(3) + 2, 30)}
              unit="orders"
            />
          </BoardTile>
          <BoardTile
            area="table"
            enterAt={tileAt(4)}
            title="Top accounts this month"
          >
            <AccountsTable />
          </BoardTile>
        </div>
      </div>
      <Caption
        cue={{
          from: 10,
          text: "Keep the answers you need on a board.",
          to: BOARD_DURATION - 8,
        }}
      />
    </Backdrop>
  );
}
