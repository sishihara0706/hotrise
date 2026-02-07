export type WindowKey = "24h" | "3d" | "7d";
export type SortKey = "ratio_desc" | "views_desc" | "published_desc";

export type SearchMode = "query" | "explore";

export type SearchItem = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSec: number;
  viewCount: number;
  subscriberCount: number;
  ratio: number;
  youtubeUrl: string;
};

export type SearchResponse = {
  mode: SearchMode;
  window: WindowKey;
  q: string;
  minViews: number;
  maxSubscribers: number | null;
  sort: SortKey;
  total: number;
  generatedAt: string;
  cacheHit: boolean;
  items: SearchItem[];
};
