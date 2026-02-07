import { CACHE_TTL_SECONDS_DEFAULT, MIN_SUBSCRIBERS_DEFAULT, WINDOWS } from "@/lib/config";
import type { SearchItem, SearchResponse, SortKey, WindowKey } from "@/lib/types";
import {
  listChannelsByIds,
  listMostPopularVideos,
  listVideosByIds,
  searchVideoIdsByQuery,
  type YoutubeVideo
} from "@/lib/youtube";

const SHORTS_KEYWORDS = ["#shorts", "shorts", "ショート"];

function pickThumbnail(video: YoutubeVideo) {
  return (
    video.snippet?.thumbnails?.high?.url ??
    video.snippet?.thumbnails?.medium?.url ??
    video.snippet?.thumbnails?.default?.url ??
    ""
  );
}

export function parseIsoDurationToSeconds(iso: string) {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) {
    return 0;
  }

  const hours = Number(m[1] ?? "0");
  const minutes = Number(m[2] ?? "0");
  const seconds = Number(m[3] ?? "0");

  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeTextForShorts(title: string, description: string) {
  return `${title} ${description}`.toLowerCase();
}

function isShortsLike(input: { durationSec: number; title: string; description: string }) {
  if (input.durationSec > 180) {
    return false;
  }

  const text = normalizeTextForShorts(input.title, input.description);
  return SHORTS_KEYWORDS.some((k) => text.includes(k));
}

function isWithinWindow(publishedAt: string, nowMs: number, windowKey: WindowKey) {
  const publishedMs = Date.parse(publishedAt);
  if (!Number.isFinite(publishedMs)) {
    return false;
  }

  const hours = WINDOWS[windowKey];
  return publishedMs >= nowMs - hours * 60 * 60 * 1000;
}

function sortItems(sort: SortKey) {
  return (a: SearchItem, b: SearchItem) => {
    if (sort === "views_desc") {
      if (b.viewCount !== a.viewCount) {
        return b.viewCount - a.viewCount;
      }
      if (b.ratio !== a.ratio) {
        return b.ratio - a.ratio;
      }
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    }

    if (sort === "published_desc") {
      const dateDiff = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      if (b.ratio !== a.ratio) {
        return b.ratio - a.ratio;
      }
      return b.viewCount - a.viewCount;
    }

    if (b.ratio !== a.ratio) {
      return b.ratio - a.ratio;
    }
    if (b.viewCount !== a.viewCount) {
      return b.viewCount - a.viewCount;
    }
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  };
}

function toSearchItem(video: YoutubeVideo, subscriberCount: number): SearchItem | null {
  const id = video.id;
  const title = video.snippet?.title ?? "";
  const description = video.snippet?.description ?? "";
  const channelId = video.snippet?.channelId ?? "";
  const channelTitle = video.snippet?.channelTitle ?? "";
  const publishedAt = video.snippet?.publishedAt ?? "";
  const durationSec = parseIsoDurationToSeconds(video.contentDetails?.duration ?? "");
  const viewCount = Number(video.statistics?.viewCount ?? "0");

  if (!id || !channelId || !title || !publishedAt) {
    return null;
  }

  if (!Number.isFinite(viewCount) || viewCount < 0) {
    return null;
  }

  if (subscriberCount <= 0) {
    return null;
  }

  if (isShortsLike({ durationSec, title, description })) {
    return null;
  }

  const ratio = viewCount / subscriberCount;

  return {
    videoId: id,
    title,
    channelId,
    channelTitle,
    thumbnailUrl: pickThumbnail(video),
    publishedAt,
    durationSec,
    viewCount,
    subscriberCount,
    ratio,
    youtubeUrl: `https://www.youtube.com/watch?v=${id}`
  };
}

function getNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getRuntimeConfig() {
  const regionCode = process.env.YT_REGION ?? "JP";
  const minSubscribers = getNumberEnv("MIN_SUBSCRIBERS", MIN_SUBSCRIBERS_DEFAULT);
  const cacheTtlSeconds = getNumberEnv("CACHE_TTL_SECONDS", CACHE_TTL_SECONDS_DEFAULT);
  const youtubeApiKey = process.env.YOUTUBE_API_KEY ?? "";

  return { regionCode, minSubscribers, cacheTtlSeconds, youtubeApiKey };
}

export async function buildSearchResponse(input: {
  window: WindowKey;
  q: string;
  minViews: number;
  maxSubscribers: number | null;
  sort: SortKey;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const runtime = getRuntimeConfig();

  if (!runtime.youtubeApiKey) {
    throw new Error("Missing YOUTUBE_API_KEY");
  }

  const mode = input.q ? "query" : "explore";

  let videos: YoutubeVideo[] = [];
  if (mode === "query") {
    const publishedAfterISO = new Date(nowMs - WINDOWS[input.window] * 60 * 60 * 1000).toISOString();
    const ids = await searchVideoIdsByQuery({
      apiKey: runtime.youtubeApiKey,
      q: input.q,
      publishedAfterISO,
      regionCode: runtime.regionCode
    });
    videos = await listVideosByIds({ apiKey: runtime.youtubeApiKey, ids });
  } else {
    videos = await listMostPopularVideos({
      apiKey: runtime.youtubeApiKey,
      regionCode: runtime.regionCode
    });
  }

  const filteredByWindow = videos.filter((video) => {
    const publishedAt = video.snippet?.publishedAt;
    if (!publishedAt) {
      return false;
    }
    return isWithinWindow(publishedAt, nowMs, input.window);
  });

  const channelIds = filteredByWindow
    .map((video) => video.snippet?.channelId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const channels = await listChannelsByIds({
    apiKey: runtime.youtubeApiKey,
    ids: channelIds
  });

  const subscribersByChannelId = new Map<string, number>();
  for (const channel of channels) {
    const subscriberCount = Number(channel.statistics?.subscriberCount ?? "0");
    subscribersByChannelId.set(channel.id, Number.isFinite(subscriberCount) ? subscriberCount : 0);
  }

  const items: SearchItem[] = [];
  for (const video of filteredByWindow) {
    const channelId = video.snippet?.channelId;
    if (!channelId) {
      continue;
    }

    const subscriberCount = subscribersByChannelId.get(channelId) ?? 0;
    if (subscriberCount < runtime.minSubscribers) {
      continue;
    }
    if (input.maxSubscribers !== null && subscriberCount > input.maxSubscribers) {
      continue;
    }

    const item = toSearchItem(video, subscriberCount);
    if (item && item.viewCount >= input.minViews) {
      items.push(item);
    }
  }

  items.sort(sortItems(input.sort));

  const response: SearchResponse = {
    mode,
    window: input.window,
    q: input.q,
    minViews: input.minViews,
    maxSubscribers: input.maxSubscribers,
    sort: input.sort,
    total: items.length,
    generatedAt: new Date(nowMs).toISOString(),
    cacheHit: false,
    items
  };

  return {
    response,
    cacheTtlSeconds: runtime.cacheTtlSeconds
  };
}
