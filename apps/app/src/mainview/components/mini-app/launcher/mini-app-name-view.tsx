import { draftOfApp } from "@conch/rpc/mini-app";
import { useCallback, useState } from "react";

import type { MiniApp } from "@/lib/ipc";

import { ViewHeader } from "@/components/launcher/view-header";
import { NameField } from "@/components/widgets/name-field";
import { getErrorMessage } from "@/lib/error-message";
import { saveMiniApp } from "@/lib/ipc";

interface MiniAppNameViewProps {
  app: MiniApp;
  onBack: () => void;
  onDone: () => void;
}

// A rename changes no source or action, so bun keeps every review as it was.
export function MiniAppNameView({ app, onBack, onDone }: MiniAppNameViewProps) {
  const [error, setError] = useState<string | null>(null);
  const handleConfirm = useCallback(
    async (name: string) => {
      try {
        await saveMiniApp({ ...draftOfApp(app), name });
        onDone();
      } catch (error) {
        setError(getErrorMessage(error, "The app could not be renamed."));
      }
    },
    [app, onDone]
  );
  return (
    <div className="flex flex-col pb-3">
      <ViewHeader onBack={onBack} title="Rename App" />
      <NameField
        initial={app.name}
        label="Name"
        onCancel={onBack}
        onConfirm={handleConfirm}
      />
      {error ? (
        <p className="px-4 type-meta text-danger-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
