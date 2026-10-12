import type { Reminder } from "@/types/database";

// Same month/day matching as fetchTodaysReminders / fetchUpcomingReminders in
// supabase/functions/chat/companion/briefing.ts (a Deno copy is unavoidable),
// but evaluated against the device's local date rather than the server's.
function occursOn(r: Reminder, date: Date): boolean {
  if (r.recurrence === "daily") return true;
  if (!r.remind_on) return false;
  const [, month, day] = r.remind_on.split("-").map(Number);
  return month === date.getMonth() + 1 && day === date.getDate();
}

export function remindersForDay(reminders: Reminder[], date: Date): Reminder[] {
  return reminders.filter((r) => occursOn(r, date));
}

export interface UpcomingReminder {
  reminder: Reminder;
  when: string;
}

// The next `days - 1` days after today (today itself is shown separately).
// Daily reminders are skipped -- they'd repeat on every day and add no news.
export function upcomingReminders(reminders: Reminder[], from: Date, days = 7): UpcomingReminder[] {
  const results: UpcomingReminder[] = [];
  for (let offset = 1; offset < days; offset++) {
    const d = new Date(from);
    d.setDate(d.getDate() + offset);
    for (const r of reminders) {
      if (r.recurrence === "daily") continue;
      if (occursOn(r, d)) {
        results.push({ reminder: r, when: offset === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "long" }) });
      }
    }
  }
  return results;
}
