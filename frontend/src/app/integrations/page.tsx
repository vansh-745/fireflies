import { Plug } from "lucide-react";
import type { Metadata } from "next";

import { IntegrationGrid } from "@/components/placeholders/integration-grid";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent-subtle text-accent-ink">
          <Plug className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Integrations</h1>
          <p className="text-sm text-ink-muted">Connect your meeting, calendar and CRM tools. All integrations are coming soon.</p>
        </div>
      </div>
      <IntegrationGrid />
    </div>
  );
}
