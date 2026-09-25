import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ComingSoon
      icon={<ChartColumn />}
      title="Conversation intelligence"
      description="Workspace-wide analytics on talk time, sentiment, topics and meeting habits. Per-meeting speaker analytics are already available on every meeting page."
      bullets={["Talk-to-listen ratio trends", "Sentiment over time", "Topic and keyword trends", "Meeting load per person"]}
    />
  );
}
