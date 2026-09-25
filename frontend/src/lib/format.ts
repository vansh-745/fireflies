import { differenceInCalendarDays, format, isToday, isYesterday } from "date-fns";

/** 83_000 → "01:23", 3_723_000 → "1:02:03" */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Parse "01:23" / "1:02:03" back to milliseconds. */
export function parseTimestamp(value: string): number | null {
  const parts = value.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n)) || parts.length < 2 || parts.length > 3) return null;
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return ((h * 60 + m) * 60 + s) * 1000;
}

/** 2_760 → "46 min", 4_000 → "1h 7m", 40 → "40 sec" */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatMeetingDate(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "h:mm a")}`;
  return format(date, "EEE, MMM d · h:mm a");
}

export function formatLongDate(iso: string): string {
  return format(new Date(iso), "EEEE, MMMM d, yyyy · h:mm a");
}

/** Group label used by the meetings list ("Today", "Yesterday", "Mon, Sep 22"). */
export function dayGroupLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const days = differenceInCalendarDays(now, date);
  if (days < 7) return format(date, "EEEE");
  return format(date, date.getFullYear() === now.getFullYear() ? "EEE, MMM d" : "MMM d, yyyy");
}

export function formatDueDate(isoDate: string): { label: string; overdue: boolean } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const days = differenceInCalendarDays(due, new Date());
  if (days === 0) return { label: "Due today", overdue: false };
  if (days === 1) return { label: "Due tomorrow", overdue: false };
  if (days < 0) return { label: `Overdue · ${format(due, "MMM d")}`, overdue: true };
  return { label: `Due ${format(due, "MMM d")}`, overdue: false };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export const PLATFORM_LABELS = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  upload: "Upload",
} as const;
