import type { UpdateChannel } from "@/lib/ipc";

import { ConchMark } from "@/components/brand/conch-mark";
import { SwapText } from "@/components/motion/swap-text";

import { SettingRow } from "./setting-row";
import { SettingsGroup } from "./settings-group";
import { UpdateCheckRow } from "./update-check-row";
import { useAboutInfo } from "./use-about-info";

const CHANNEL_SUFFIX: Record<UpdateChannel, string> = {
  beta: " · Beta",
  dev: " · Dev",
  stable: "",
};

const describeBuild = (
  version: string | null,
  channel: UpdateChannel | null
): string =>
  version ? `${version}${channel ? CHANNEL_SUFFIX[channel] : ""}` : "—";

export function AboutSection() {
  const { version, channel } = useAboutInfo();

  return (
    <SettingsGroup title="About">
      <SettingRow description="The build you are running." label="Version">
        <span className="flex items-center gap-2">
          <ConchMark className="size-5 text-brand" />
          <SwapText
            className="font-mono text-[12px] text-panel-muted"
            value={describeBuild(version, channel)}
          />
        </span>
      </SettingRow>
      <UpdateCheckRow />
    </SettingsGroup>
  );
}
