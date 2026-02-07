# Repository Guidelines

## Project Structure & Module Organization
This repository is a Next.js (App Router) web app prepared for Cloudflare Workers + D1.

- `app/`: UI routes and API route handlers.
  - `app/page.tsx`: MVP home screen.
  - `app/api/search/route.ts`: search API entry point.
- `lib/`: shared types and config constants (`types.ts`, `config.ts`).
- `migrations/`: D1 SQL migrations (`0001_init.sql`).
- Root config: `wrangler.toml`, `next.config.mjs`, `tsconfig.json`, `eslint.config.mjs`.

Add new domain logic under `lib/` and keep route handlers thin.

## Build, Test, and Development Commands
Use npm scripts from `package.json`:

- `npm install`: install dependencies.
- `npm run dev`: start local Next.js dev server.
- `npm run build`: production build.
- `npm run start`: run the built app.
- `npm run lint`: run ESLint checks.
- `npm run typecheck`: run TypeScript checks (`tsc --noEmit`).
- `npm run cf:dev`: run via Wrangler (Workers dev).
- `npm run cf:d1:migrate`: apply D1 migrations.

Example: `npm run lint && npm run typecheck` before opening a PR.

## Coding Style & Naming Conventions
- Language: TypeScript, `strict` mode enabled.
- Indentation: 2 spaces; keep lines readable and avoid deeply nested logic.
- File naming: kebab-case for route folders, camelCase for helper functions, PascalCase for React components/types where appropriate.
- Prefer explicit types for API payloads (`lib/types.ts`).
- Linting: `eslint-config-next` (`next/core-web-vitals`, `next/typescript`).

## Testing Guidelines
A formal test framework is not configured yet. For now:

- Treat `lint` + `typecheck` as required quality gates.
- For new logic, add unit/integration tests when framework is introduced (recommended: Vitest or Jest).
- Test files should follow `*.test.ts` or `*.test.tsx` naming.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so use Conventional Commits going forward:

- `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`.

PRs should include:

- Purpose and scope summary.
- Linked issue/ticket (if available).
- Validation steps and command output summary.
- UI screenshots for visual changes.

## Security & Configuration Tips
- Never expose `YOUTUBE_API_KEY` to client code.
- Keep secrets in Workers environment variables.
- Update `wrangler.toml` `database_id` before deploy.
- Validate and sanitize query inputs (`q`, `window`) at API boundaries.

## HotRise MVP Requirements Memo
This section stores the agreed product requirements for implementation.

- Goal: Discover potentially rising YouTube videos using `ratio = viewCount / subscriberCount`.
- Region: JP only (`regionCode=JP`).
- Time windows: `24h`, `3d`, `7d`.
- Subscriber threshold: `subscriberCount >= 100`.
- Max candidates: up to 50 videos per request.
- Cache TTL: 20 minutes (`1200` seconds).

### Search Modes
- Query mode (`q` provided):
  1. `search.list(q=...)` to collect video IDs.
  2. `videos.list` for `viewCount`, `duration`, `publishedAt`.
  3. `channels.list` for `subscriberCount`.
  4. Filter by subscriber threshold, shorts exclusion, then sort by ratio.
- Explore mode (`q` empty):
  1. `videos.list(chart=mostPopular, regionCode=JP, maxResults=50)`.
  2. Keep only videos in selected window (`24h/3d/7d`).
  3. `channels.list` for subscriber count.
  4. Filter and sort by ratio.

### Shorts Exclusion (MVP heuristic)
Exclude videos only when both conditions are true:
- `durationSec <= 180`
- title or description includes one of: `#shorts`, `shorts`, `ショート`

### API Contract (MVP)
- Endpoint: `GET /api/search`
- Query:
  - `window` required: `24h|3d|7d`
  - `q` optional string (empty means explore mode)
- Errors:
  - `400` invalid window
  - `502` YouTube API failure
  - `200` with empty `items` is valid (no results)

### D1 Cache Schema
Table: `search_cache`
- `cache_key` TEXT PRIMARY KEY
- `response_json` TEXT NOT NULL
- `expires_at` INTEGER NOT NULL
- `created_at` INTEGER NOT NULL

Sorting priority: `ratio DESC`, then `viewCount DESC`, then `publishedAt DESC`.
