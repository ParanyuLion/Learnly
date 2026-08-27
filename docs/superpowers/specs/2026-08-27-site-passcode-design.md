# Site-wide Passcode Gate — Design

## Purpose
The app (Learnly) is now deployed to a public Vercel URL. Originally the
project deliberately chose no auth / fully public access (see
`docs/superpowers/specs/2026-08-26-matching-game-design.md`), on the
assumption the URL wouldn't be shared. Now that it's actually deployed and
discoverable, the user wants to gate the whole site behind a single shared
passcode so a random visitor with the URL can't create, edit, or delete
their study sets.

This supersedes the earlier "no auth" decision for the deployed app, but
keeps the spirit of it: still no user accounts, no per-user data, no
login/signup flow — just one shared secret that gates the entire site for
this single-user tool.

## Constraints & Decisions
- Single shared passcode for the whole site (not per-user accounts) —
  confirmed with user.
- Applies to every route: all three game types' pages and API routes, and
  the home page. No route is left open.
- No rate-limiting or lockout on repeated wrong attempts — out of scope
  for a personal tool with a low-value target (YAGNI).
- No password-reset flow — the passcode lives in an env var; if forgotten,
  check Vercel's environment variables.
- Fails closed: if the required env vars aren't configured, the site
  blocks all access rather than allowing it through.
- No new npm dependencies — cookie signing uses the Web Crypto API
  (`crypto.subtle`), which is available natively in both the Node.js
  runtime (API routes) and the Edge runtime (Next.js middleware, which on
  this project's Next.js 14.2 only supports Edge, not Node.js middleware).

## Architecture
A Next.js `middleware.ts` at the project root runs before every request
(except an explicit allowlist) and checks for a valid signed session
cookie. Missing/invalid cookie → page requests redirect to `/login`; API
requests get `401`. A `/login` page collects the passcode, posts it to
`/api/login`, which checks it against the `SITE_PASSCODE` env var and, on
success, sets an httpOnly cookie signed with a separate `SESSION_SECRET`
env var (so the cookie value never reveals the passcode itself, and
rotating one doesn't require rotating the other).

## Data Model
None — no new database tables. This is entirely env-var + cookie based,
consistent with "no user accounts."

## Pure Logic Module
`lib/auth.ts` — the signing/verification logic, kept pure and dependency-free
so both the middleware (Edge runtime) and the login API route (Node.js
runtime) can share it without duplication:
```typescript
export async function signSession(secret: string): Promise<string>;
// Returns a deterministic HMAC-SHA256 hex digest of a fixed marker string,
// keyed by `secret`. Same secret always produces the same session token
// (no per-login randomness needed, since there's only one passcode and
// one "authenticated" state to represent).

export async function verifySession(token: string, secret: string): Promise<boolean>;
// Recomputes the expected token from `secret` and compares against `token`.
```

## Routes / Files
1. `middleware.ts` (project root, NOT inside `app/`) — the gate. Matcher
   excludes `/login`, `/api/login`, and Next.js static asset paths;
   everything else requires a valid session cookie.
2. `app/login/page.tsx` — a simple form (passcode input + submit button),
   styled with the existing design system (`.page`, `.text-input`,
   `.btn-primary`, `.error-banner`). Posts to `/api/login`; on success,
   redirects to `/` (or a `?from=` query param if present, so a visitor
   who hit a deep link and got bounced to login lands back where they were
   headed).
3. `app/api/login/route.ts` — `POST { passcode: string }` → compares
   against `process.env.SITE_PASSCODE`; on match, sets the signed session
   cookie (httpOnly, `secure` in production, `sameSite: "lax"`, 30-day
   `maxAge`) and returns `200`; on mismatch, returns `401`.
4. `app/api/logout/route.ts` — clears the session cookie, returns `200`.
5. `app/page.tsx` (existing home page) gets a small "ออกจากระบบ" link in
   the header that POSTs to `/api/logout` then reloads/redirects to
   `/login`.

## Environment Variables
- `SITE_PASSCODE` — the passcode the user types in. Must be set for any
  access to work (fail-closed).
- `SESSION_SECRET` — a random string used only to sign the session cookie.
  Must also be set (fail-closed). Rotating this value invalidates all
  existing sessions (forces re-login) without needing to change the
  passcode itself.

Both go in `.env.example` (with placeholder values and a comment to
generate real ones before deploying) and must be set as Vercel environment
variables for the production deploy to work.

## Error Handling
- Missing env vars: middleware treats this as "nobody is authenticated" —
  every request (except the allowlist) is blocked, page requests
  redirected to `/login`, which itself will show a clear error if
  `SITE_PASSCODE` isn't configured (rather than silently accepting any
  input).
- Wrong passcode: `/api/login` returns `401`; the login page shows an
  inline error message (reusing `.error-banner`).
- No lockout/backoff on repeated failures (explicitly out of scope, see
  Constraints).

## Testing
- Unit tests for `lib/auth.ts`: `signSession`/`verifySession` round-trip
  (same secret verifies, different secret does not verify, tampered token
  does not verify).
- Manual verification: confirm an unauthenticated request to `/` and to an
  API route (e.g. `/api/sets`) both get blocked (redirect / 401), confirm
  the correct passcode grants access and sets a cookie that persists
  across requests, confirm logout clears access.

## Out of Scope
- Rate-limiting / brute-force protection on login attempts.
- Per-user accounts, multi-tenancy, or any data scoping by user.
- Password-reset / passcode-recovery flow.
- Any change to the three existing game types' own logic, data, or API
  contracts — this feature only wraps access to them, it doesn't touch
  `lib/matching-game.ts`, `lib/sort-game.ts`, `lib/flashcard-game.ts`, or
  any of their routes' internal behavior.
