import { homedir } from "node:os";
import path from "node:path";

const APP_DIR = ".config/conch";

export function appDir(): string {
  return path.join(homedir(), APP_DIR);
}

export function configPath(): string {
  return path.join(appDir(), "conch.json");
}

export function connectionsPath(): string {
  return path.join(appDir(), "connections.json");
}

export function keyPath(): string {
  return path.join(appDir(), ".key");
}

export function tabsPath(connectionId: string): string {
  return path.join(appDir(), "tabs", `${connectionId}.json`);
}

export function historyDir(): string {
  return path.join(appDir(), "history");
}

export function historyPath(connectionId: string): string {
  return path.join(historyDir(), `${connectionId}.jsonl`);
}

export function sampleDatabasePath(): string {
  return path.join(appDir(), "sample", "store.sqlite");
}

export function aiConfigPath(): string {
  return path.join(appDir(), "ai.enc");
}

export function widgetsPath(): string {
  return path.join(appDir(), "widgets.enc");
}

export function recentAsksPath(): string {
  return path.join(appDir(), "recent-asks.enc");
}

export function boardsPath(): string {
  return path.join(appDir(), "boards.enc");
}

export function boardFramesPath(): string {
  return path.join(appDir(), "board-frames.json");
}

export function watchesPath(): string {
  return path.join(appDir(), "watches.enc");
}

export function runLogPath(): string {
  return path.join(appDir(), "widget-runs.enc");
}

export function mcpSettingsPath(): string {
  return path.join(appDir(), "mcp.enc");
}

export function mcpAuditPath(): string {
  return path.join(appDir(), "mcp-audit.enc");
}

export function mcpRunDir(): string {
  return path.join(appDir(), "run");
}

export function mcpServersPath(): string {
  return path.join(appDir(), "mcp-servers.enc");
}

export function httpEndpointsPath(): string {
  return path.join(appDir(), "http-endpoints.enc");
}

export function actionsPath(): string {
  return path.join(appDir(), "actions.enc");
}

export function writePermissionsPath(): string {
  return path.join(appDir(), "write-permissions.enc");
}

export function actionsAuditPath(): string {
  return path.join(appDir(), "actions-audit.enc");
}

export function miniAppsPath(): string {
  return path.join(appDir(), "mini-apps.enc");
}

export function themesPath(): string {
  return path.join(appDir(), "themes.enc");
}
