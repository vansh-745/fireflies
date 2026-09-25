// Mirrors the FastAPI response models in backend/app/schemas.

export type Platform = "zoom" | "google_meet" | "teams" | "upload";
export type MeetingSource = "seed" | "upload" | "paste" | "manual";
export type ParticipantRole = "host" | "attendee";
export type SegmentFlag = "question" | "metric" | "date" | "task";

export interface Person {
  id: number;
  name: string;
  email: string | null;
}

export interface PersonWithCount extends Person {
  meeting_count: number;
}

export interface Participant {
  id: number;
  person_id: number;
  name: string;
  email: string | null;
  role: ParticipantRole;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface TagWithCount extends Tag {
  meeting_count: number;
}

interface MeetingBase {
  id: number;
  title: string;
  started_at: string;
  duration_seconds: number;
  platform: Platform;
  source: MeetingSource;
  participants: Participant[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface MeetingListItem extends MeetingBase {
  gist: string | null;
  keywords: string[];
  action_items_total: number;
  action_items_open: number;
}

export interface Summary {
  gist: string;
  overview: string;
  keywords: string[];
  generated_by: "seed" | "heuristic" | "llm";
  status: "ready" | "processing";
  model: string | null;
  updated_at: string;
}

export interface Chapter {
  id: number;
  position: number;
  title: string;
  start_ms: number;
  bullets: string[];
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  text: string;
  assignee: Person | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  source: "ai" | "manual";
  segment_id: number | null;
  start_ms: number | null;
  created_at: string;
}

export interface ActionItemWithMeeting extends ActionItem {
  meeting: { id: number; title: string; started_at: string };
}

export interface SpeakerStat {
  participant_id: number | null;
  name: string;
  talk_time_ms: number;
  talk_percent: number;
  word_count: number;
  words_per_minute: number;
  segment_count: number;
  questions: number;
  longest_monologue_ms: number;
}

export interface MeetingDetail extends MeetingBase {
  media_url: string | null;
  summary: Summary | null;
  chapters: Chapter[];
  action_items: ActionItem[];
  speaker_stats: SpeakerStat[];
  segment_count: number;
  comment_count: number;
  soundbite_count: number;
  llm_available: boolean;
}

export interface Segment {
  id: number;
  position: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: { participant_id: number; person_id: number; name: string } | null;
  flags: SegmentFlag[];
  comment_count: number;
}

export interface Comment {
  id: number;
  segment_id: number;
  body: string;
  author: { id: number; name: string };
  created_at: string;
  start_ms: number;
}

export interface Soundbite {
  id: number;
  meeting_id: number;
  title: string;
  start_ms: number;
  end_ms: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatAnswer {
  question: ChatMessage;
  answer: ChatMessage;
  powered_by: "llm" | "offline";
}

export interface SearchHit {
  segment_id: number;
  start_ms: number;
  speaker: string | null;
  snippet: string;
}

export interface SearchResultMeeting {
  meeting_id: number;
  title: string;
  started_at: string;
  duration_seconds: number;
  title_match: boolean;
  hits: SearchHit[];
  total_hits: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultMeeting[];
  total_meetings: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  meeting_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface Stats {
  meetings_total: number;
  meetings_this_week: number;
  minutes_total: number;
  minutes_this_week: number;
  open_action_items: number;
  completed_action_items: number;
  people_total: number;
}

export type SortOption = "newest" | "oldest" | "longest" | "shortest" | "title";

export interface MeetingFilters {
  q?: string;
  personIds?: number[];
  tagIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  sort?: SortOption;
}

export interface ParticipantInput {
  name: string;
  email?: string | null;
  role?: ParticipantRole;
}

export interface MeetingCreateInput {
  title: string;
  started_at?: string;
  duration_seconds?: number;
  platform?: Platform;
  participants?: ParticipantInput[];
  tags?: string[];
  media_url?: string | null;
  transcript_text?: string;
}

export interface MeetingUpdateInput {
  title?: string;
  started_at?: string;
  platform?: Platform;
  participants?: ParticipantInput[];
  tags?: string[];
  media_url?: string | null;
}

export type ExportFormat = "md" | "txt" | "srt" | "pdf";
export type ExportContent = "full" | "summary" | "transcript";
