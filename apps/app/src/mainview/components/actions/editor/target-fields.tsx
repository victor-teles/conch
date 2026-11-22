import { HTTP_ACTION_METHODS } from "@conch/rpc";
import { useCallback } from "react";

import type { DatabaseConnection } from "@/lib/connections";
import type {
  McpToolSummary,
  RedactedHttpEndpoint,
  RedactedMcpServer,
} from "@/lib/ipc";

import { EditorField } from "@/components/sources/editor/editor-field";

import type { EditorState, HttpMethod } from "./action-draft-model";
import type { EditorUpdate } from "./use-section-setter";

import { dialectForType } from "./action-draft-model";
import { SelectField } from "./select-field";
import { TextField } from "./text-field";
import { useSectionSetter } from "./use-section-setter";

export interface TargetChoices {
  connections: readonly DatabaseConnection[];
  servers: readonly RedactedMcpServer[];
  endpoints: readonly RedactedHttpEndpoint[];
  tools: readonly McpToolSummary[];
}

interface TargetFieldsProps {
  state: EditorState;
  choices: TargetChoices;
  update: EditorUpdate;
}

const toolLabel = (tool: McpToolSummary): string =>
  `${tool.name} · ${tool.readOnlyHint === true ? "Read-only" : "Changes data"}`;

const METHODS = HTTP_ACTION_METHODS.map((method) => ({
  label: method,
  value: method,
}));

const ROW_LIMITS = [1, 5, 10, 25, 100].map((rows) => ({
  label: rows === 1 ? "1 row" : `${rows} rows`,
  value: String(rows),
}));

const isMethod = (value: string): value is HttpMethod =>
  (HTTP_ACTION_METHODS as readonly string[]).includes(value);

function SqlFields({ state, choices, update }: TargetFieldsProps) {
  const set = useSectionSetter("sql", update);
  const handleRows = useCallback(
    (rows: string) =>
      update((current) => ({
        ...current,
        sql: { ...current.sql, maxRows: Number(rows) },
      })),
    [update]
  );
  const writable = choices.connections.filter(
    (connection) => dialectForType(connection.type) !== null
  );
  return (
    <>
      <EditorField label="Connection">
        <SelectField
          label="Connection"
          onChange={set("connectionId")}
          options={writable.map((connection) => ({
            label: connection.name,
            value: connection.id,
          }))}
          value={state.sql.connectionId}
        />
      </EditorField>
      <EditorField
        hint="One INSERT, UPDATE or DELETE. Values are {{inputs}}; UPDATE and DELETE need one in WHERE."
        label="Statement"
      >
        <TextField
          label="Statement"
          onChange={set("statement")}
          placeholder="UPDATE orders SET status = {{status}} WHERE id = {{id}}"
          value={state.sql.statement}
          variant="block"
        />
      </EditorField>
      <EditorField hint="Larger writes roll back." label="At most">
        <SelectField
          label="At most"
          onChange={handleRows}
          options={ROW_LIMITS}
          value={String(state.sql.maxRows)}
        />
      </EditorField>
    </>
  );
}

function McpFields({ state, choices, update }: TargetFieldsProps) {
  const set = useSectionSetter("mcp", update);
  const handleServer = useCallback(
    (serverId: string) =>
      update((current) => ({
        ...current,
        mcp: { ...current.mcp, serverId, tool: "" },
      })),
    [update]
  );
  return (
    <>
      <EditorField label="Server">
        <SelectField
          label="Server"
          onChange={handleServer}
          options={choices.servers.map((server) => ({
            label: server.name,
            value: server.id,
          }))}
          value={state.mcp.serverId}
        />
      </EditorField>
      <EditorField label="Tool">
        <SelectField
          label="Tool"
          onChange={set("tool")}
          options={[
            { label: "Choose a tool", value: "" },
            ...choices.tools.map((tool) => ({
              label: toolLabel(tool),
              value: tool.name,
            })),
          ]}
          value={state.mcp.tool}
        />
      </EditorField>
      <EditorField
        hint='Put {"$param": "name"} where a value goes.'
        label="Arguments"
      >
        <TextField
          label="Arguments"
          onChange={set("argsText")}
          value={state.mcp.argsText}
          variant="block"
        />
      </EditorField>
    </>
  );
}

function HttpFields({ state, choices, update }: TargetFieldsProps) {
  const set = useSectionSetter("http", update);
  const handleMethod = useCallback(
    (method: string) => {
      if (isMethod(method)) {
        update((current) => ({
          ...current,
          http: { ...current.http, method },
        }));
      }
    },
    [update]
  );
  return (
    <>
      <EditorField label="Endpoint">
        <SelectField
          label="Endpoint"
          onChange={set("endpointId")}
          options={choices.endpoints.map((endpoint) => ({
            label: endpoint.name,
            value: endpoint.id,
          }))}
          value={state.http.endpointId}
        />
      </EditorField>
      <EditorField label="Request">
        <div className="flex gap-2">
          <SelectField
            className="w-28 shrink-0"
            label="Method"
            onChange={handleMethod}
            options={METHODS}
            value={state.http.method}
          />
          <TextField
            label="Path"
            onChange={set("path")}
            placeholder="/tickets/{{id}}/close"
            value={state.http.path}
          />
        </div>
      </EditorField>
      <EditorField hint="JSON, or leave empty." label="Body">
        <TextField
          label="Body"
          onChange={set("bodyText")}
          value={state.http.bodyText}
          variant="block"
        />
      </EditorField>
    </>
  );
}

function LinkFields({ state, update }: TargetFieldsProps) {
  const set = useSectionSetter("link", update);
  return (
    <>
      <EditorField hint="https only; the host is fixed." label="Address">
        <TextField
          label="Address"
          onChange={set("baseUrl")}
          placeholder="https://dashboard.example.com/orders"
          value={state.link.baseUrl}
        />
      </EditorField>
      <EditorField
        hint="A value fills a whole segment, like /{{id}}."
        label="Path"
      >
        <TextField
          label="Path"
          onChange={set("path")}
          value={state.link.path}
        />
      </EditorField>
    </>
  );
}

function CopyFields({ state, update }: TargetFieldsProps) {
  const set = useSectionSetter("copy", update);
  return (
    <EditorField hint="Text with {{values}}; nothing runs." label="Text">
      <TextField
        label="Text"
        onChange={set("template")}
        value={state.copy.template}
        variant="block"
      />
    </EditorField>
  );
}

export function TargetFields(props: TargetFieldsProps) {
  switch (props.state.kind) {
    case "sql": {
      return <SqlFields {...props} />;
    }
    case "mcp": {
      return <McpFields {...props} />;
    }
    case "http": {
      return <HttpFields {...props} />;
    }
    case "open-url": {
      return <LinkFields {...props} />;
    }
    case "copy": {
      return <CopyFields {...props} />;
    }
    default: {
      throw new Error(`Unknown target ${props.state.kind satisfies never}`);
    }
  }
}
