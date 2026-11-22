import type { Visibility } from "@/lib/ipc";

import type { PanelState } from "./mini-app-state";

const own = <T>(
  record: Readonly<Record<string, T>>,
  key: string
): T | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);

export const valueAt = (path: string, state: PanelState): unknown => {
  const [, area, name = "", field] = path.split("/");
  if (area === "inputs") {
    return own(state.inputs, name);
  }
  const run = own(state.sources, name);
  switch (field) {
    case "rows": {
      return run?.outcome?.result.rows ?? [];
    }
    case "rowCount": {
      return run?.outcome?.result.rowCount;
    }
    case "status": {
      return run?.status ?? "idle";
    }
    default: {
      return undefined;
    }
  }
};

const isPresent = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : Boolean(value);

const matches = (cond: Visibility, value: unknown): boolean => {
  if (cond.eq !== undefined) {
    return value === cond.eq;
  }
  if (cond.neq !== undefined) {
    return value !== cond.neq;
  }
  if (cond.gt !== undefined) {
    return typeof value === "number" && value > cond.gt;
  }
  return isPresent(value);
};

export const isVisible = (
  cond: Visibility | undefined,
  state: PanelState
): boolean => {
  if (!cond) {
    return true;
  }
  const shown = matches(cond, valueAt(cond.$state, state));
  return cond.not ? !shown : shown;
};
