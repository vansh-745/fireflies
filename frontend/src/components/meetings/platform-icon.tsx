import { FileUp, MonitorPlay, Users, Video } from "lucide-react";

import { speakerStyle } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { PLATFORM_LABELS } from "@/lib/format";
import type { Platform } from "@/lib/types";

const PLATFORMS: Record<Platform, { slot: number; Icon: typeof Video }> = {
  zoom: { slot: 5, Icon: Video },
  google_meet: { slot: 3, Icon: MonitorPlay },
  teams: { slot: 6, Icon: Users },
  upload: { slot: 1, Icon: FileUp },
};

export function PlatformIcon({ platform, size = "md" }: { platform: Platform; size?: "sm" | "md" }) {
  const { slot, Icon } = PLATFORMS[platform];
  return (
    <span
      title={PLATFORM_LABELS[platform]}
      style={speakerStyle(slot)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-(--chip-bg) text-(--chip-ink)",
        size === "sm" ? "size-7 [&>svg]:size-3.5" : "size-10 [&>svg]:size-[18px]",
      )}
    >
      <Icon aria-hidden />
    </span>
  );
}
