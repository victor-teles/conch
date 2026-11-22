import { useCallback, useEffect, useState } from "react";

import type { ActionActivityPage } from "@/lib/ipc";

import { getErrorMessage } from "@/lib/error-message";
import { listActionActivity } from "@/lib/ipc";

export type ActivityLoad =
  | { status: "loading" }
  | { status: "ready"; page: ActionActivityPage }
  | { status: "error"; message: string };

export const useActionActivity = () => {
  const [load, setLoad] = useState<ActivityLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const page = await listActionActivity();
        if (!cancelled) {
          setLoad({ page, status: "ready" });
        }
      } catch (error) {
        if (!cancelled) {
          setLoad({
            message: getErrorMessage(error, "Activity could not load."),
            status: "error",
          });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { load, retry };
};
