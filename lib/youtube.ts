import { MAX_RESULTS } from "@/lib/config";

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";

export type YoutubeVideo = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  contentDetails?: {
    duration?: string;
  };
  statistics?: {
    viewCount?: string;
  };
};

export type YoutubeChannel = {
  id: string;
  statistics?: {
    subscriberCount?: string;
  };
};

type YoutubeSearchItem = {
  id?: {
    videoId?: string;
  };
};

type YoutubeApiResponse<T> = {
  items?: T[];
};

function toQuery(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return query.toString();
}

async function youtubeGet<T>(apiKey: string, path: string, params: Record<string, string>) {
  const url = `${YOUTUBE_BASE}${path}?${toQuery({ ...params, key: apiKey })}`;
  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API failed: ${res.status} ${text}`);
  }

  return (await res.json()) as YoutubeApiResponse<T>;
}

export async function searchVideoIdsByQuery(input: {
  apiKey: string;
  q: string;
  publishedAfterISO: string;
  regionCode: string;
}) {
  const json = await youtubeGet<YoutubeSearchItem>(input.apiKey, "/search", {
    part: "snippet",
    q: input.q,
    type: "video",
    order: "date",
    maxResults: String(MAX_RESULTS),
    publishedAfter: input.publishedAfterISO,
    regionCode: input.regionCode
  });

  return (json.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function listMostPopularVideos(input: {
  apiKey: string;
  regionCode: string;
}) {
  const json = await youtubeGet<YoutubeVideo>(input.apiKey, "/videos", {
    part: "snippet,contentDetails,statistics",
    chart: "mostPopular",
    regionCode: input.regionCode,
    maxResults: String(MAX_RESULTS)
  });

  return json.items ?? [];
}

export async function listVideosByIds(input: {
  apiKey: string;
  ids: string[];
}) {
  if (input.ids.length === 0) {
    return [] as YoutubeVideo[];
  }

  const json = await youtubeGet<YoutubeVideo>(input.apiKey, "/videos", {
    part: "snippet,contentDetails,statistics",
    id: input.ids.join(","),
    maxResults: String(MAX_RESULTS)
  });

  return json.items ?? [];
}

export async function listChannelsByIds(input: {
  apiKey: string;
  ids: string[];
}) {
  if (input.ids.length === 0) {
    return [] as YoutubeChannel[];
  }

  const uniqueIds = Array.from(new Set(input.ids));

  const json = await youtubeGet<YoutubeChannel>(input.apiKey, "/channels", {
    part: "statistics",
    id: uniqueIds.join(","),
    maxResults: String(MAX_RESULTS)
  });

  return json.items ?? [];
}
