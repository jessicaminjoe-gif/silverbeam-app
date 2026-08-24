import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Reminder, ReminderRecurrence } from "@/types/database";

export function useReminders(seniorId: string | undefined) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seniorId) return;
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("senior_id", seniorId)
      .order("created_at", { ascending: true });
    setReminders((data as Reminder[] | null) ?? []);
    setLoading(false);
  }, [seniorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addReminder(input: { title: string; recurrence: ReminderRecurrence; remind_on: string | null }) {
    if (!seniorId) return { error: "No senior selected" };
    const { error } = await supabase.from("reminders").insert({ senior_id: seniorId, ...input });
    if (!error) await load();
    return { error: error?.message ?? null };
  }

  async function removeReminder(id: string) {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (!error) setReminders((prev) => prev.filter((r) => r.id !== id));
    return { error: error?.message ?? null };
  }

  return { reminders, loading, reload: load, addReminder, removeReminder };
}
