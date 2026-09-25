"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "./api";
import type { ActionItem, MeetingCreateInput, MeetingDetail, MeetingFilters, MeetingUpdateInput } from "./types";

export const keys = {
  meetings: ["meetings"] as const,
  meetingList: (filters: MeetingFilters) => ["meetings", filters] as const,
  meeting: (id: number) => ["meeting", id] as const,
  transcript: (id: number) => ["transcript", id] as const,
  comments: (id: number) => ["comments", id] as const,
  soundbites: (id: number) => ["soundbites", id] as const,
  chat: (id: number) => ["chat", id] as const,
  actionItems: ["action-items"] as const,
  actionItemList: (params: object) => ["action-items", params] as const,
  people: ["people"] as const,
  tags: ["tags"] as const,
  stats: ["stats"] as const,
  me: ["me"] as const,
  notifications: ["notifications"] as const,
  search: (q: string) => ["search", q] as const,
};

const PAGE_SIZE = 20;

/** Anything that changes a meeting can change the library, dashboard and task list too. */
function invalidateWorkspace(qc: QueryClient, meetingId?: number) {
  if (meetingId !== undefined) void qc.invalidateQueries({ queryKey: keys.meeting(meetingId) });
  void qc.invalidateQueries({ queryKey: keys.meetings });
  void qc.invalidateQueries({ queryKey: keys.actionItems });
  void qc.invalidateQueries({ queryKey: keys.stats });
  void qc.invalidateQueries({ queryKey: keys.notifications });
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useMeetings(filters: MeetingFilters) {
  return useInfiniteQuery({
    queryKey: keys.meetingList(filters),
    queryFn: ({ pageParam }) => api.listMeetings(filters, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
  });
}

export function useRecentMeetings(limit = 5) {
  return useQuery({
    queryKey: [...keys.meetings, "recent", limit],
    queryFn: () => api.listMeetings({ sort: "newest" }, 1, limit),
  });
}

export function useMeeting(id: number) {
  return useQuery({
    queryKey: keys.meeting(id),
    queryFn: () => api.getMeeting(id),
    // While Claude writes the notes in the background, poll until they land.
    refetchInterval: (query) => (query.state.data?.summary?.status === "processing" ? 2500 : false),
  });
}

export function useTranscript(id: number) {
  return useQuery({ queryKey: keys.transcript(id), queryFn: () => api.getTranscript(id), staleTime: 60_000 });
}

export function useComments(id: number) {
  return useQuery({ queryKey: keys.comments(id), queryFn: () => api.getComments(id) });
}

export function useSoundbites(id: number) {
  return useQuery({ queryKey: keys.soundbites(id), queryFn: () => api.getSoundbites(id) });
}

export function useChat(id: number) {
  return useQuery({ queryKey: keys.chat(id), queryFn: () => api.getChat(id) });
}

export function useActionItems(params: { completed?: boolean; assigneeId?: number; limit?: number }) {
  return useQuery({ queryKey: keys.actionItemList(params), queryFn: () => api.listActionItems(params) });
}

export function usePeople() {
  return useQuery({ queryKey: keys.people, queryFn: api.people, staleTime: 60_000 });
}

export function useTags() {
  return useQuery({ queryKey: keys.tags, queryFn: api.tags, staleTime: 60_000 });
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: api.stats });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: 5 * 60_000 });
}

export function useNotifications() {
  return useQuery({ queryKey: keys.notifications, queryFn: api.notifications, refetchInterval: 30_000 });
}

export function useSearch(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: keys.search(query),
    queryFn: () => api.search(query),
    enabled: query.length > 0,
    placeholderData: (previous) => previous,
  });
}

// ── Meeting mutations ──────────────────────────────────────────────────────

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingCreateInput) => api.createMeeting(input),
    onSuccess: (meeting) => {
      qc.setQueryData(keys.meeting(meeting.id), meeting);
      invalidateWorkspace(qc);
      void qc.invalidateQueries({ queryKey: keys.people });
      void qc.invalidateQueries({ queryKey: keys.tags });
    },
  });
}

export function useUploadMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.uploadMeeting(form),
    onSuccess: (meeting) => {
      qc.setQueryData(keys.meeting(meeting.id), meeting);
      invalidateWorkspace(qc);
      void qc.invalidateQueries({ queryKey: keys.people });
      void qc.invalidateQueries({ queryKey: keys.tags });
    },
  });
}

export function useUpdateMeeting(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MeetingUpdateInput) => api.updateMeeting(id, input),
    onSuccess: (meeting) => {
      qc.setQueryData(keys.meeting(id), meeting);
      invalidateWorkspace(qc);
      void qc.invalidateQueries({ queryKey: keys.transcript(id) });
      void qc.invalidateQueries({ queryKey: keys.people });
      void qc.invalidateQueries({ queryKey: keys.tags });
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteMeeting(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.meeting(id) });
      qc.removeQueries({ queryKey: keys.transcript(id) });
      invalidateWorkspace(qc);
      void qc.invalidateQueries({ queryKey: keys.people });
      void qc.invalidateQueries({ queryKey: keys.tags });
    },
  });
}

export function useRegenerateSummary(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.regenerateSummary(id),
    onSuccess: (meeting) => {
      qc.setQueryData(keys.meeting(id), meeting);
      invalidateWorkspace(qc);
      void qc.invalidateQueries({ queryKey: keys.transcript(id) });
    },
  });
}

export function useUpdateSummary(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { gist?: string; overview?: string; keywords?: string[] }) => api.updateSummary(id, input),
    onSuccess: (summary) => {
      qc.setQueryData<MeetingDetail>(keys.meeting(id), (old) => (old ? { ...old, summary } : old));
      void qc.invalidateQueries({ queryKey: keys.meetings });
    },
  });
}

// ── Action items ────────────────────────────────────────────────────────────

function patchItemInMeeting(qc: QueryClient, meetingId: number, id: number, patch: Partial<ActionItem>) {
  qc.setQueryData<MeetingDetail>(keys.meeting(meetingId), (old) =>
    old ? { ...old, action_items: old.action_items.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : old,
  );
}

export function useUpdateActionItem(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & Parameters<typeof api.updateActionItem>[1]) =>
      api.updateActionItem(id, input),
    // Optimistic: ticking a checkbox should feel instant.
    onMutate: async ({ id, ...input }) => {
      await qc.cancelQueries({ queryKey: keys.meeting(meetingId) });
      const previous = qc.getQueryData<MeetingDetail>(keys.meeting(meetingId));
      if ("is_completed" in input || "text" in input) patchItemInMeeting(qc, meetingId, id, input as Partial<ActionItem>);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(keys.meeting(meetingId), context.previous);
    },
    onSuccess: (item) => patchItemInMeeting(qc, meetingId, item.id, item),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.meetings });
      void qc.invalidateQueries({ queryKey: keys.actionItems });
      void qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

/** Toggle from a cross-meeting list (dashboard); updates both caches. */
export function useToggleActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; meetingId: number; done: boolean }) =>
      api.updateActionItem(id, { is_completed: done }),
    onSuccess: (item) => patchItemInMeeting(qc, item.meeting_id, item.id, item),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.actionItems });
      void qc.invalidateQueries({ queryKey: keys.meetings });
      void qc.invalidateQueries({ queryKey: keys.stats });
    },
  });
}

export function useCreateActionItem(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createActionItem>[1]) => api.createActionItem(meetingId, input),
    onSuccess: (item) => {
      qc.setQueryData<MeetingDetail>(keys.meeting(meetingId), (old) =>
        old ? { ...old, action_items: [...old.action_items, item] } : old,
      );
      void qc.invalidateQueries({ queryKey: keys.transcript(meetingId) });
      invalidateWorkspace(qc);
    },
  });
}

export function useDeleteActionItem(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteActionItem(id),
    onSuccess: (_, id) => {
      qc.setQueryData<MeetingDetail>(keys.meeting(meetingId), (old) =>
        old ? { ...old, action_items: old.action_items.filter((a) => a.id !== id) } : old,
      );
      void qc.invalidateQueries({ queryKey: keys.transcript(meetingId) });
      invalidateWorkspace(qc);
    },
  });
}

// ── Transcript, comments, soundbites ────────────────────────────────────────

export function useUpdateSegment(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, ...input }: { segmentId: number; text?: string; speaker_participant_id?: number }) =>
      api.updateSegment(meetingId, segmentId, input),
    onSuccess: (segment) => {
      qc.setQueryData(keys.transcript(meetingId), (old: Awaited<ReturnType<typeof api.getTranscript>> | undefined) =>
        old?.map((s) => (s.id === segment.id ? segment : s)),
      );
      void qc.invalidateQueries({ queryKey: keys.meeting(meetingId) });
    },
  });
}

export function useAddComment(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ segmentId, body }: { segmentId: number; body: string }) => api.addComment(meetingId, segmentId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.comments(meetingId) });
      void qc.invalidateQueries({ queryKey: keys.transcript(meetingId) });
      void qc.invalidateQueries({ queryKey: keys.meeting(meetingId) });
    },
  });
}

export function useDeleteComment(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => api.deleteComment(commentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.comments(meetingId) });
      void qc.invalidateQueries({ queryKey: keys.transcript(meetingId) });
      void qc.invalidateQueries({ queryKey: keys.meeting(meetingId) });
    },
  });
}

export function useAddSoundbite(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; start_ms: number; end_ms: number }) => api.addSoundbite(meetingId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.soundbites(meetingId) });
      void qc.invalidateQueries({ queryKey: keys.meeting(meetingId) });
    },
  });
}

export function useDeleteSoundbite(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteSoundbite(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.soundbites(meetingId) });
      void qc.invalidateQueries({ queryKey: keys.meeting(meetingId) });
    },
  });
}

// ── AskFred ─────────────────────────────────────────────────────────────────

export function useAsk(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => api.ask(meetingId, question),
    onSuccess: (answer) => {
      qc.setQueryData(keys.chat(meetingId), (old: Awaited<ReturnType<typeof api.getChat>> | undefined) => [
        ...(old ?? []),
        answer.question,
        answer.answer,
      ]);
    },
  });
}

export function useClearChat(meetingId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.clearChat(meetingId),
    onSuccess: () => qc.setQueryData(keys.chat(meetingId), []),
  });
}

// ── Workspace ───────────────────────────────────────────────────────────────

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: (user) => qc.setQueryData(keys.me, user),
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.notifications }),
  });
}
