import { editableParams, ParamValue, sharedKey } from "@conch/rpc";
import { sourcesUsing } from "@conch/rpc/mini-app";

import type { ArgumentInput } from "@/components/widgets/arguments/argument-pills";
import type { MiniAppTarget, ParamDef, ParamValues, Source } from "@/lib/ipc";

import { changedKeys } from "@/components/board/board-inputs";

interface InputsApp {
  inputs: readonly ParamDef[];
  inputOptions: Readonly<Record<string, string>>;
  sources: Readonly<Record<string, Source>>;
  values: Readonly<Record<string, unknown>>;
}

export const appInputs = (
  app: InputsApp,
  target: MiniAppTarget
): ArgumentInput[] =>
  editableParams(app.inputs).map((param) => ({
    key: param.name,
    owner: {
      kind: "mini-app",
      sourced: Object.hasOwn(app.inputOptions, param.name),
      target,
    },
    param,
  }));

// The values a run starts from: what the person last chose, else defaults.
export const initialInputs = (app: InputsApp): ParamValues =>
  Object.fromEntries(
    app.inputs.map((input) => {
      const key = sharedKey(input);
      const stored = ParamValue.safeParse(
        Object.hasOwn(app.values, key) ? app.values[key] : undefined
      );
      return [input.name, stored.success ? stored.data : input.default];
    })
  );

export const storedValuesOf = (
  inputs: readonly ParamDef[],
  values: ParamValues
): ParamValues =>
  Object.fromEntries(
    inputs.flatMap((input) => {
      const value = values[input.name];
      return value === undefined ? [] : [[sharedKey(input), value]];
    })
  );

export const affectedSources = (
  app: Pick<InputsApp, "sources">,
  before: ParamValues,
  after: ParamValues
): string[] => [
  ...new Set(
    changedKeys(before, after).flatMap((name) => sourcesUsing(app, name))
  ),
];
