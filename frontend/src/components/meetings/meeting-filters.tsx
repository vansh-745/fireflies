"use client";

import { endOfDay, startOfDay, subDays } from "date-fns";
import { ArrowUpDown, Calendar, ChevronDown, Search, Tag, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { TagChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { Menu, MenuCheckItem, MenuItem, MenuLabel, Popover } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useDebounced } from "@/lib/hooks";
import { usePeople, useTags } from "@/lib/queries";
import type { MeetingFilters, SortOption } from "@/lib/types";

export type DateRange = "any" | "today" | "7d" | "30d" | "90d" | "custom";

const RANGE_LABELS: Record<DateRange, string> = {
  any: "Any time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom range",
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  longest: "Longest",
  shortest: "Shortest",
  title: "Title A–Z",
};

export interface FilterState {
  q: string;
  people: number[];
  tags: number[];
  range: DateRange;
  from: string;
  to: string;
  sort: SortOption;
}

/** Filters live in the URL so a filtered view can be shared or bookmarked. */
export function useFilterState(): [FilterState, (patch: Partial<FilterState>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state: FilterState = {
    q: params.get("q") ?? "",
    people: params.getAll("person").map(Number).filter(Boolean),
    tags: params.getAll("tag").map(Number).filter(Boolean),
    range: (params.get("range") as DateRange) ?? "any",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    sort: (params.get("sort") as SortOption) ?? "newest",
  };

  const update = (patch: Partial<FilterState>) => {
    const next = { ...state, ...patch };
    const search = new URLSearchParams();
    if (next.q) search.set("q", next.q);
    next.people.forEach((id) => search.append("person", String(id)));
    next.tags.forEach((id) => search.append("tag", String(id)));
    if (next.range !== "any") search.set("range", next.range);
    if (next.range === "custom") {
      if (next.from) search.set("from", next.from);
      if (next.to) search.set("to", next.to);
    }
    if (next.sort !== "newest") search.set("sort", next.sort);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return [state, update];
}

export function toApiFilters(state: FilterState): MeetingFilters {
  const now = new Date();
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (state.range === "today") dateFrom = startOfDay(now);
  if (state.range === "7d") dateFrom = subDays(now, 7);
  if (state.range === "30d") dateFrom = subDays(now, 30);
  if (state.range === "90d") dateFrom = subDays(now, 90);
  if (state.range === "custom") {
    if (state.from) dateFrom = startOfDay(new Date(`${state.from}T00:00`));
    if (state.to) dateTo = endOfDay(new Date(`${state.to}T00:00`));
  }
  return {
    q: state.q || undefined,
    personIds: state.people.length ? state.people : undefined,
    tagIds: state.tags.length ? state.tags : undefined,
    // Round to the minute so the query key stays stable between renders.
    dateFrom: dateFrom ? new Date(Math.floor(dateFrom.getTime() / 60_000) * 60_000).toISOString() : undefined,
    dateTo: dateTo?.toISOString(),
    sort: state.sort,
  };
}

function FilterButton({ active, icon, children }: { active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "pressable inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap",
        active ? "border-accent bg-accent-subtle text-accent-ink" : "border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink",
      )}
    >
      <span className="[&>svg]:size-3.5">{icon}</span>
      {children}
      <ChevronDown className="size-3.5 opacity-70" />
    </button>
  );
}

export function MeetingFiltersBar({ state, update }: { state: FilterState; update: (patch: Partial<FilterState>) => void }) {
  const { data: people = [] } = usePeople();
  const { data: tags = [] } = useTags();
  const [search, setSearch] = useState(state.q);
  const debounced = useDebounced(search, 250);
  const [peopleQuery, setPeopleQuery] = useState("");

  useEffect(() => {
    if (debounced !== state.q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debounced]);

  const visiblePeople = useMemo(
    () => people.filter((p) => p.name.toLowerCase().includes(peopleQuery.toLowerCase())),
    [people, peopleQuery],
  );
  const selectedPeople = people.filter((p) => state.people.includes(p.id));
  const selectedTags = tags.filter((t) => state.tags.includes(t.id));
  const hasFilters = Boolean(state.q || state.people.length || state.tags.length || state.range !== "any");

  const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72">
          <Input
            icon={<Search />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by title or participant"
            aria-label="Filter meetings by title or participant"
            className="h-8"
          />
        </div>

        <Popover
          trigger={
            <span>
              <FilterButton active={state.range !== "any"} icon={<Calendar />}>
                {RANGE_LABELS[state.range]}
              </FilterButton>
            </span>
          }
          className="w-64 p-1"
        >
          <div className="flex flex-col">
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => update({ range })}
                className={cn(
                  "flex h-8 items-center rounded-md px-2 text-left text-sm hover:bg-surface-sunken",
                  state.range === range ? "font-medium text-accent-ink" : "text-ink",
                )}
              >
                {RANGE_LABELS[range]}
              </button>
            ))}
            {state.range === "custom" && (
              <div className="mt-1 grid grid-cols-2 gap-2 border-t border-border p-2">
                <label className="text-xs text-ink-muted">
                  From
                  <Input type="date" value={state.from} onChange={(event) => update({ from: event.target.value })} className="mt-1 h-8 px-2 text-xs" />
                </label>
                <label className="text-xs text-ink-muted">
                  To
                  <Input type="date" value={state.to} onChange={(event) => update({ to: event.target.value })} className="mt-1 h-8 px-2 text-xs" />
                </label>
              </div>
            )}
          </div>
        </Popover>

        <Popover
          trigger={
            <span>
              <FilterButton active={state.people.length > 0} icon={<Users />}>
                {state.people.length ? `${state.people.length} participant${state.people.length > 1 ? "s" : ""}` : "Participants"}
              </FilterButton>
            </span>
          }
          className="w-72"
        >
          <div className="border-b border-border p-2">
            <Input value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Search people" className="h-8" autoFocus />
          </div>
          <ul className="max-h-72 overflow-y-auto p-1">
            {visiblePeople.map((person) => {
              const checked = state.people.includes(person.id);
              return (
                <li key={person.id}>
                  <label className="flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 hover:bg-surface-sunken">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => update({ people: toggle(state.people, person.id) })}
                      className="size-4 accent-(--accent)"
                    />
                    <Avatar name={person.name} size="sm" />
                    <span className="flex-1 truncate text-sm text-ink">{person.name}</span>
                    <span className="text-xs text-ink-subtle">{person.meeting_count}</span>
                  </label>
                </li>
              );
            })}
            {visiblePeople.length === 0 && <li className="px-3 py-4 text-center text-sm text-ink-muted">No people found</li>}
          </ul>
        </Popover>

        <Menu
          align="start"
          trigger={
            <span>
              <FilterButton active={state.tags.length > 0} icon={<Tag />}>
                {state.tags.length ? `${state.tags.length} topic${state.tags.length > 1 ? "s" : ""}` : "Topics"}
              </FilterButton>
            </span>
          }
        >
          <MenuLabel>Filter by topic</MenuLabel>
          {tags.map((tag) => (
            <MenuCheckItem key={tag.id} checked={state.tags.includes(tag.id)} onCheckedChange={() => update({ tags: toggle(state.tags, tag.id) })}>
              <span className="flex flex-1 items-center justify-between gap-3">
                <TagChip name={tag.name} color={tag.color} />
                <span className="text-xs text-ink-subtle">{tag.meeting_count}</span>
              </span>
            </MenuCheckItem>
          ))}
        </Menu>

        <div className="ml-auto">
          <Menu
            trigger={
              <span>
                <FilterButton active={false} icon={<ArrowUpDown />}>
                  {SORT_LABELS[state.sort]}
                </FilterButton>
              </span>
            }
          >
            <MenuLabel>Sort by</MenuLabel>
            {(Object.keys(SORT_LABELS) as SortOption[]).map((sort) => (
              <MenuItem key={sort} onSelect={() => update({ sort })} hint={state.sort === sort ? "✓" : undefined}>
                {SORT_LABELS[sort]}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-ink-subtle">Filtered by</span>
          {state.q && <ActiveFilter onRemove={() => { setSearch(""); update({ q: "" }); }}>“{state.q}”</ActiveFilter>}
          {state.range !== "any" && <ActiveFilter onRemove={() => update({ range: "any", from: "", to: "" })}>{RANGE_LABELS[state.range]}</ActiveFilter>}
          {selectedPeople.map((p) => (
            <ActiveFilter key={`p${p.id}`} onRemove={() => update({ people: state.people.filter((id) => id !== p.id) })}>
              {p.name}
            </ActiveFilter>
          ))}
          {selectedTags.map((t) => (
            <ActiveFilter key={`t${t.id}`} onRemove={() => update({ tags: state.tags.filter((id) => id !== t.id) })}>
              #{t.name}
            </ActiveFilter>
          ))}
          <button
            type="button"
            onClick={() => {
              setSearch("");
              update({ q: "", people: [], tags: [], range: "any", from: "", to: "" });
            }}
            className="font-medium text-accent-ink hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveFilter({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent-subtle pr-1 pl-2.5 font-medium text-accent-ink">
      {children}
      <button type="button" onClick={onRemove} aria-label="Remove filter" className="inline-flex size-4 items-center justify-center rounded-full hover:bg-surface">
        <X className="size-3" />
      </button>
    </span>
  );
}
