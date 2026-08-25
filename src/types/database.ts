export type ProfileRole = "senior" | "family";
export type Mood = "great" | "okay" | "not_great" | "rough";
export type EscalationSeverity = "low" | "medium" | "high";
export type NotificationMethod = "push" | "sms" | "both";

export interface Profile {
  id: string;
  role: ProfileRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
}

export interface SeniorFamilyLink {
  id: string;
  senior_id: string;
  family_member_id: string;
  relationship: string | null;
  is_emergency_contact: boolean;
  created_at: string;
}

export interface CheckIn {
  id: string;
  senior_id: string;
  occurred_at: string;
  mood: Mood | null;
  mood_emoji: string | null;
  summary: string | null;
  completed: boolean;
  created_at: string;
}

export interface CheckInOption {
  label: string;
  emoji: string;
}

export interface ConversationMessage {
  id: string;
  senior_id: string;
  check_in_id: string | null;
  role: "senior" | "assistant";
  content: string;
  created_at: string;
}

export interface EscalationEvent {
  id: string;
  senior_id: string;
  check_in_id: string | null;
  conversation_message_id: string | null;
  severity: EscalationSeverity;
  trigger_reason: string | null;
  detected_keywords: string[] | null;
  notified_family_member_id: string | null;
  notification_method: NotificationMethod | null;
  notification_sent_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved: boolean;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface CallEvent {
  id: string;
  senior_id: string;
  room_name: string;
  started_at: string;
  target_family_member_id: string | null;
  initiated_by: "senior" | "family";
  target_room_url: string | null;
  caller_label: string | null;
}

export interface CompanionSettings {
  senior_id: string;
  companion_name: string;
  senior_nickname: string | null;
  voice_id: string | null;
  check_in_options: CheckInOption[];
  location_zip: string | null;
  briefing_weather: boolean;
  briefing_news: boolean;
  briefing_reminders: boolean;
  updated_at: string;
}

export type ReminderRecurrence = "yearly" | "daily" | "once";

export interface Reminder {
  id: string;
  senior_id: string;
  title: string;
  recurrence: ReminderRecurrence;
  remind_on: string | null;
  created_at: string;
}

export interface SharedMedia {
  id: string;
  senior_id: string;
  sender_id: string;
  storage_path: string;
  caption: string | null;
  viewed_at: string | null;
  created_at: string;
}

export interface FamilyNote {
  id: string;
  senior_id: string;
  sender_id: string;
  body: string;
  viewed_at: string | null;
  created_at: string;
}

export interface PushToken {
  id: string;
  profile_id: string;
  token: string;
  platform: string | null;
  created_at: string;
}

// Minimal Supabase Database type so `createClient<Database>()` gets table-level
// typing without generating the full CLI output. Shape (Relationships/Views/
// Functions/Enums/CompositeTypes) matches what supabase-js's generic
// constraints require — regenerate with `supabase gen types typescript`
// once the project is live for full accuracy.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; role: ProfileRole; full_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      senior_family_links: {
        Row: SeniorFamilyLink;
        Insert: Partial<SeniorFamilyLink> & { senior_id: string; family_member_id: string };
        Update: Partial<SeniorFamilyLink>;
        Relationships: [];
      };
      check_ins: {
        Row: CheckIn;
        Insert: Partial<CheckIn> & { senior_id: string };
        Update: Partial<CheckIn>;
        Relationships: [];
      };
      conversation_messages: {
        Row: ConversationMessage;
        Insert: Partial<ConversationMessage> & { senior_id: string; role: "senior" | "assistant"; content: string };
        Update: Partial<ConversationMessage>;
        Relationships: [];
      };
      escalation_events: {
        Row: EscalationEvent;
        Insert: Partial<EscalationEvent> & { senior_id: string; severity: EscalationSeverity };
        Update: Partial<EscalationEvent>;
        Relationships: [];
      };
      push_tokens: {
        Row: PushToken;
        Insert: Partial<PushToken> & { profile_id: string; token: string };
        Update: Partial<PushToken>;
        Relationships: [];
      };
      call_events: {
        Row: CallEvent;
        Insert: Partial<CallEvent> & { senior_id: string; room_name: string };
        Update: Partial<CallEvent>;
        Relationships: [];
      };
      companion_settings: {
        Row: CompanionSettings;
        Insert: Partial<CompanionSettings> & { senior_id: string };
        Update: Partial<CompanionSettings>;
        Relationships: [];
      };
      shared_media: {
        Row: SharedMedia;
        Insert: Partial<SharedMedia> & { senior_id: string; sender_id: string; storage_path: string };
        Update: Partial<SharedMedia>;
        Relationships: [];
      };
      family_notes: {
        Row: FamilyNote;
        Insert: Partial<FamilyNote> & { senior_id: string; sender_id: string; body: string };
        Update: Partial<FamilyNote>;
        Relationships: [];
      };
      reminders: {
        Row: Reminder;
        Insert: Partial<Reminder> & { senior_id: string; title: string; recurrence: ReminderRecurrence };
        Update: Partial<Reminder>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
