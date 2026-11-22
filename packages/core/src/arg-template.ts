import type { RangePart, TemplateValue } from "./sql-template.ts";
import type { BindValue } from "./types.ts";

import { DbError } from "./error.ts";

export interface ParamRefShape {
  $param: string;
  part?: RangePart;
}

export type ArgTemplateValue =
  | string
  | number
  | boolean
  | null
  | ParamRefShape
  | readonly ArgTemplateValue[]
  | { readonly [key: string]: ArgTemplateValue };

export type BoundValues = Readonly<Record<string, TemplateValue>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isParamRef = (value: unknown): value is ParamRefShape => {
  if (!isRecord(value) || typeof value.$param !== "string") {
    return false;
  }
  const keys = Object.keys(value);
  const { part } = value;
  return (
    keys.every((key) => key === "$param" || key === "part") &&
    (part === undefined || part === "from" || part === "to")
  );
};

export const collectParamRefs = (template: unknown): ParamRefShape[] => {
  if (isParamRef(template)) {
    return [template];
  }
  if (Array.isArray(template)) {
    return template.flatMap(collectParamRefs);
  }
  if (isRecord(template)) {
    return Object.values(template).flatMap(collectParamRefs);
  }
  return [];
};

const invalid = (message: string): DbError =>
  new DbError("INVALID_TEMPLATE", message);

const lookup = (ref: ParamRefShape, values: BoundValues): TemplateValue => {
  const value = Object.hasOwn(values, ref.$param)
    ? values[ref.$param]
    : undefined;
  if (!value) {
    throw invalid(
      `The call uses an input named "${ref.$param}" that doesn't exist.`
    );
  }
  if (ref.part && value.kind !== "dateRange") {
    throw invalid(
      `"${ref.$param}" isn't a date range, so it has no ${ref.part}.`
    );
  }
  return value;
};

export const bindParamRef = (
  ref: ParamRefShape,
  values: BoundValues
): BindValue | { from: string; to: string } => {
  const value = lookup(ref, values);
  switch (value.kind) {
    case "dateRange": {
      return ref.part ? value[ref.part] : { from: value.from, to: value.to };
    }
    case "date":
    case "text":
    case "number":
    case "value": {
      return value.value;
    }
    default: {
      throw invalid(`Unknown input kind ${value satisfies never}`);
    }
  }
};

export const paramText = (ref: ParamRefShape, values: BoundValues): string => {
  const bound = bindParamRef(ref, values);
  if (typeof bound === "object") {
    throw invalid(`Use "${ref.$param}" with part "from" or "to" here.`);
  }
  return String(bound);
};

export const bindArgs = (template: unknown, values: BoundValues): unknown => {
  if (isParamRef(template)) {
    return bindParamRef(template, values);
  }
  if (Array.isArray(template)) {
    return template.map((item) => bindArgs(item, values));
  }
  if (isRecord(template)) {
    return Object.fromEntries(
      Object.entries(template).map(([key, item]) => [
        key,
        bindArgs(item, values),
      ])
    );
  }
  return template;
};
