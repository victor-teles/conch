import { COLOR, FONT, TYPE } from "@/theme";

interface KeyComboProps {
  keys: readonly string[];
}

export function KeyCombo({ keys }: KeyComboProps) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {keys.map((key) => (
        <kbd
          key={key}
          style={{
            ...TYPE.micro,
            alignItems: "center",
            background: COLOR.kbd,
            borderRadius: 5,
            color: COLOR.muted,
            display: "inline-flex",
            fontFamily: FONT.sans,
            height: 20,
            justifyContent: "center",
            minWidth: 20,
            padding: "0 4px",
          }}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
