import type {
  ActionItem,
  ActionItemWithMeeting,
  ChatAnswer,
  ChatMessage,
  Comment,
  ExportContent,
  ExportFormat,
  MeetingCreateInput,
  MeetingDetail,
  MeetingFilters,
  MeetingListItem,
  MeetingUpdateInput,
  Notification,
  Page,
  PersonWithCount,
  SearchResponse,
  Segment,
  Soundbite,
  Stats,
  Summary,
  TagWithCount,
  User,
} from "./types";

/**
 * Requests go to `/api/*` on the same origin; next.config.ts rewrites them to
 * the FastAPI backend. Set NEXT_PUBLIC_API_URL to call the backend directly.
 */
const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) {
      const first = detail[0] as { msg: string; loc?: (string | number)[] };
      const field = first.loc?.at(-1);
      return field && typeof field === "string" ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(errorMessage(body, `Request failed (${res.status})`), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (body: unknown) => JSON.stringify(body);

function meetingQuery(filters: MeetingFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  filters.personIds?.forEach((id) => params.append("person_id", String(id)));
  filters.tagIds?.forEach((id) => params.append("tag_id", String(id)));
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.sort) params.set("sort", filters.sort);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  return params.toString();
}

export const api = {
  // Meetings
  listMeetings: (filters: MeetingFilters, page = 1, pageSize = 20) =>
    request<Page<MeetingListItem>>(`/meetings?${meetingQuery(filters, page, pageSize)}`),
  getMeeting: (id: number) => request<MeetingDetail>(`/meetings/${id}`),
  createMeeting: (input: MeetingCreateInput) =>
    request<MeetingDetail>("/meetings", { method: "POST", body: json(input) }),
  uploadMeeting: (form: FormData) => request<MeetingDetail>("/meetings/upload", { method: "POST", body: form }),
  updateMeeting: (id: number, input: MeetingUpdateInput) =>
    request<MeetingDetail>(`/meetings/${id}`, { method: "PATCH", body: json(input) }),
  deleteMeeting: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  regenerateSummary: (id: number) =>
    request<MeetingDetail>(`/meetings/${id}/summary/regenerate`, { method: "POST" }),
  updateSummary: (id: number, input: Partial<Pick<Summary, "gist" | "overview" | "keywords">>) =>
    request<Summary>(`/meetings/${id}/summary`, { method: "PATCH", body: json(input) }),
  exportUrl: (id: number, format: ExportFormat, content: ExportContent = "full") =>
    `${BASE}/meetings/${id}/export?format=${format}&content=${content}`,

  // Transcript, comments, soundbites
  getTranscript: (id: number) => request<Segment[]>(`/meetings/${id}/transcript`),
  updateSegment: (meetingId: number, segmentId: number, input: { text?: string; speaker_participant_id?: number }) =>
    request<Segment>(`/meetings/${meetingId}/transcript/${segmentId}`, { method: "PATCH", body: json(input) }),
  getComments: (id: number) => request<Comment[]>(`/meetings/${id}/comments`),
  addComment: (id: number, segmentId: number, body: string) =>
    request<Comment>(`/meetings/${id}/comments`, { method: "POST", body: json({ segment_id: segmentId, body }) }),
  deleteComment: (commentId: number) => request<void>(`/comments/${commentId}`, { method: "DELETE" }),
  getSoundbites: (id: number) => request<Soundbite[]>(`/meetings/${id}/soundbites`),
  addSoundbite: (id: number, input: { title: string; start_ms: number; end_ms: number }) =>
    request<Soundbite>(`/meetings/${id}/soundbites`, { method: "POST", body: json(input) }),
  deleteSoundbite: (soundbiteId: number) => request<void>(`/soundbites/${soundbiteId}`, { method: "DELETE" }),

  // Action items
  listActionItems: (params: { completed?: boolean; assigneeId?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.completed !== undefined) q.set("completed", String(params.completed));
    if (params.assigneeId !== undefined) q.set("assignee_id", String(params.assigneeId));
    q.set("limit", String(params.limit ?? 50));
    return request<ActionItemWithMeeting[]>(`/action-items?${q}`);
  },
  createActionItem: (
    meetingId: number,
    input: { text: string; assignee_id?: number | null; due_date?: string | null; segment_id?: number | null },
  ) => request<ActionItem>(`/meetings/${meetingId}/action-items`, { method: "POST", body: json(input) }),
  updateActionItem: (
    id: number,
    input: Partial<{ text: string; assignee_id: number | null; due_date: string | null; is_completed: boolean }>,
  ) => request<ActionItem>(`/action-items/${id}`, { method: "PATCH", body: json(input) }),
  deleteActionItem: (id: number) => request<void>(`/action-items/${id}`, { method: "DELETE" }),

  // AskFred
  getChat: (id: number) => request<ChatMessage[]>(`/meetings/${id}/chat`),
  ask: (id: number, question: string) =>
    request<ChatAnswer>(`/meetings/${id}/chat`, { method: "POST", body: json({ question }) }),
  clearChat: (id: number) => request<void>(`/meetings/${id}/chat`, { method: "DELETE" }),

  // Workspace
  search: (q: string) => request<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
  people: () => request<PersonWithCount[]>("/people"),
  tags: () => request<TagWithCount[]>("/tags"),
  stats: () => request<Stats>("/stats"),
  me: () => request<User>("/me"),
  updateMe: (input: Partial<Pick<User, "name" | "email" | "job_title">>) =>
    request<User>("/me", { method: "PATCH", body: json(input) }),
  notifications: () => request<Notification[]>("/notifications"),
  markNotificationsRead: () => request<void>("/notifications/read-all", { method: "POST" }),
};
