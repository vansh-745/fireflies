"use client";

import { Bell, CreditCard, Monitor, Moon, Palette, Plug, Sun, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, ComingSoon, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Switch } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { PLAYBACK_RATES } from "@/lib/player";
import { usePreferences } from "@/lib/preferences";
import { useMe, useUpdateMe } from "@/lib/queries";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import type { User } from "@/lib/types";

type Tab = "profile" | "preferences" | "notifications" | "team" | "billing";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <UserRound /> },
  { id: "preferences", label: "Preferences", icon: <Palette /> },
  { id: "notifications", label: "Notifications", icon: <Bell /> },
  { id: "team", label: "Team", icon: <Users /> },
  { id: "billing", label: "Plans & billing", icon: <CreditCard /> },
];

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        {description && <div className="mt-0.5 text-xs text-ink-muted">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function ProfileForm({ me }: { me: User }) {
  const update = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [jobTitle, setJobTitle] = useState(me.job_title ?? "");
  const dirty = name !== me.name || email !== me.email || jobTitle !== (me.job_title ?? "");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(
          { name: name.trim(), email: email.trim(), job_title: jobTitle.trim() || null },
          { onSuccess: () => toast.success("Profile saved") },
        );
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar name={name || me.name} slot={1} size="lg" />
        <div>
          <div className="font-medium text-ink">{me.name}</div>
          <div className="text-xs text-ink-muted">Default workspace account · sign-in is coming soon</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">{(id) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} required />}</Field>
        <Field label="Job title">{(id) => <Input id={id} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />}</Field>
        <Field label="Email" className="sm:col-span-2">
          {(id) => <Input id={id} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />}
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!dirty || !name.trim()} loading={update.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "profile") as Tab;
  const { data: me } = useMe();
  const [prefs, setPrefs] = usePreferences();
  const { theme, setTheme } = useTheme();

  const setTab = (next: Tab) => router.replace(next === "profile" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap [&>svg]:size-4",
                tab === item.id ? "bg-accent-subtle text-accent-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <Link href="/integrations" className="flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-ink-muted hover:bg-surface-sunken hover:text-ink">
            <Plug className="size-4" /> Integrations
          </Link>
        </nav>

        <Card className="min-w-0 flex-1 p-6">
          {tab === "profile" &&
            (me ? <ProfileForm key={me.id + me.name + me.email} me={me} /> : <Skeleton className="h-48 w-full" />)}

          {tab === "preferences" && (
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Preferences</h2>
              <Row title="Theme" description="Dark mode follows the Fireflies-style palette.">
                <div className="inline-flex rounded-lg bg-surface-sunken p-1">
                  {(
                    [
                      ["light", "Light", <Sun key="s" className="size-3.5" />],
                      ["dark", "Dark", <Moon key="m" className="size-3.5" />],
                      ["system", "System", <Monitor key="c" className="size-3.5" />],
                    ] as [ThemeChoice, string, ReactNode][]
                  ).map(([value, label, icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={theme === value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        "pressable flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium",
                        theme === value ? "bg-surface text-ink shadow-elev-1" : "text-ink-muted hover:text-ink",
                      )}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row title="Default playback speed" description="Used when you open a meeting.">
                <select
                  value={prefs.playbackRate}
                  onChange={(event) => setPrefs({ playbackRate: Number(event.target.value) })}
                  className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
                  aria-label="Default playback speed"
                >
                  {PLAYBACK_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate}x
                    </option>
                  ))}
                </select>
              </Row>
              <Row title="Auto-scroll transcript" description="Keep the spoken line in view during playback.">
                <Switch checked={prefs.autoScroll} onChange={(value) => setPrefs({ autoScroll: value })} label="Auto-scroll transcript" />
              </Row>
            </div>
          )}

          {tab === "notifications" && (
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Notifications</h2>
              <p className="mt-1 text-xs text-ink-muted">Saved in this browser. Email delivery is coming soon.</p>
              <Row title="Meeting notes are ready" description="In-app notification when a transcript finishes processing.">
                <Switch checked={prefs.notifyOnReady} onChange={(value) => setPrefs({ notifyOnReady: value })} label="Meeting notes are ready" />
              </Row>
              <Row title="Weekly email digest" description="A summary of your meetings and open action items.">
                <Switch checked={prefs.emailDigest} onChange={(value) => setPrefs({ emailDigest: value })} label="Weekly email digest" />
              </Row>
            </div>
          )}

          {tab === "team" && (
            <ComingSoon
              icon={<Users />}
              title="Teams & sharing"
              description="Invite teammates, share meetings and manage permissions."
              bullets={["Shared team notebook", "Per-meeting privacy controls", "Admin roles", "Guest access links"]}
            />
          )}

          {tab === "billing" && (
            <ComingSoon
              icon={<CreditCard />}
              title="Plans & billing"
              description="This demo workspace is free with unlimited transcripts."
              bullets={["Pro and Business plans", "Seat management", "Invoices", "Storage add-ons"]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
