import type { ClipboardEvent, ComponentProps, ReactNode } from "react";

import { flattenPastedSql, hasLineBreak } from "./flatten-pasted-sql";
import { LauncherInputRow } from "./launcher-input-row";

// insertText keeps the paste on the browser's undo stack and fires the input's
// own change event, so the controlled value stays the single source of truth.
const pasteFlattened = (event: ClipboardEvent<HTMLInputElement>) => {
  const text = event.clipboardData.getData("text/plain");
  if (!hasLineBreak(text)) {
    return;
  }
  event.preventDefault();
  document.execCommand("insertText", false, flattenPastedSql(text));
};

export interface LauncherInputSlots {
  chip?: ReactNode;
  overlay?: ReactNode;
  trailing?: ReactNode;
}

interface LauncherInputProps {
  inputProps: ComponentProps<"input">;
  busy?: boolean;
  slots?: LauncherInputSlots;
  onSubmit: () => void;
  onStop?: () => void;
}

export function LauncherInput({
  inputProps,
  busy = false,
  slots = {},
  onSubmit,
  onStop,
}: LauncherInputProps) {
  const { chip, overlay, trailing } = slots;
  const field = (
    <input
      autoComplete="off"
      className="min-w-0 flex-1 bg-transparent type-input text-foreground outline-none placeholder:text-panel-muted placeholder:opacity-80 focus-visible:outline-none"
      onPaste={pasteFlattened}
      spellCheck={false}
      type="text"
      {...inputProps}
    />
  );
  return (
    <LauncherInputRow
      busy={busy}
      chip={chip}
      onStop={onStop}
      onSubmit={onSubmit}
      trailing={trailing}
    >
      {overlay ? (
        <div className="relative flex min-w-0 flex-1 items-center">
          {field}
          {overlay}
        </div>
      ) : (
        field
      )}
    </LauncherInputRow>
  );
}
