import type { ReactNode } from "react";

import { DotIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import type { CardCopy } from "@/data/asks";

import { COLOR, TYPE } from "@/theme";

export const ANSWER_CARD_HEIGHT = 350;

const TREND_ICONS = {
  down: TrendingDownIcon,
  flat: DotIcon,
  up: TrendingUpIcon,
} as const;

export interface CardReveal {
  heading: number;
  insight: number;
}

interface AnswerCardProps {
  copy: CardCopy;
  reveal: CardReveal;
  children: ReactNode;
}

const rise = (amount: number) => ({
  opacity: amount,
  transform: `translateY(${(1 - amount) * 6}px)`,
});

function ViewToggle({
  views,
  view,
}: {
  views: readonly string[];
  view: string;
}) {
  return (
    <div
      style={{
        ...TYPE.micro,
        background: COLOR.rowHover,
        borderRadius: 8,
        display: "flex",
        padding: 2,
      }}
    >
      {views.map((option) => (
        <span
          key={option}
          style={{
            background: option === view ? COLOR.panelRaised : undefined,
            borderRadius: 6,
            color: option === view ? COLOR.foreground : COLOR.muted,
            padding: "3px 9px",
          }}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

export function AnswerCard({ copy, reveal, children }: AnswerCardProps) {
  const TrendIcon = TREND_ICONS[copy.trend];
  return (
    <section style={{ height: ANSWER_CARD_HEIGHT }}>
      <div
        style={{
          alignItems: "flex-start",
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 16px",
          ...rise(reveal.heading),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h3 style={{ ...TYPE.title, margin: 0 }}>{copy.title}</h3>
          <p style={{ ...TYPE.meta, color: COLOR.muted, margin: 0 }}>
            {copy.subtitle}
          </p>
        </div>
        <ViewToggle view={copy.view} views={copy.views} />
      </div>
      {children}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "14px 16px 16px",
          ...rise(reveal.insight),
        }}
      >
        <TrendIcon
          color={COLOR.muted}
          size={14}
          style={{ flexShrink: 0, marginTop: 2 }}
        />
        <p style={{ ...TYPE.body, color: COLOR.muted, margin: 0 }}>
          {copy.insight}
        </p>
      </div>
    </section>
  );
}
