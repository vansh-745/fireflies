"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useMarkNotificationsRead, useMe, useNotifications } from "@/lib/queries";
import { useTheme } from "@/lib/theme";

export function NotificationsMenu() {
  const router = useRouter();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <Popover
      align="end"
      className="w-80"
      trigger={
        <button
          type="button"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="pressable relative inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-on-danger ring-2 ring-surface">
              {unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-display text-sm font-semibold text-ink">Notifications</span>
        <button
          type="button"
          disabled={!unread}
          onClick={() => markRead.mutate()}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline disabled:text-ink-subtle disabled:no-underline"
        >
          <CheckCheck className="size-3.5" /> Mark all read
        </button>
      </div>
      {notifications.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">You&apos;re all caught up.</p>
      ) : (
        <ul className="max-h-96 overflow-y-auto py-1">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => n.meeting_id && router.push(`/meetings/${n.meeting_id}`)}
                className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-surface-sunken"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-accent")} />
                <span className="min-w-0">
                  <span className="block text-sm text-ink">{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-ink-muted">{n.body}</span>}
                  <span className="mt-0.5 block text-xxs text-ink-subtle">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

export function ProfileMenu() {
  const router = useRouter();
  const { data: me } = useMe();
  const { theme, setTheme } = useTheme();
  const name = me?.name ?? "…";

  return (
    <Menu
      trigger={
        <button type="button" aria-label="Account menu" className="pressable rounded-full">
          <Avatar name={name} slot={1} size="md" />
        </button>
      }
    >
      <div className="flex items-center gap-3 px-2 py-2">
        <Avatar name={name} slot={1} size="lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{name}</div>
          <div className="truncate text-xs text-ink-muted">{me?.email}</div>
        </div>
      </div>
      <MenuSeparator />
      <MenuItem icon={<UserRound />} onSelect={() => router.push("/settings")}>
        Profile
      </MenuItem>
      <MenuItem icon={<Settings />} onSelect={() => router.push("/settings?tab=preferences")}>
        Settings
      </MenuItem>
      <MenuSeparator />
      <MenuLabel>Theme</MenuLabel>
      {(
        [
          ["light", "Light", <Sun key="l" />],
          ["dark", "Dark", <Moon key="d" />],
          ["system", "System", <Monitor key="s" />],
        ] as const
      ).map(([value, label, icon]) => (
        <MenuItem key={value} icon={icon} onSelect={() => setTheme(value)} hint={theme === value ? "✓" : undefined}>
          {label}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        icon={<LogOut />}
        onSelect={() => toast("Authentication is coming soon", { description: "This demo always uses the default account." })}
      >
        Sign out
      </MenuItem>
    </Menu>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Icons switch with CSS so server and client markup always match.
  return (
    <IconButton label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Moon className="size-[18px] dark:hidden" />
      <Sun className="hidden size-[18px] dark:block" />
    </IconButton>
  );
}
