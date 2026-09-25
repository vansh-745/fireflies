import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <EmptyState
      className="py-24"
      icon={<SearchX />}
      title="Page not found"
      description="The page you're looking for doesn't exist or was deleted."
      action={
        <Link href="/meetings" className="pressable inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover">
          Go to meetings
        </Link>
      }
    />
  );
}
