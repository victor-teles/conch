import type { RedactedSecret } from "@/lib/ipc";

export interface SecretRowState {
  key: string;
  name: string;
  value: string;
  hint: string | null;
  stored: boolean;
}

const freshKey = (): string => crypto.randomUUID();

export const secretRowsOf = (
  secrets: readonly RedactedSecret[]
): SecretRowState[] =>
  secrets.map((secret) => ({
    hint: secret.hint,
    key: freshKey(),
    name: secret.name,
    stored: secret.hasValue,
    value: "",
  }));

export const emptySecretRow = (): SecretRowState => ({
  hint: null,
  key: freshKey(),
  name: "",
  stored: false,
  value: "",
});

// An untouched stored value is sent as undefined so bun keeps it.
export const secretInputs = (rows: readonly SecretRowState[]) =>
  rows
    .filter((row) => row.name.trim() !== "")
    .map((row) => ({
      name: row.name.trim(),
      value: row.stored && row.value === "" ? undefined : row.value,
    }));

export const storedPlaceholder = (row: SecretRowState): string => {
  if (!row.stored) {
    return "Value";
  }
  return row.hint ? `Unchanged · ends in ${row.hint}` : "Unchanged";
};
