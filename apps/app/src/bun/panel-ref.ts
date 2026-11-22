export interface PanelRef {
  kind: "board" | "app";
  id: string;
}

// Boards keep their bare id so frames saved before apps existed still
// restore; every other kind, and a board id that looks prefixed, is
// prefixed so a board can never share a key with an app window.
export const windowKey = (ref: PanelRef): string =>
  ref.kind === "board" && !ref.id.includes(":")
    ? ref.id
    : `${ref.kind}:${ref.id}`;

export const panelUrl = (baseUrl: string, ref: PanelRef): string =>
  `${baseUrl.split("#")[0]}#/${ref.kind}/${encodeURIComponent(ref.id)}`;
