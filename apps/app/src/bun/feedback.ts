export const ISSUES_URL = "https://github.com/victor-teles/conch/issues/new";

export interface BuildInfo {
  version: string;
  channel: string;
  system: string;
  arch: string;
}

// Only the build and the machine are filled in: never a query, a row or a
// connection, so the issue is safe to post in public as it opens.
export const feedbackUrl = ({
  version,
  channel,
  system,
  arch,
}: BuildInfo): string => {
  const body = [
    "**What happened?**",
    "",
    "",
    "**What did you expect?**",
    "",
    "",
    "---",
    `Conch ${version} (${channel}) · ${system} · ${arch}`,
  ].join("\n");
  return `${ISSUES_URL}?${new URLSearchParams({ body })}`;
};
