import type { ChangeEvent } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import type { SegmentOption } from "@/components/ui/segmented-control";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMotionPreset } from "@/lib/motion";

import type { HttpAuthKind } from "./http-form";
import type { HttpEndpointEditor } from "./use-http-endpoint-editor";

import { EditorField, FIELD_INPUT } from "./editor-field";
import { TestStatus } from "./test-status";

const AUTH_KINDS: readonly SegmentOption<HttpAuthKind>[] = [
  { label: "Header", value: "header" },
  { label: "None", value: "none" },
];

const text =
  (apply: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) =>
    apply(event.target.value);

export function HttpEndpointForm({ editor }: { editor: HttpEndpointEditor }) {
  const { form, change, phase } = editor;
  const handleAuthKind = useCallback(
    (authKind: HttpAuthKind) => change({ authKind }),
    [change]
  );
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();
  const valueHint = form.storedHint
    ? `Unchanged · ends in ${form.storedHint}`
    : "Unchanged";
  return (
    <div className="flex flex-col pt-1">
      <EditorField label="Name">
        <input
          aria-label="Name"
          autoFocus
          className={FIELD_INPUT}
          maxLength={60}
          onChange={text((name) => change({ name }))}
          placeholder="Status API"
          spellCheck={false}
          value={form.name}
        />
      </EditorField>
      <EditorField
        hint="Widgets only send GET requests under this URL."
        label="Base URL"
      >
        <input
          aria-label="Base URL"
          className={FIELD_INPUT}
          onChange={text((baseUrl) => change({ baseUrl }))}
          placeholder="https://api.example.com/v1"
          spellCheck={false}
          value={form.baseUrl}
        />
      </EditorField>
      <EditorField label="Auth">
        <SegmentedControl
          label="Auth"
          onChange={handleAuthKind}
          options={AUTH_KINDS}
          value={form.authKind}
        />
      </EditorField>
      <motion.div layout transition={{ layout: soft }}>
        <AnimatePresence initial={false}>
          {form.authKind === "header" ? (
            <motion.div
              animate={{ opacity: 1 }}
              exit={{
                opacity: 0,
                transition: reduced ? { duration: 0 } : fadeOut,
              }}
              initial={{ opacity: 0 }}
              transition={reduced ? { duration: 0 } : fadeIn}
            >
              <EditorField label="Header">
                <div className="flex gap-1.5">
                  <input
                    aria-label="Header name"
                    className={`${FIELD_INPUT} w-40 flex-none`}
                    onChange={text((headerName) =>
                      change({ headerName, stored: false })
                    )}
                    spellCheck={false}
                    value={form.headerName}
                  />
                  <input
                    aria-label="Header value"
                    autoComplete="off"
                    className={FIELD_INPUT}
                    data-1p-ignore="true"
                    onChange={text((headerValue) => change({ headerValue }))}
                    placeholder={form.stored ? valueHint : "Bearer …"}
                    type="password"
                    value={form.headerValue}
                  />
                </div>
              </EditorField>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <TestStatus phase={phase} />
    </div>
  );
}
