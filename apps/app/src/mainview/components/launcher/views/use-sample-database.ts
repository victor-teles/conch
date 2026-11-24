import { useCallback } from "react";

import { useConnections } from "@/components/launcher/connections/connections-provider";
import { useWidgets } from "@/components/widgets/widgets-provider";
import { useFlashMessage } from "@/hooks/use-flash-message";
import { addSampleConnection } from "@/lib/connections";
import { getErrorMessage } from "@/lib/error-message";

import type { RootNotice } from "./use-root-menus";

export const SAMPLE_NOTICE_MS = 4000;

export const useSampleDatabase = () => {
  const { state, activate, saved } = useConnections();
  const { refresh } = useWidgets();
  const { flash, message: notice } =
    useFlashMessage<RootNotice>(SAMPLE_NOTICE_MS);

  // Someone with a database of their own has no use for the sample.
  const offered =
    state.load.status === "ready" && state.connections.length === 0;

  const add = useCallback(async () => {
    try {
      const connection = await addSampleConnection();
      saved(connection);
      await activate(connection);
      await refresh();
      flash({ done: true, message: "Sample Store is ready" });
    } catch (error) {
      flash({
        done: false,
        message: getErrorMessage(error, "The sample database wasn't added."),
      });
    }
  }, [activate, flash, refresh, saved]);

  return { add: offered ? add : null, notice };
};
