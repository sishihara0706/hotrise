import type { SearchResponse, SortKey, WindowKey } from "@/lib/types";

type D1Like = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

type CacheRow = {
  response_json: string;
  expires_at: number;
};

const memoryCache = new Map<string, CacheRow>();

function normalizeCachedResponse(parsed: SearchResponse) {
  parsed.minViews = Number.isFinite(parsed.minViews) ? parsed.minViews : 0;
  parsed.maxSubscribers =
    parsed.maxSubscribers === null || Number.isFinite(parsed.maxSubscribers) ? parsed.maxSubscribers : null;
  parsed.sort = parsed.sort ?? "ratio_desc";
  parsed.cacheHit = true;
  return parsed;
}

function getD1Binding(): D1Like | null {
  const maybe = (globalThis as { DB?: D1Like }).DB;
  return maybe ?? null;
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildCacheKey(input: {
  mode: "query" | "explore";
  window: WindowKey;
  q: string;
  minViews: number;
  maxSubscribers: number | null;
  sort: SortKey;
}) {
  const normalizedQ = input.q.trim().toLowerCase().replace(/\s+/g, " ");
  return sha256Hex(
    `${input.mode}|${input.window}|${normalizedQ}|${input.minViews}|${input.maxSubscribers ?? "none"}|${input.sort}`
  );
}

export async function readCachedSearch(cacheKey: string, nowSec: number) {
  const db = getD1Binding();
  if (!db) {
    const row = memoryCache.get(cacheKey);
    if (!row || row.expires_at < nowSec) {
      memoryCache.delete(cacheKey);
      return null;
    }

    try {
      const parsed = JSON.parse(row.response_json) as SearchResponse;
      return normalizeCachedResponse(parsed);
    } catch {
      memoryCache.delete(cacheKey);
      return null;
    }
  }

  const row = await db
    .prepare("SELECT response_json, expires_at FROM search_cache WHERE cache_key = ?")
    .bind(cacheKey)
    .first<CacheRow>();

  if (!row || row.expires_at < nowSec) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.response_json) as SearchResponse;
    return normalizeCachedResponse(parsed);
  } catch {
    return null;
  }
}

export async function writeCachedSearch(input: {
  cacheKey: string;
  response: SearchResponse;
  nowSec: number;
  ttlSec: number;
}) {
  const db = getD1Binding();
  if (!db) {
    memoryCache.set(input.cacheKey, {
      response_json: JSON.stringify(input.response),
      expires_at: input.nowSec + input.ttlSec
    });
    return;
  }

  const expiresAt = input.nowSec + input.ttlSec;
  const json = JSON.stringify(input.response);

  await db
    .prepare(
      "INSERT OR REPLACE INTO search_cache (cache_key, response_json, expires_at, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(input.cacheKey, json, expiresAt, input.nowSec)
    .run();
}
