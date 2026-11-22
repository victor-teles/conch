import { deriveEffect, writeTargetOf } from "@conch/rpc";
import { actionTemplateText, bindSourceLines } from "@conch/rpc/mini-app";

import type {
  ActionEffect,
  ActionTarget,
  AppActionDraft,
  MiniAppDraft,
  Source,
} from "@/lib/ipc";

export interface ReviewEdits {
  name: string;
  removedInputs: ReadonlySet<string>;
}

// A removed input stays bound at its default, never spliced into a source.
export const reviewedDraft = (
  draft: MiniAppDraft,
  { name, removedInputs }: ReviewEdits
): MiniAppDraft => ({
  ...draft,
  inputs: draft.inputs.map((input) =>
    removedInputs.has(input.name) ? { ...input, fixed: true } : input
  ),
  name: name.trim() || draft.name,
});

// Only bun knows a tool's live readOnlyHint, so an MCP action shows as a
// write here until bun says otherwise at save.
export const draftEffect = (action: AppActionDraft): ActionEffect =>
  deriveEffect(action.target, null);

export const writeKeyOf = (target: ActionTarget): string | null => {
  const ref = writeTargetOf(target);
  return ref ? `${ref.kind}:${ref.id}` : null;
};

export const writesAllowed = (
  action: AppActionDraft,
  permissions: ReadonlySet<string>
): boolean => {
  const key = writeKeyOf(action.target);
  return key !== null && permissions.has(key);
};

export const targetText = actionTemplateText;

export const sourceText = (source: Source): string => {
  switch (source.kind) {
    case "sql": {
      return source.sqlTemplate;
    }
    case "mcp": {
      return `${source.tool} ${JSON.stringify(source.args)}`;
    }
    case "http": {
      return `GET ${source.path}`;
    }
    default: {
      throw new Error(`Unknown source ${source satisfies never}`);
    }
  }
};

export const SOURCE_KIND_LABELS: Record<Source["kind"], string> = {
  http: "HTTP",
  mcp: "MCP",
  sql: "SQL",
};

export const bindLines = (action: AppActionDraft): string[] =>
  bindSourceLines(action.bind);
