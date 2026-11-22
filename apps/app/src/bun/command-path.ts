import path from "node:path";

// Apps launched from Finder get a minimal PATH, so the usual install
// locations come first when resolving and running a configured command.
export const COMMON_BIN_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
] as const;

export const searchPath = (userPath: string | undefined): string =>
  [...new Set([...COMMON_BIN_DIRS, ...(userPath ?? "").split(":")])]
    .filter((dir) => dir.length > 0)
    .join(":");

export type WhichCommand = (
  command: string,
  options: { PATH: string }
) => string | null;

export const resolveCommand = (
  command: string,
  userPath: string | undefined,
  which: WhichCommand = Bun.which
): string | null => {
  const trimmed = command.trim();
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes("/")) {
    return null;
  }
  return which(trimmed, { PATH: searchPath(userPath) });
};
