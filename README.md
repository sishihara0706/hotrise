# HotRise (MVP)

YouTube急上昇発掘サービスのMVP実装です。

## Tech Stack
- Next.js (App Router)
- Cloudflare Workers
- Cloudflare D1 (cache)
- YouTube Data API v3

## Implemented
- `GET /api/search` 実装
  - 検索モード: `search.list(q)` -> `videos.list` -> `channels.list`
  - 探索モード: `videos.list(chart=mostPopular, regionCode=JP)` -> 期間フィルタ
  - `subscriberCount >= 100` フィルタ
  - Shorts推定除外: `durationSec <= 180` かつキーワード一致
  - `ratio = viewCount / subscriberCount` 算出
  - ソート: `ratio DESC` -> `viewCount DESC` -> `publishedAt DESC`
- D1キャッシュ (`search_cache`)
  - キー: `mode + window + q` を正規化してSHA-256
  - TTL: デフォルト20分 (`CACHE_TTL_SECONDS=1200`)
- フロント画面
  - 検索ワード入力（任意）
  - 期間切替（24h / 3d / 7d）
  - 結果一覧（サムネ/タイトル/投稿日時/再生数/登録者数/ratio/リンク）

## Environment variables
- `YOUTUBE_API_KEY` (required)
- `YT_REGION` (default `JP`)
- `MIN_SUBSCRIBERS` (default `100`)
- `CACHE_TTL_SECONDS` (default `1200`)

## Local setup
```bash
npm install
npm run dev
```

## Validation
```bash
npm run lint
npm run typecheck
npm run build
```

## D1 setup
1. Create D1 database on Cloudflare and copy its ID.
2. Replace `database_id` in `wrangler.toml`.
3. Apply migrations:

```bash
npm run cf:d1:migrate
```

## API example
```bash
curl "http://localhost:3000/api/search?window=24h&q=AI"
curl "http://localhost:3000/api/search?window=3d"
```
