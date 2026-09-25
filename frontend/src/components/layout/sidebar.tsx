"use client";

import {
  ChartColumn,
  Crown,
  House,
  Plug,
  Settings,
  Tags,
  Upload,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import { Logo } from "./logo";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/meetings", label: "Meetings", icon: Video },
  { href: "/uploads", label: "Uploads", icon: Upload },
  { href: "/topics", label: "Topic Tracker", icon: Tags },
];

const SECONDARY: NavItem[] = [
  { href: "/integrations", label: "Integrations", icon: Plug, soon: true },
  { href: "/analytics", label: "Analytics", icon: ChartColumn, soon: true },
  { href: "/team", label: "Team", icon: Users, soon: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-md text-sm font-medium",
        "transition-colors duration-(--duration-press) ease-(--ease-hover)",
        collapsed ? "w-10 justify-center" : "px-3",
        active ? "bg-accent-subtle text-accent-ink" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.soon && <span className="size-1.5 rounded-full bg-warning" aria-label="Coming soon" />}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className={cn("flex h-(--topbar-height) shrink-0 items-center", collapsed ? "justify-center" : "px-5")}
        aria-label="Fireflies clone home"
      >
        <Logo collapsed={collapsed} />
      </Link>

      <nav aria-label="Main" className={cn("flex flex-1 flex-col gap-1 overflow-y-auto py-2", collapsed ? "items-center px-2" : "px-3")}>
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
        <div className={cn("my-3 h-px bg-border", collapsed ? "w-8" : "mx-2")} />
        {SECONDARY.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {!collapsed && (
        <div className="m-3 rounded-xl border border-border bg-surface-raised p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Crown className="size-4 text-warning" aria-hidden />
            Free plan
          </div>
          <p className="mt-1 text-xs text-ink-muted">Unlimited transcripts in this demo workspace.</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full w-2/5 origin-left rounded-full bg-accent" />
          </div>
          <button
            type="button"
            onClick={() => toast("Billing is coming soon", { description: "Plans and upgrades aren't part of this clone." })}
            className="pressable mt-3 h-8 w-full rounded-md bg-accent text-[13px] font-semibold text-on-accent hover:bg-accent-hover"
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-surface md:block",
        collapsed ? "w-(--sidebar-width-collapsed)" : "w-(--sidebar-width)",
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
