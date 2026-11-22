import type { ChangeEvent } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";

import type { SegmentOption } from "@/components/ui/segmented-control";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMotionPreset } from "@/lib/motion";

import type { McpTransport } from "./mcp-form";
import type { SecretRowState } from "./secret-form";
import type { McpServerEditor } from "./use-mcp-server-editor";

import { EditorField, FIELD_INPUT } from "./editor-field";
import { SecretRows } from "./secret-rows";
import { TestStatus } from "./test-status";
import { ToolList } from "./tool-list";

const TRANSPORTS: readonly SegmentOption<McpTransport>[] = [
  { label: "Local command", value: "stdio" },
  { label: "Remote URL", value: "http" },
];

const text =
  (apply: (value: string) => void) =>
  (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    apply(event.target.value);

function LaunchFields({ editor }: { editor: McpServerEditor }) {
  const { form, change } = editor;
  const handleSecrets = useCallback(
    (secrets: SecretRowState[]) => change({ secrets }),
    [change]
  );
  const { reduced, soft, fadeIn, fadeOut } = useMotionPreset();
  return (
    <motion.div layout transition={{ layout: soft }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: reduced ? { duration: 0 } : fadeOut }}
          initial={{ opacity: 0 }}
          key={form.transport}
          transition={reduced ? { duration: 0 } : fadeIn}
        >
          {form.transport === "stdio" ? (
            <>
              <EditorField
                hint="A full path, or a command on your PATH such as npx."
                label="Command"
              >
                <input
                  aria-label="Command"
                  className={FIELD_INPUT}
                  onChange={text((command) => change({ command }))}
                  placeholder="npx"
                  spellCheck={false}
                  value={form.command}
                />
              </EditorField>
              <EditorField hint="One per line." label="Arguments">
                <textarea
                  aria-label="Arguments"
                  className={`${FIELD_INPUT} h-16 resize-none py-1.5`}
                  onChange={text((args) => change({ args }))}
                  placeholder={"-y\n@stripe/mcp"}
                  spellCheck={false}
                  value={form.args}
                />
              </EditorField>
            </>
          ) : (
            <EditorField label="URL">
              <input
                aria-label="URL"
                className={FIELD_INPUT}
                onChange={text((url) => change({ url }))}
                placeholder="https://mcp.example.com/mcp"
                spellCheck={false}
                value={form.url}
              />
            </EditorField>
          )}
          <EditorField
            label={form.transport === "stdio" ? "Environment" : "Headers"}
          >
            <SecretRows
              label={form.transport === "stdio" ? "Variable" : "Header"}
              namePlaceholder={
                form.transport === "stdio" ? "API_KEY" : "Authorization"
              }
              onChange={handleSecrets}
              rows={form.secrets}
            />
          </EditorField>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export function McpServerForm({ editor }: { editor: McpServerEditor }) {
  const { form, change, phase, tools, toggleRead } = editor;
  const handleTransport = useCallback(
    (transport: McpTransport) => change({ secrets: [], transport }),
    [change]
  );
  return (
    <div className="flex flex-col pt-1">
      <EditorField label="Name">
        <input
          aria-label="Name"
          autoFocus
          className={FIELD_INPUT}
          maxLength={60}
          onChange={text((name) => change({ name }))}
          placeholder="Stripe"
          spellCheck={false}
          value={form.name}
        />
      </EditorField>
      <EditorField label="Runs as">
        <SegmentedControl
          label="Transport"
          onChange={handleTransport}
          options={TRANSPORTS}
          value={form.transport}
        />
      </EditorField>
      <LaunchFields editor={editor} />
      <TestStatus phase={phase} />
      <h2 className="px-4 pt-2 pb-1 type-micro text-panel-muted">Tools</h2>
      <ToolList onToggle={toggleRead} state={tools} />
    </div>
  );
}
