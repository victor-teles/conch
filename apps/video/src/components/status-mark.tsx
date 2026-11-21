import { CheckIcon, CircleAlertIcon, LoaderCircleIcon } from "lucide-react";
import { useCurrentFrame } from "remotion";

import { COLOR } from "@/theme";

export type AskState = "busy" | "done" | "refused";

const DEGREES_PER_FRAME = 12;

function Mark({ state }: { state: AskState }) {
  const frame = useCurrentFrame();
  switch (state) {
    case "done": {
      return <CheckIcon color={COLOR.success} size={14} strokeWidth={2.4} />;
    }
    case "refused": {
      return <CircleAlertIcon color={COLOR.danger} size={14} />;
    }
    default: {
      return (
        <LoaderCircleIcon
          color={COLOR.muted}
          size={14}
          style={{ transform: `rotate(${frame * DEGREES_PER_FRAME}deg)` }}
        />
      );
    }
  }
}

export function StatusMark({ state }: { state: AskState }) {
  return (
    <span
      style={{
        display: "grid",
        height: 20,
        placeItems: "center",
        width: 20,
      }}
    >
      <Mark state={state} />
    </span>
  );
}
