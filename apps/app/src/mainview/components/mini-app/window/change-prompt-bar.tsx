import { PromptField } from "@/components/mini-app/prompt-field";
import { Reveal } from "@/components/motion/reveal";

interface ChangePromptBarProps {
  name: string;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

export function ChangePromptBar({
  name,
  onSubmit,
  onCancel,
}: ChangePromptBarProps) {
  return (
    <Reveal className="border-b border-panel-border px-6 py-2">
      <PromptField
        label={`Change ${name}`}
        onCancel={onCancel}
        onSubmit={onSubmit}
        placeholder={`Change ${name}: add a card, an input or an action…`}
      />
    </Reveal>
  );
}
