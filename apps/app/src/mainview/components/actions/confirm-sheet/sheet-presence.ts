import { useIsPresent } from "motion/react";
import { useEffect } from "react";

const open = { count: 0 };

// Navigation from another window never replaces a view while a person is
// reading a confirm sheet; the launcher asks this before it moves. A sheet
// stops counting as soon as it starts to leave.
export const isConfirmSheetOpen = (): boolean => open.count > 0;

export const useSheetPresence = (): void => {
  const present = useIsPresent();
  useEffect(() => {
    if (!present) {
      return;
    }
    open.count += 1;
    return () => {
      open.count -= 1;
    };
  }, [present]);
};
