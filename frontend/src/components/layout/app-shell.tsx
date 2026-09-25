"use client";

import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus, Radio } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dialog as RadixDialog } from "radix-ui";
import { useState, type ReactNode } from "react";

import { CreateMeetingProvider, useOpenCreateMeeting } from "@/components/meetings/create-meeting-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { usePreferences } from "@/lib/preferences";

import { CaptureDialog } from "./capture-dialog";
import { GlobalSearch } from "./global-search";
import { Sidebar, SidebarContent } from "./sidebar";
import { NotificationsMenu, ProfileMenu, ThemeToggle } from "./topbar-menus";

/** The meeting page needs the width, so the nav collapses to icons there. */
function useIsMeetingPage() {
  return /^\/meetings\/\d+/.test(usePathname());
}

function Topbar({ collapsed, onToggleSidebar, onOpenMobileNav }: { collapsed: boolean; onToggleSidebar: () => void; onOpenMobileNav: () => void }) {
  const openCreate = useOpenCreateMeeting();
  const [captureOpen, setCaptureOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-(--topbar-height) shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <IconButton label="Open navigation" className="md:hidden" onClick={onOpenMobileNav}>
        <MenuIcon className="size-5" />
      </IconButton>
      <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden md:inline-flex" onClick={onToggleSidebar}>
        {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
      </IconButton>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="soft" size="sm" className="hidden lg:inline-flex" icon={<Radio className="size-4" />} onClick={() => setCaptureOpen(true)}>
          Capture
        </Button>
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => openCreate()}>
          <span className="hidden sm:inline">New meeting</span>
        </Button>
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <ThemeToggle />
        <NotificationsMenu />
        <ProfileMenu />
      </div>
      <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = usePreferences();
  const meetingPage = useIsMeetingPage();
  const [mobileNav, setMobileNav] = useState(false);
  // On the meeting page the rail stays collapsed unless explicitly expanded there.
  const [expandedOnMeeting, setExpandedOnMeeting] = useState(false);
  const collapsed = meetingPage ? !expandedOnMeeting : prefs.sidebarCollapsed;

  const toggle = () => {
    if (meetingPage) setExpandedOnMeeting((v) => !v);
    else setPrefs({ sidebarCollapsed: !prefs.sidebarCollapsed });
  };

  return (
    <CreateMeetingProvider>
      <div className="flex min-h-dvh">
        <Sidebar collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar collapsed={collapsed} onToggleSidebar={toggle} onOpenMobileNav={() => setMobileNav(true)} />
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        </div>
      </div>

      <RadixDialog.Root open={mobileNav} onOpenChange={setMobileNav}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="dialog-scrim fixed inset-0 z-50 bg-scrim md:hidden" />
          <RadixDialog.Content className="drawer-content fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-surface shadow-elev-3 md:hidden">
            <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Main navigation</RadixDialog.Description>
            <SidebarContent collapsed={false} onNavigate={() => setMobileNav(false)} />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </CreateMeetingProvider>
  );
}
