"use client";

import { FormEvent, useMemo, useState } from "react";
import type { SearchResponse, SortKey, WindowKey } from "@/lib/types";

const windows: Array<{ value: WindowKey; label: string }> = [
  { value: "24h", label: "24時間" },
  { value: "3d", label: "3日" },
  { value: "7d", label: "7日" }
];

const minViewsOptions = [
  { value: "0", label: "制限なし" },
  { value: "1000", label: "1,000以上" },
  { value: "5000", label: "5,000以上" },
  { value: "10000", label: "10,000以上" },
  { value: "50000", label: "50,000以上" },
  { value: "100000", label: "100,000以上" }
] as const;

const maxSubscribersOptions = [
  { value: "", label: "制限なし" },
  { value: "1000", label: "1,000以下" },
  { value: "10000", label: "10,000以下" },
  { value: "100000", label: "100,000以下" },
  { value: "1000000", label: "1,000,000以下" }
] as const;

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "ratio_desc", label: "ratio順（高い順）" },
  { value: "views_desc", label: "再生数順（高い順）" },
  { value: "published_desc", label: "新着順（新しい順）" }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatRatio(value: number) {
  return value.toFixed(2);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
}

export function SearchClient() {
  const [q, setQ] = useState("");
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [minViews, setMinViews] = useState("0");
  const [maxSubscribers, setMaxSubscribers] = useState("");
  const [sort, setSort] = useState<SortKey>("ratio_desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);

  const modeLabel = useMemo(() => (q.trim() ? "検索モード" : "探索モード"), [q]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ window: windowKey });
      if (q.trim()) {
        params.set("q", q.trim());
      }
      params.set("minViews", minViews);
      if (maxSubscribers) {
        params.set("maxSubscribers", maxSubscribers);
      }
      params.set("sort", sort);

      const res = await fetch(`/api/search?${params.toString()}`, {
        method: "GET",
        cache: "no-store"
      });

      const data = (await res.json()) as SearchResponse | { error?: string };
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "API request failed");
      }

      setResult(data as SearchResponse);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card panel">
        <form onSubmit={onSubmit} className="searchForm">
          <label htmlFor="q">検索ワード（任意）</label>
          <input id="q" name="q" type="text" maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} />

          <label htmlFor="window">期間</label>
          <select id="window" name="window" value={windowKey} onChange={(e) => setWindowKey(e.target.value as WindowKey)}>
            {windows.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>

          <label htmlFor="minViews">最小再生数</label>
          <select id="minViews" name="minViews" value={minViews} onChange={(e) => setMinViews(e.target.value)}>
            {minViewsOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label htmlFor="maxSubscribers">登録者上限（任意）</label>
          <select
            id="maxSubscribers"
            name="maxSubscribers"
            value={maxSubscribers}
            onChange={(e) => setMaxSubscribers(e.target.value)}
          >
            {maxSubscribersOptions.map((opt) => (
              <option key={opt.value || "none"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label htmlFor="sort">並び替え</label>
          <select id="sort" name="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="row">
            <button type="submit" disabled={loading}>
              {loading ? "検索中..." : "検索"}
            </button>
            <span className="pill">{modeLabel}</span>
          </div>
        </form>
      </section>

      <section className="card resultPanel">
        {loading && <p className="status">データを取得しています...</p>}
        {!loading && error && <p className="error">{error}</p>}
        {!loading && !error && !result && <p className="status muted">条件を指定して検索してください。</p>}

        {!loading && !error && result && (
          <>
            <div className="summary">
              <p className="summaryMain">
                {result.total}件ヒット <span className="dot">•</span> {result.window} <span className="dot">•</span>{" "}
                {result.mode === "query" ? "検索" : "探索"}
              </p>
              <p className="muted">
                最小再生数: {formatNumber(result.minViews)} / 登録者上限:{" "}
                {result.maxSubscribers === null ? "なし" : formatNumber(result.maxSubscribers)}
              </p>
              <p className="muted">並び替え: {sortOptions.find((opt) => opt.value === result.sort)?.label ?? result.sort}</p>
              <p className="muted">
                生成: {formatDate(result.generatedAt)} / キャッシュ: {result.cacheHit ? "HIT" : "MISS"}
              </p>
            </div>

            {result.items.length === 0 && <p>該当動画はありませんでした。</p>}

            <div className="results">
              {result.items.map((item) => (
                <article key={item.videoId} className="item">
                  <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" className="thumbWrap">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnailUrl} alt={item.title} className="thumb" />
                    ) : (
                      <div className="thumbFallback">No Image</div>
                    )}
                  </a>

                  <div className="itemBody">
                    <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" className="titleLink">
                      {item.title}
                    </a>
                    <p className="muted">{item.channelTitle}</p>
                    <div className="metaGrid">
                      <p className="meta">投稿日: {formatDate(item.publishedAt)}</p>
                      <p className="meta">再生: {formatNumber(item.viewCount)}</p>
                      <p className="meta">登録者: {formatNumber(item.subscriberCount)}</p>
                      <p className="meta strong">ratio: {formatRatio(item.ratio)}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
