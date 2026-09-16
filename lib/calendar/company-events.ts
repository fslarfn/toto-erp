import { supabase } from "@/lib/supabase-client";

export type CompanyEventCategory =
  | "libur_perusahaan"
  | "thr_payroll"
  | "gathering"
  | "maintenance"
  | "rapat"
  | "deadline"
  | "operasional_lain";

export type CompanyEventStatus = "rencana" | "dikonfirmasi" | "dibatalkan";

export type CompanyCalendarEvent = {
  id: string;
  workspace: "toto";
  title: string;
  description: string;
  category: CompanyEventCategory;
  status: CompanyEventStatus;
  start_date: string;
  end_date: string;
  audience: string;
  created_by_username: string;
  updated_by_username: string;
  created_at?: string;
  updated_at?: string;
};

export type CompanyCalendarEventInput = Pick<
  CompanyCalendarEvent,
  "title" | "description" | "category" | "status" | "start_date" | "end_date" | "audience"
>;

export type CalendarStorageMode = "supabase" | "preview";

const PREVIEW_KEY = "toto_calendar_preview_events_v1";

function isMissingCalendarSchema(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "42P01"
    || value?.code === "PGRST205"
    || value?.message?.toLowerCase().includes("schema cache") === true
    || value?.message?.toLowerCase().includes("company_calendar_events") === true;
}

function readPreviewEvents(): CompanyCalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY) || "[]") as CompanyCalendarEvent[];
  } catch {
    return [];
  }
}

function writePreviewEvents(events: CompanyCalendarEvent[]) {
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(events));
}

function overlapsYear(event: CompanyCalendarEvent, year: number) {
  return event.start_date <= `${year}-12-31` && event.end_date >= `${year}-01-01`;
}

export async function loadCompanyCalendarEvents(year: number): Promise<{
  events: CompanyCalendarEvent[];
  mode: CalendarStorageMode;
}> {
  const { data, error } = await supabase
    .from("company_calendar_events")
    .select("*")
    .eq("workspace", "toto")
    .lte("start_date", `${year}-12-31`)
    .gte("end_date", `${year}-01-01`)
    .order("start_date", { ascending: true });

  if (!error) {
    return { events: (data ?? []) as CompanyCalendarEvent[], mode: "supabase" };
  }
  if (isMissingCalendarSchema(error)) {
    return { events: readPreviewEvents().filter((event) => overlapsYear(event, year)), mode: "preview" };
  }
  throw error;
}

export async function saveCompanyCalendarEvent(
  input: CompanyCalendarEventInput,
  actor: { username: string },
  mode: CalendarStorageMode,
  id?: string,
) {
  if (mode === "preview") {
    const events = readPreviewEvents();
    const now = new Date().toISOString();
    if (id) {
      const index = events.findIndex((event) => event.id === id);
      if (index < 0) throw new Error("Agenda pratinjau tidak ditemukan.");
      events[index] = {
        ...events[index],
        ...input,
        updated_by_username: actor.username,
        updated_at: now,
      };
      writePreviewEvents(events);
      return events[index];
    }
    const created: CompanyCalendarEvent = {
      id: crypto.randomUUID(),
      workspace: "toto",
      ...input,
      created_by_username: actor.username,
      updated_by_username: actor.username,
      created_at: now,
      updated_at: now,
    };
    writePreviewEvents([...events, created]);
    return created;
  }

  const payload = {
    workspace: "toto" as const,
    ...input,
    updated_by_username: actor.username,
    ...(id ? {} : { created_by_username: actor.username }),
  };
  const query = id
    ? supabase.from("company_calendar_events").update(payload).eq("id", id)
    : supabase.from("company_calendar_events").insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as CompanyCalendarEvent;
}

export async function deleteCompanyCalendarEvent(id: string, mode: CalendarStorageMode) {
  if (mode === "preview") {
    writePreviewEvents(readPreviewEvents().filter((event) => event.id !== id));
    return;
  }
  const { error } = await supabase.from("company_calendar_events").delete().eq("id", id);
  if (error) throw error;
}
