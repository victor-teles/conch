import { OffthreadVideo, staticFile } from "remotion";

import { PANEL_CROP, SCREEN } from "@/data/footage";

const FEATHER = 18;

const edgeMask = (direction: "to right" | "to bottom") =>
  `linear-gradient(${direction}, transparent 0, #000 ${FEATHER}px, #000 calc(100% - ${FEATHER}px), transparent 100%)`;

interface PanelFootageProps {
  take: string;
  trimBefore: number;
  scale: number;
}

export function PanelFootage({ take, trimBefore, scale }: PanelFootageProps) {
  const mask = `${edgeMask("to right")}, ${edgeMask("to bottom")}`;
  return (
    <div
      style={{
        WebkitMaskComposite: "source-in",
        WebkitMaskImage: mask,
        height: PANEL_CROP.height * scale,
        maskComposite: "intersect",
        maskImage: mask,
        overflow: "hidden",
        position: "relative",
        width: PANEL_CROP.width * scale,
      }}
    >
      <OffthreadVideo
        muted
        src={staticFile(take)}
        style={{
          height: SCREEN.height * scale,
          left: -PANEL_CROP.x * scale,
          maxWidth: "none",
          position: "absolute",
          top: -PANEL_CROP.y * scale,
          width: SCREEN.width * scale,
        }}
        trimBefore={trimBefore}
      />
    </div>
  );
}
