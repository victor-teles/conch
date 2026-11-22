import type { Theme } from "@conch/rpc";

export type ThemeEditSource =
  | { kind: "new"; from: Theme }
  | { kind: "existing"; theme: Theme };
