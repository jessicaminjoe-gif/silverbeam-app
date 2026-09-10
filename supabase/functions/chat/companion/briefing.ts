// Content-gathering for the daily briefing (chat/index.ts's briefing
// branch). Each fetcher is independent and best-effort — a failure in one
// (weather API down, no zip set, etc.) shouldn't block the others or the
// greeting itself; callers should treat a null/empty result as "just skip
// this part," never as a hard error.

export function getTimeOfDay(date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Free, keyless chain: zip -> lat/lon (Zippopotam.us) -> NWS forecast
// office/grid (api.weather.gov) -> today's forecast text. NWS requires an
// identifying User-Agent (not a real API key, just a courtesy/policy
// requirement) or it rejects the request.
const NWS_USER_AGENT = "SilverBeamCompanionApp (beta, no contact email on file yet)";

export async function fetchWeather(zip: string | null): Promise<string | null> {
  if (!zip) return null;
  try {
    const geoRes = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
    if (!geoRes.ok) return null;
    const geo = (await geoRes.json()) as { places?: { latitude: string; longitude: string }[] };
    const place = geo.places?.[0];
    if (!place) return null;

    const pointsRes = await fetch(`https://api.weather.gov/points/${place.latitude},${place.longitude}`, {
      headers: { "User-Agent": NWS_USER_AGENT },
    });
    if (!pointsRes.ok) return null;
    const points = (await pointsRes.json()) as { properties?: { forecast?: string } };
    const forecastUrl = points.properties?.forecast;
    if (!forecastUrl) return null;

    const forecastRes = await fetch(forecastUrl, { headers: { "User-Agent": NWS_USER_AGENT } });
    if (!forecastRes.ok) return null;
    const forecast = (await forecastRes.json()) as {
      properties?: { periods?: { name: string; detailedForecast: string }[] };
    };
    const today = forecast.properties?.periods?.[0];
    return today ? `${today.name}: ${today.detailedForecast}` : null;
  } catch (err) {
    console.error("[briefing] fetchWeather failed:", err);
    return null;
  }
}

// NPR's public top-stories RSS feed — free, no key, no account. Simple
// regex extraction rather than a full XML parser since RSS <item>/<title>
// structure is predictable and a parser dependency isn't worth it for
// three headlines.
const NEWS_RSS_URL = "https://feeds.npr.org/1001/rss.xml";

export async function fetchNewsHeadlines(limit = 3): Promise<string[]> {
  try {
    const res = await fetch(NEWS_RSS_URL);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const headlines: string[] = [];
    for (const item of items) {
      const match = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
      if (match?.[1]) headlines.push(match[1].trim());
      if (headlines.length >= limit) break;
    }
    return headlines;
  } catch (err) {
    console.error("[briefing] fetchNewsHeadlines failed:", err);
    return [];
  }
}

// Wikipedia's public "on this day" feed -- free, keyless, just wants a
// descriptive User-Agent per Wikimedia's API etiquette policy (same
// courtesy-header requirement as NWS above). "selected" is Wikipedia's own
// curated/notable subset for the day, which reads better for a glance-tile
// than the full (much longer, much more obscure) "events" list.
const WIKIPEDIA_USER_AGENT = "SilverBeamCompanionApp/1.0 (beta, no contact email on file yet)";

export async function fetchOnThisDayFacts(count = 3, date = new Date()): Promise<string[]> {
  try {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${month}/${day}`, {
      headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { selected?: { text: string; year?: number }[] };
    const events = data.selected ?? [];
    if (!events.length) return [];
    // Shuffles rather than always taking the first N (which tends to skew
    // toward the most ancient/least relatable entries) -- fine for a tile
    // that's checked once in a while, not something compared call-to-call.
    const shuffled = [...events].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((e) => (e.year ? `In ${e.year}, ${e.text}` : e.text));
  } catch (err) {
    console.error("[briefing] fetchOnThisDayFacts failed:", err);
    return [];
  }
}

interface ReminderRow {
  title: string;
  recurrence: "yearly" | "daily" | "once";
  remind_on: string | null;
}

// userClient (RLS-scoped, not service role) is intentional -- the senior
// reading their own reminders is exactly what reminders_select_senior
// already allows.
export async function fetchTodaysReminders(
  userClient: { from: (table: string) => any },
  seniorId: string
): Promise<string[]> {
  try {
    const { data } = await userClient.from("reminders").select("title, recurrence, remind_on").eq("senior_id", seniorId);
    const rows = (data as ReminderRow[]) ?? [];
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    return rows
      .filter((r) => {
        if (r.recurrence === "daily") return true;
        if (!r.remind_on) return false;
        const [, remindMonth, remindDay] = r.remind_on.split("-").map(Number);
        if (r.recurrence === "yearly") return remindMonth === month && remindDay === day;
        // 'once': exact calendar date match, any year (remind_on carries the
        // real year, but comparing month/day here keeps this in local time
        // rather than fighting UTC-vs-local date parsing edge cases).
        return remindMonth === month && remindDay === day;
      })
      .map((r) => r.title);
  } catch (err) {
    console.error("[briefing] fetchTodaysReminders failed:", err);
    return [];
  }
}

// Same month/day matching as fetchTodaysReminders, but checked against each
// of the next `days` calendar days (today included) instead of just today --
// used by Chat's "My Reminders" quick prompt, which is explicitly about
// what's coming up this week, not just today.
export async function fetchUpcomingReminders(
  userClient: { from: (table: string) => any },
  seniorId: string,
  days = 7
): Promise<string[]> {
  try {
    const { data } = await userClient.from("reminders").select("title, recurrence, remind_on").eq("senior_id", seniorId);
    const rows = (data as ReminderRow[]) ?? [];
    const now = new Date();
    const results: string[] = [];

    for (const r of rows) {
      if (r.recurrence === "daily") {
        results.push(`${r.title} (every day)`);
        continue;
      }
      if (!r.remind_on) continue;
      const [, remindMonth, remindDay] = r.remind_on.split("-").map(Number);
      for (let offset = 0; offset < days; offset++) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        if (d.getMonth() + 1 === remindMonth && d.getDate() === remindDay) {
          const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : d.toLocaleDateString("en-US", { weekday: "long" });
          results.push(`${r.title} (${when})`);
          break;
        }
      }
    }

    return results;
  } catch (err) {
    console.error("[briefing] fetchUpcomingReminders failed:", err);
    return [];
  }
}
