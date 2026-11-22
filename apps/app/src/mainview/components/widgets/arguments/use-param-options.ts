import { useCallback, useState } from "react";

import type { MiniAppTarget, ParamDef } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { loadMiniAppInputOptions, loadParamOptions } from "@/lib/ipc";

type SelectParam = Extract<ParamDef, { type: "select" }>;

export type OptionsOwner =
  | { kind: "widget"; widgetId: string }
  | { kind: "mini-app"; target: MiniAppTarget; sourced: boolean };

export type ParamOptions =
  | { status: "idle" | "loading"; options: readonly string[] }
  | { status: "ready"; options: readonly string[] }
  | { status: "error"; options: readonly string[]; message: string };

const loadsOptions = (owner: OptionsOwner, param: SelectParam): boolean =>
  owner.kind === "widget" ? Boolean(param.optionsSql) : owner.sourced;

const initialOptions = (
  owner: OptionsOwner,
  param: SelectParam
): ParamOptions =>
  loadsOptions(owner, param)
    ? { options: [], status: "idle" }
    : { options: param.options ?? [], status: "ready" };

const fetchOptions = (owner: OptionsOwner, name: string): Promise<string[]> =>
  owner.kind === "widget"
    ? loadParamOptions(owner.widgetId, name)
    : loadMiniAppInputOptions(owner.target, name);

export const useParamOptions = (owner: OptionsOwner, param: SelectParam) => {
  const [state, setState] = useState<ParamOptions>(() =>
    initialOptions(owner, param)
  );

  const ensureLoaded = useCallback(async () => {
    if (state.status !== "idle") {
      return;
    }
    setState({ options: [], status: "loading" });
    try {
      const options = await fetchOptions(owner, param.name);
      setState({ options, status: "ready" });
    } catch (error) {
      setState({
        message: getErrorMessage(error, "Options could not load."),
        options: [],
        status: "error",
      });
    }
  }, [owner, param.name, state.status]);

  return { ensureLoaded, state };
};
