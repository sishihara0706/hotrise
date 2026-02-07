"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

  function resetForm() {
    setQ("");
    setWindowKey("24h");
    setMinViews("0");
    setMaxSubscribers("");
    setSort("ratio_desc");
    setResult(null);
    setError("");
  }

  // キーボードショートカット
  useEffect(() => {
    function handleKeyboard(e: KeyboardEvent) {
      // Cmd/Ctrl + K: 検索フォームにフォーカス
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("q")?.focus();
      }

      // Cmd/Ctrl + Enter: 検索実行
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        document.querySelector<HTMLFormElement>(".searchForm")?.requestSubmit();
      }

      // Esc: フォームリセット
      if (e.key === "Escape" && !loading) {
        resetForm();
      }
    }

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [loading]);

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
      <section className="card panel" role="search" aria-label="動画検索フォーム">
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
            <button type="submit" disabled={loading} aria-disabled={loading} aria-busy={loading}>
              {loading ? "検索中..." : "検索"}
            </button>
            <button type="button" className="buttonSecondary" onClick={resetForm} disabled={loading}>
              リセット
            </button>
            <span className="pill">{modeLabel}</span>
          </div>
        </form>

        <div className="keyboardHints">
          <span>
            <kbd>⌘K</kbd> フォーカス
          </span>
          <span>
            <kbd>⌘Enter</kbd> 検索
          </span>
          <span>
            <kbd>Esc</kbd> リセット
          </span>
        </div>
      </section>

      <section className="card resultPanel">
        {loading && (
          <div className="loadingState" role="status" aria-live="polite" aria-busy="true">
            <div className="spinner" aria-hidden="true"></div>
            <p className="loadingText">データを取得しています...</p>
            <div className="skeletonGrid">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeletonItem">
                  <div className="skeletonThumb"></div>
                  <div className="skeletonBody">
                    <div className="skeletonLine skeletonTitle"></div>
                    <div className="skeletonLine skeletonMeta"></div>
                    <div className="skeletonLine skeletonMeta short"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="errorState" role="alert" aria-live="assertive">
            <div className="errorIcon" aria-hidden="true">
              ⚠️
            </div>
            <p className="errorTitle">エラーが発生しました</p>
            <p className="errorMessage">{error}</p>
            <button type="button" className="buttonSecondary" onClick={() => setError("")}>
              閉じる
            </button>
          </div>
        )}
        {!loading && !error && !result && <p className="status muted">条件を指定して検索してください。</p>}

        {!loading && !error && result && (
          <>
            <div className="summary" role="region" aria-label="検索結果サマリー">
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

            {result.items.length === 0 && (
              <div className="emptyState">
                <p className="emptyStateTitle">該当動画はありませんでした</p>
                <p className="emptyStateDesc">検索条件を変更してお試しください。</p>
                <ul className="emptyStateTips">
                  <li>検索ワードを変更する</li>
                  <li>期間を広げる（3日 → 7日）</li>
                  <li>最小再生数を下げる</li>
                </ul>
              </div>
            )}

            <div className="results">
              {result.items.map((item) => (
                <article key={item.videoId} className="item" aria-labelledby={`title-${item.videoId}`}>
                  <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" className="thumbWrap">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnailUrl} alt={item.title} className="thumb" />
                    ) : (
                      <div className="thumbFallback">No Image</div>
                    )}
                  </a>

                  <div className="itemBody">
                    <a
                      href={item.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="titleLink"
                      id={`title-${item.videoId}`}
                      aria-label={`${item.title} - ${item.channelTitle}の動画を開く`}
                    >
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
