export type FocusRelease =
  | { kind: "keep" }
  | { kind: "activate"; windowKey: string }
  | { kind: "deactivate" }
  | { kind: "hide" };

export interface FocusState {
  focusedWindowKey: string | null;
  returnWindowKey: string | null;
  openWindowKeys: readonly string[];
}

// Deactivating instead of hiding keeps open windows visible when focus goes back.
export const focusAfterLauncherHides = ({
  focusedWindowKey,
  returnWindowKey,
  openWindowKeys,
}: FocusState): FocusRelease => {
  if (focusedWindowKey) {
    return { kind: "keep" };
  }
  if (returnWindowKey && openWindowKeys.includes(returnWindowKey)) {
    return { kind: "activate", windowKey: returnWindowKey };
  }
  return openWindowKeys.length > 0 ? { kind: "deactivate" } : { kind: "hide" };
};
