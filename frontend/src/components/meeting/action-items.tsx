"use client";

import { CalendarDays, Ellipsis, Plus, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, TaskCheckbox, Textarea } from "@/components/ui/field";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatDueDate } from "@/lib/format";
import { useCreateActionItem, useDeleteActionItem, useUpdateActionItem } from "@/lib/queries";
import type { ActionItem, Participant } from "@/lib/types";

import { useMeetingUI } from "./meeting-context";
import { TimestampLink } from "./timestamp-link";

function AssigneeMenu({
  participants,
  assigneeId,
  onChange,
  trigger,
}: {
  participants: Participant[];
  assigneeId: number | null;
  onChange: (personId: number | null) => void;
  trigger: React.ReactNode;
}) {
  return (
    <Menu trigger={trigger} align="start">
      <MenuLabel>Assign to</MenuLabel>
      {participants.map((p) => (
        <MenuItem key={p.person_id} icon={<UserRound />} onSelect={() => onChange(p.person_id)} hint={p.person_id === assigneeId ? "✓" : undefined}>
          {p.name}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem icon={<X />} onSelect={() => onChange(null)} hint={assigneeId === null ? "✓" : undefined}>
        Unassigned
      </MenuItem>
    </Menu>
  );
}

function ActionItemRow({ item, participants }: { item: ActionItem; participants: Participant[] }) {
  const { meeting } = useMeetingUI();
  const update = useUpdateActionItem(meeting.id);
  const remove = useDeleteActionItem(meeting.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [dueOpen, setDueOpen] = useState(false);
  const due = item.due_date ? formatDueDate(item.due_date) : null;

  const save = () => {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== item.text) update.mutate({ id: item.id, text });
    else setDraft(item.text);
  };

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-raised">
      <span className="pt-0.5">
        <TaskCheckbox
          checked={item.is_completed}
          label={item.is_completed ? `Mark “${item.text}” as not done` : `Mark “${item.text}” as done`}
          onChange={(done) =>
            update.mutate({ id: item.id, is_completed: done }, { onSuccess: () => done && toast.success("Action item completed") })
          }
        />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") {
                setDraft(item.text);
                setEditing(false);
              }
            }}
            autoFocus
            aria-label="Action item text"
            className="h-8"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(item.text);
              setEditing(true);
            }}
            className={cn("text-left text-sm leading-5", item.is_completed ? "text-ink-subtle line-through" : "text-ink")}
          >
            {item.text}
          </button>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <AssigneeMenu
            participants={participants}
            assigneeId={item.assignee?.id ?? null}
            onChange={(personId) => update.mutate({ id: item.id, assignee_id: personId })}
            trigger={
              <button type="button" className="inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink">
                {item.assignee ? <Avatar name={item.assignee.name} size="xs" /> : <UserRound className="size-3.5" />}
                {item.assignee ? item.assignee.name : "Assign"}
              </button>
            }
          />
          {dueOpen ? (
            <input
              type="date"
              defaultValue={item.due_date ?? ""}
              autoFocus
              aria-label="Due date"
              onBlur={() => setDueOpen(false)}
              onChange={(event) => {
                update.mutate({ id: item.id, due_date: event.target.value || null });
                setDueOpen(false);
              }}
              className="h-6 rounded border border-border bg-surface px-1 text-xs text-ink"
            />
          ) : (
            <button
              type="button"
              onClick={() => setDueOpen(true)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-surface-sunken",
                due?.overdue && !item.is_completed ? "font-medium text-danger" : "text-ink-muted",
              )}
            >
              <CalendarDays className="size-3.5" />
              {due ? due.label : "Due date"}
            </button>
          )}
          {item.start_ms !== null && <TimestampLink ms={item.start_ms} withIcon />}
          {item.source === "ai" && (
            <Tooltip content="Suggested by Fred">
              <Sparkles className="size-3.5 text-accent" aria-label="AI suggested" />
            </Tooltip>
          )}
        </div>
      </div>
      <Menu
        trigger={
          <IconButton label="Action item options" size="sm" tooltip={false} className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <Ellipsis className="size-4" />
          </IconButton>
        }
      >
        <MenuItem onSelect={() => setEditing(true)}>Edit text</MenuItem>
        <MenuItem onSelect={() => setDueOpen(true)}>Set due date</MenuItem>
        {item.due_date && <MenuItem onSelect={() => update.mutate({ id: item.id, due_date: null })}>Clear due date</MenuItem>}
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} destructive onSelect={() => remove.mutate(item.id, { onSuccess: () => toast.success("Action item deleted") })}>
          Delete
        </MenuItem>
      </Menu>
    </li>
  );
}

export function ActionItemsSection() {
  const { meeting } = useMeetingUI();
  const create = useCreateActionItem(meeting.id);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const items = meeting.action_items;
  const open = items.filter((i) => !i.is_completed).length;

  // Group by assignee like Fireflies (unassigned last), keeping item order within groups.
  const groups = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const item of items) {
      const key = item.assignee?.name ?? "Unassigned";
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));
  }, [items]);

  const submit = () => {
    if (!text.trim()) return;
    create.mutate(
      { text: text.trim(), assignee_id: assigneeId },
      {
        onSuccess: () => {
          setText("");
          toast.success("Action item added");
        },
      },
    );
  };

  const assigneeName = meeting.participants.find((p) => p.person_id === assigneeId)?.name;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {items.length ? `${open} open · ${items.length - open} done` : "No action items yet"}
        </p>
        <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
          Add
        </Button>
      </div>

      {groups.map(([name, groupItems]) => (
        <div key={name} className="mb-2">
          <div className="flex items-center gap-2 px-2 pt-1 pb-0.5">
            {name !== "Unassigned" ? <Avatar name={name} size="xs" /> : <UserRound className="size-4 text-ink-subtle" />}
            <span className="text-xs font-semibold text-ink">{name}</span>
          </div>
          <ul>
            {groupItems.map((item) => (
              <ActionItemRow key={item.id} item={item} participants={meeting.participants} />
            ))}
          </ul>
        </div>
      ))}

      {adding && (
        <form
          className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="What needs to happen?" autoFocus aria-label="New action item" />
          <div className="flex items-center gap-2">
            <AssigneeMenu
              participants={meeting.participants}
              assigneeId={assigneeId}
              onChange={setAssigneeId}
              trigger={
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs text-ink-muted hover:text-ink">
                  <UserRound className="size-3.5" /> {assigneeName ?? "Assignee"}
                </button>
              }
            />
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" loading={create.isPending} disabled={!text.trim()}>
                Add item
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export function NewActionItemDialog({
  open,
  onOpenChange,
  initialText,
  segmentId,
  defaultAssigneeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText: string;
  segmentId: number | null;
  defaultAssigneeId: number | null;
}) {
  const { meeting } = useMeetingUI();
  const create = useCreateActionItem(meeting.id);
  const [text, setText] = useState(initialText.length > 200 ? `${initialText.slice(0, 197)}…` : initialText);
  const [assigneeId, setAssigneeId] = useState<number | null>(defaultAssigneeId);
  const [due, setDue] = useState("");

  const save = () => {
    if (!text.trim()) return;
    create.mutate(
      { text: text.trim(), assignee_id: assigneeId, due_date: due || null, segment_id: segmentId },
      {
        onSuccess: () => {
          toast.success("Action item created");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title="New action item"
      description="Linked to this moment in the transcript."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={save} disabled={!text.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Task">{(id) => <Textarea id={id} value={text} onChange={(event) => setText(event.target.value)} className="min-h-20" />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assignee">
            {(id) => (
              <select
                id={id}
                value={assigneeId ?? ""}
                onChange={(event) => setAssigneeId(event.target.value ? Number(event.target.value) : null)}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="">Unassigned</option>
                {meeting.participants.map((p) => (
                  <option key={p.person_id} value={p.person_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Due date">{(id) => <Input id={id} type="date" value={due} onChange={(event) => setDue(event.target.value)} />}</Field>
        </div>
      </div>
    </Dialog>
  );
}
