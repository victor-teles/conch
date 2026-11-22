type Listener = (widgetId: string) => void;

const listeners = new Set<Listener>();

// A widget run can stay mounted under the stack while its actions are
// edited, so saves and deletes announce themselves instead of relying on a
// remount to refetch.
export const onActionsChanged = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const announceActionsChanged = (widgetId: string): void => {
  for (const listener of listeners) {
    listener(widgetId);
  }
};
