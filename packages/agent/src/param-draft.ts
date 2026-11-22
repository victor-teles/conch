import { ParamDef, RangePreset } from "@conch/rpc";
import { z } from "zod";

export const PARAM_TYPES = [
  "date",
  "dateRange",
  "number",
  "text",
  "select",
] as const;

export const ParamDraftInput = z.object({
  defaultValue: z.string(),
  label: z.string(),
  max: z.number().nullable(),
  min: z.number().nullable(),
  name: z.string(),
  options: z.array(z.string()).nullable(),
  optionsSql: z.string().nullable(),
  type: z.enum(PARAM_TYPES),
});
export type ParamDraftInput = z.infer<typeof ParamDraftInput>;

export class ProposalRejected extends Error {}

export const reject = (message: string): never => {
  throw new ProposalRejected(message);
};

const RANGE_SEPARATOR = "..";

const rangeDefault = (value: string): ParamDef["default"] => {
  const preset = RangePreset.safeParse(value);
  if (preset.success) {
    return preset.data;
  }
  const [from = "", to = ""] = value.split(RANGE_SEPARATOR);
  return { from: from.trim(), to: to.trim() };
};

const candidateFor = (input: ParamDraftInput): unknown => {
  const base = { label: input.label, name: input.name };
  switch (input.type) {
    case "date": {
      return { ...base, default: input.defaultValue, type: "date" };
    }
    case "dateRange": {
      return {
        ...base,
        default: rangeDefault(input.defaultValue),
        type: "dateRange",
      };
    }
    case "number": {
      return {
        ...base,
        default: Number(input.defaultValue),
        type: "number",
        ...(input.min === null ? {} : { min: input.min }),
        ...(input.max === null ? {} : { max: input.max }),
      };
    }
    case "select": {
      if (!(input.options?.length || input.optionsSql)) {
        return { ...base, default: input.defaultValue, type: "text" };
      }
      return {
        ...base,
        default: input.defaultValue,
        type: "select",
        ...(input.options ? { options: input.options } : {}),
        ...(input.optionsSql ? { optionsSql: input.optionsSql } : {}),
      };
    }
    default: {
      return { ...base, default: input.defaultValue, type: "text" };
    }
  }
};

export const toParamDef = (input: ParamDraftInput): ParamDef => {
  const parsed = ParamDef.safeParse(candidateFor(input));
  if (!parsed.success) {
    return reject(
      `The proposed input "${input.name}" isn't valid: ${parsed.error.issues[0]?.message ?? "unknown problem"}.`
    );
  }
  return parsed.data;
};
