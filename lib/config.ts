import type { WindowKey } from "@/lib/types";

export const WINDOWS: Record<WindowKey, number> = {
  "24h": 24,
  "3d": 72,
  "7d": 168
};

export const MAX_RESULTS = 50;
export const MIN_SUBSCRIBERS_DEFAULT = 100;
export const CACHE_TTL_SECONDS_DEFAULT = 20 * 60;
