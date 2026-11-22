import {
  cardElements,
  removeAction,
  removeElement,
  removeSource,
} from "@conch/rpc/mini-app";
import { XIcon } from "lucide-react";
import { useCallback, useState } from "react";

import type { MiniApp, MiniAppDraft } from "@/lib/ipc";

import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

type Update = (change: (draft: MiniAppDraft) => MiniAppDraft) => void;

interface EditChip {
  id: string;
  label: string;
  title: string;
  apply: (draft: MiniAppDraft) => MiniAppDraft;
}

const chipsOf = (app: MiniApp): { group: string; chips: EditChip[] }[] => [
  {
    chips: cardElements(app.layout).map(([key, card]) => ({
      apply: (draft) => ({
        ...draft,
        layout: removeElement(draft.layout, key),
      }),
      id: `card:${key}`,
      label: card.props.spec.title,
      title: "Remove this card",
    })),
    group: "Cards",
  },
  {
    chips: app.inputs
      .filter((input) => !input.fixed)
      .map((input) => ({
        apply: (draft) => ({
          ...draft,
          inputs: draft.inputs.map((item) =>
            item.name === input.name ? { ...item, fixed: true } : item
          ),
        }),
        id: `input:${input.name}`,
        label: input.label,
        title: "Remove the input; it keeps its default",
      })),
    group: "Inputs",
  },
  {
    chips: app.actions.map((action) => ({
      apply: (draft) => removeAction(draft, action.id),
      id: `action:${action.id}`,
      label: action.label,
      title: "Remove this action",
    })),
    group: "Actions",
  },
  {
    chips: Object.keys(app.sources).map((name) => ({
      apply: (draft) => removeSource(draft, name),
      id: `source:${name}`,
      label: name,
      title: "Remove the source and the cards that show it",
    })),
    group: "Sources",
  },
];

interface EditChipButtonProps {
  chip: EditChip;
  armed: boolean;
  onArm: (id: string | null) => void;
  onRemove: Update;
}

function EditChipButton({ chip, armed, onArm, onRemove }: EditChipButtonProps) {
  const handleClick = useCallback(() => {
    if (!armed) {
      onArm(chip.id);
      return;
    }
    onArm(null);
    onRemove(chip.apply);
  }, [armed, chip, onArm, onRemove]);
  const handleBlur = useCallback(() => {
    if (armed) {
      onArm(null);
    }
  }, [armed, onArm]);
  return (
    <button
      aria-label={
        armed ? `Confirm remove ${chip.label}` : `Remove ${chip.label}`
      }
      className={cn(
        "flex h-6 items-center gap-1 rounded-[6px] px-2 type-micro",
        armed
          ? "bg-destructive/15 text-danger-ink"
          : "bg-row-hover text-foreground hover:bg-row-active"
      )}
      onBlur={handleBlur}
      onClick={handleClick}
      title={chip.title}
      type="button"
    >
      {chip.label}
      <XIcon aria-hidden className="size-3" />
    </button>
  );
}

// Removing is two presses: the first arms the chip, the second removes.
export function MiniAppEditBar({
  app,
  update,
}: {
  app: MiniApp;
  update: Update;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const groups = chipsOf(app).filter((group) => group.chips.length > 0);
  return (
    <Reveal className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-panel-border px-6 py-2">
      {groups.map((group) => (
        <div className="flex flex-wrap items-center gap-1.5" key={group.group}>
          <span className="type-micro text-panel-muted">{group.group}</span>
          {group.chips.map((chip) => (
            <EditChipButton
              armed={armed === chip.id}
              chip={chip}
              key={chip.id}
              onArm={setArmed}
              onRemove={update}
            />
          ))}
        </div>
      ))}
    </Reveal>
  );
}
