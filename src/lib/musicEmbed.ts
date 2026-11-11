export type MusicService = "youtube" | "spotify" | "apple";

export interface MusicEmbed {
  service: MusicService;
  embedUrl: string;
}

// Hosts the in-app player is allowed to navigate to. Anything else (an ad
// click, a redirect) is blocked so the senior can't wander off.
export const ALLOWED_PLAYER_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "google.com",
  "gstatic.com",
  "googlevideo.com",
  "ytimg.com",
  "spotify.com",
  "scdn.co",
  "apple.com",
  "mzstatic.com",
];

export function isAllowedPlayerHost(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_PLAYER_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

// Parsed by hand (no URL class) so it behaves identically on Hermes, web and
// node, and is easy to test.
function parse(rawUrl: string): { host: string; path: string; query: Record<string, string> } | null {
  const m = /^https?:\/\/([^/?#:]+)(?::\d+)?([^?#]*)(?:\?([^#]*))?/i.exec(rawUrl.trim());
  if (!m) return null;
  const query: Record<string, string> = {};
  for (const pair of (m[3] ?? "").split("&")) {
    if (!pair) continue;
    const [k, v = ""] = pair.split("=");
    try {
      query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      /* ignore malformed pair */
    }
  }
  return { host: m[1].toLowerCase(), path: m[2] || "/", query };
}

const YT_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST_ID = /^[A-Za-z0-9_-]{10,}$/;
const YT_PLAYER_PARAMS = "autoplay=1&playsinline=1&rel=0";

function youtubeEmbed(host: string, path: string, query: Record<string, string>): MusicEmbed | null {
  let id: string | undefined;
  const list = query.list && YT_LIST_ID.test(query.list) ? query.list : undefined;

  if (host === "youtu.be") {
    id = path.split("/")[1];
  } else if (path === "/watch") {
    id = query.v;
  } else {
    const m = /^\/(?:embed|shorts|live|v)\/([^/]+)/.exec(path);
    if (m) id = m[1];
  }
  if (id && !YT_VIDEO_ID.test(id)) id = undefined;

  if (id && list) return { service: "youtube", embedUrl: `https://www.youtube.com/embed/${id}?list=${list}&${YT_PLAYER_PARAMS}` };
  if (id) return { service: "youtube", embedUrl: `https://www.youtube.com/embed/${id}?${YT_PLAYER_PARAMS}` };
  if (list && (path === "/playlist" || path === "/watch")) {
    return { service: "youtube", embedUrl: `https://www.youtube.com/embed/videoseries?list=${list}&${YT_PLAYER_PARAMS}` };
  }
  return null;
}

function spotifyEmbed(path: string): MusicEmbed | null {
  const m = /^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,})\/?$/.exec(path);
  if (!m) return null;
  return { service: "spotify", embedUrl: `https://open.spotify.com/embed/${m[1]}/${m[2]}` };
}

function appleEmbed(path: string, query: Record<string, string>): MusicEmbed | null {
  if (!/^\/[a-z]{2}\/(album|playlist|song|station)\/[^/]+/i.test(path)) return null;
  const i = query.i && /^\d+$/.test(query.i) ? `?i=${query.i}` : "";
  return { service: "apple", embedUrl: `https://embed.music.apple.com${path}${i}` };
}

// Spotify's mobile "Share" button produces short links (spotify.link/Xyz)
// that carry no track id. They aren't HTTP redirects: the page they land on
// (spotify.app.link) is a small HTML page whose body contains the real
// open.spotify.com link. Requested with a phone User-Agent they bounce to an
// "open the app" flow instead, so we ask as a desktop browser.
const SPOTIFY_SHORT_HOSTS = ["spotify.link", "spotify.app.link"];
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SPOTIFY_OPEN_LINK = /open\.spotify\.com\/((?:intl-[a-z-]+\/)?(?:track|album|playlist|artist|episode|show)\/[A-Za-z0-9]{10,})/;

export function isSpotifyShortLink(rawUrl: string): boolean {
  const p = parse(rawUrl);
  return !!p && SPOTIFY_SHORT_HOSTS.includes(p.host) && p.path.length > 1;
}

// Pulls the first open.spotify.com track/album/playlist/... link out of a
// short-link page's HTML (plain, or with the slashes escaped/encoded).
export function extractSpotifyUrl(html: string): string | null {
  const normalised = html.replace(/\\u002F|\\\//gi, "/").replace(/%2F/gi, "/");
  const m = SPOTIFY_OPEN_LINK.exec(normalised);
  return m ? `https://open.spotify.com/${m[1]}` : null;
}

// Resolves a spotify.link short link to its full open.spotify.com URL, or
// null if it can't be (offline, expired link, Spotify changed the page, or on
// web where the browser blocks the cross-site request).
export async function resolveSpotifyShortLink(rawUrl: string, timeoutMs = 8000): Promise<string | null> {
  if (!isSpotifyShortLink(rawUrl)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rawUrl.trim(), { headers: { "User-Agent": DESKTOP_USER_AGENT }, signal: controller.signal });
    // Some links do redirect all the way; otherwise read it from the page.
    const landed = extractSpotifyUrl(res.url ?? "");
    if (landed) return landed;
    return extractSpotifyUrl(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Turns a link a family member pasted (Spotify, YouTube, Apple Music) into
// the service's official embeddable-player URL, or null if it isn't one we
// can play inside the app.
export function getEmbed(rawUrl: string): MusicEmbed | null {
  const p = parse(rawUrl);
  if (!p) return null;
  const { host, path, query } = p;

  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
    return youtubeEmbed(host, path, query);
  }
  if (host === "open.spotify.com") return spotifyEmbed(path);
  if (host === "music.apple.com" || host === "embed.music.apple.com") return appleEmbed(path, query);
  return null;
}
