import { useCallback, useState } from "react";

import type { RedactedHttpEndpoint } from "@/lib/ipc";

import { useSources } from "@/components/sources/sources-provider";
import { getErrorMessage } from "@/lib/error-message";
import {
  deleteHttpEndpoint,
  saveHttpEndpoint,
  testHttpEndpoint,
} from "@/lib/ipc";

import type { EditorPhase } from "./editor-phase";
import type { HttpFormState } from "./http-form";

import { IDLE, isBusy } from "./editor-phase";
import { httpFormOf, httpFormProblem, httpInputOf } from "./http-form";

export const useHttpEndpointEditor = (endpointId: string | null) => {
  const { state, putEndpoint, dropEndpoint } = useSources();
  const existing =
    state.status === "ready"
      ? (state.endpoints.find((endpoint) => endpoint.id === endpointId) ?? null)
      : null;
  const [form, setForm] = useState<HttpFormState>(() => httpFormOf(existing));
  const [savedId, setSavedId] = useState(endpointId);
  const [dirty, setDirty] = useState(endpointId === null);
  const [phase, setPhase] = useState<EditorPhase>(IDLE);

  const change = useCallback((patch: Partial<HttpFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
  }, []);

  const save = useCallback(async (): Promise<RedactedHttpEndpoint | null> => {
    const problem = httpFormProblem(form);
    if (problem) {
      setPhase({ kind: "failed", message: problem });
      return null;
    }
    setPhase({ kind: "saving" });
    try {
      const saved = await saveHttpEndpoint(httpInputOf(form, savedId));
      putEndpoint(saved);
      setSavedId(saved.id);
      setDirty(false);
      setForm(httpFormOf(saved));
      setPhase({ kind: "saved" });
      return saved;
    } catch (error) {
      setPhase({
        kind: "failed",
        message: getErrorMessage(error, "The endpoint could not be saved."),
      });
      return null;
    }
  }, [form, putEndpoint, savedId]);

  const test = useCallback(async () => {
    if (isBusy(phase)) {
      return;
    }
    const endpoint = dirty || !savedId ? await save() : existing;
    if (!endpoint) {
      return;
    }
    setPhase({ kind: "testing" });
    try {
      const result = await testHttpEndpoint(endpoint.id);
      setPhase({ kind: "tested", result });
      putEndpoint({ ...endpoint, lastTest: result });
    } catch (error) {
      setPhase({
        kind: "failed",
        message: getErrorMessage(error, "The test could not run."),
      });
    }
  }, [dirty, existing, phase, putEndpoint, save, savedId]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!savedId) {
      return true;
    }
    try {
      await deleteHttpEndpoint(savedId);
      dropEndpoint(savedId);
      return true;
    } catch (error) {
      setPhase({
        kind: "failed",
        message: getErrorMessage(error, "The endpoint could not be removed."),
      });
      return false;
    }
  }, [dropEndpoint, savedId]);

  return { change, form, phase, remove, save, savedId, test };
};

export type HttpEndpointEditor = ReturnType<typeof useHttpEndpointEditor>;
