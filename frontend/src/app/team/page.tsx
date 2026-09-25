import { Users } from "lucide-react";
import type { Metadata } from "next";

import { ComingSoon } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <ComingSoon
      icon={<Users />}
      title="Team workspace"
      description="Invite teammates, share meetings and collaborate on notes. This demo runs as a single default user."
      bullets={["Invite by email", "Shared channels of meetings", "Roles and permissions", "Team-wide search"]}
    />
  );
}
