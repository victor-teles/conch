import { createContext } from "react";

// A flat, ranked list mixes kinds, so its rows name their kind.
export type ListLayout = "sectioned" | "flat";

export const ListLayoutContext = createContext<ListLayout>("sectioned");
