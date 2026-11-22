import type { AskChart as AskChartData } from "@/data/asks";

import { PANEL_WIDTH } from "@/theme";

import { BarList } from "./bar-list";
import { DonutChart } from "./donut-chart";
import { KpiChart } from "./kpi-chart";
import { Legend } from "./legend";
import { LineChart } from "./line-chart";
import { RowsTable } from "./rows-table";
import { StackedBars } from "./stacked-bars";

export const CHART_HEIGHT = 220;
export const CHART_WIDTH = PANEL_WIDTH - 32;

const LEGEND_SPACE = 30;

interface AskChartProps {
  chart: AskChartData;
  progress: number;
}

function ChartFor({ chart, progress }: AskChartProps) {
  switch (chart.kind) {
    case "line": {
      return (
        <>
          <Legend series={chart.series} />
          <LineChart
            drawn={progress}
            height={CHART_HEIGHT - LEGEND_SPACE}
            labels={chart.labels}
            series={chart.series}
            width={CHART_WIDTH}
          />
        </>
      );
    }
    case "stacked": {
      return (
        <>
          <Legend series={chart.series} />
          <StackedBars
            grown={progress}
            height={CHART_HEIGHT - LEGEND_SPACE}
            labels={chart.labels}
            series={chart.series}
            width={CHART_WIDTH}
          />
        </>
      );
    }
    case "donut": {
      return (
        <DonutChart
          size={CHART_HEIGHT - 12}
          slices={chart.slices}
          swept={progress}
          unit={chart.unit}
        />
      );
    }
    case "bars": {
      return <BarList grown={progress} rows={chart.rows} unit={chart.unit} />;
    }
    case "kpi": {
      return (
        <KpiChart
          counted={progress}
          delta={chart.delta}
          label={chart.label}
          spark={chart.spark}
          value={chart.value}
          width={CHART_WIDTH}
        />
      );
    }
    default: {
      return (
        <RowsTable columns={chart.columns} rows={chart.rows} shown={progress} />
      );
    }
  }
}

export function AskChart({ chart, progress }: AskChartProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        height: CHART_HEIGHT,
        padding: "0 16px",
      }}
    >
      <ChartFor chart={chart} progress={progress} />
    </div>
  );
}
