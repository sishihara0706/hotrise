import { NextRequest, NextResponse } from "next/server";
import type { SearchResponse, SortKey, WindowKey } from "@/lib/types";
import { buildCacheKey, readCachedSearch, writeCachedSearch } from "@/lib/cache";
import { buildSearchResponse } from "@/lib/search-logic";

const VALID_WINDOWS = new Set<WindowKey>(["24h", "3d", "7d"]);
const VALID_SORTS = new Set<SortKey>(["ratio_desc", "views_desc", "published_desc"]);
const MAX_QUERY_LENGTH = 100;
const MAX_ABS_NUMBER = 10_000_000_000;

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const window = searchParams.get("window") as WindowKey | null;
  const q = (searchParams.get("q") ?? "").trim();
  const minViewsRaw = (searchParams.get("minViews") ?? "0").trim();
  const maxSubscribersRaw = (searchParams.get("maxSubscribers") ?? "").trim();
  const sort = ((searchParams.get("sort") ?? "ratio_desc").trim() || "ratio_desc") as SortKey;

  if (!window || !VALID_WINDOWS.has(window)) {
    return NextResponse.json({ error: "window must be one of: 24h, 3d, 7d" }, { status: 400 });
  }

  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "q must be 100 chars or less" }, { status: 400 });
  }
  if (!VALID_SORTS.has(sort)) {
    return NextResponse.json({ error: "sort must be one of: ratio_desc, views_desc, published_desc" }, { status: 400 });
  }

  const minViews = Number(minViewsRaw);
  if (!Number.isInteger(minViews) || minViews < 0 || minViews > MAX_ABS_NUMBER) {
    return NextResponse.json({ error: "minViews must be a non-negative integer" }, { status: 400 });
  }

  let maxSubscribers: number | null = null;
  if (maxSubscribersRaw.length > 0) {
    const parsed = Number(maxSubscribersRaw);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_ABS_NUMBER) {
      return NextResponse.json({ error: "maxSubscribers must be a non-negative integer" }, { status: 400 });
    }
    maxSubscribers = parsed;
  }

  const mode = q ? "query" : "explore";
  const nowSec = Math.floor(Date.now() / 1000);
  const cacheKey = await buildCacheKey({ mode, window, q, minViews, maxSubscribers, sort });

  try {
    const cached = await readCachedSearch(cacheKey, nowSec);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const { response, cacheTtlSeconds } = await buildSearchResponse({ window, q, minViews, maxSubscribers, sort });
    await writeCachedSearch({
      cacheKey,
      response,
      nowSec,
      ttlSec: cacheTtlSeconds
    });

    const payload: SearchResponse = { ...response, cacheHit: false };
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Search API failed", error);
    return NextResponse.json({ error: "Failed to fetch YouTube data" }, { status: 502 });
  }
}
