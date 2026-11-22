import type { ChangeEvent } from "react";

import { useCallback } from "react";

type TextKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

type TextEvent = ChangeEvent<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
>;

// One change handler factory per form, so each field binds by key.
export const useFieldSetter = <T extends object>(
  fields: T,
  onChange: (next: T) => void
) =>
  useCallback(
    (key: TextKeys<T>) => (event: TextEvent) =>
      onChange({ ...fields, [key]: event.target.value }),
    [fields, onChange]
  );
