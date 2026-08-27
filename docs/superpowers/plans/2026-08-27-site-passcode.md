# Site-wide Passcode Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the entire deployed app (all three game types' pages and API
routes, plus the home page) behind a single shared passcode, so a random
visitor with the public URL can't create, edit, or delete study sets.

**Architecture:** A Next.js `middleware.ts` at the project root checks every
request for a signed session cookie before it reaches any page or API
route. A `/login` page + `/api/login` route issue that cookie after
checking a passcode against an env var. Cookie signing uses the Web Crypto
API (`crypto.subtle`), available natively in both the Node.js runtime (API
routes) and the Edge runtime (Next.js middleware) — no new dependency.

**Tech Stack:** Same as the existing app — Next.js 14 (App Router,
TypeScript), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-27-site-passcode-design.md`

## Global Constraints

- Single shared passcode for the whole site — no per-user accounts.
- Every route is gated: all three game types' pages/APIs and the home
  page. Only `/login`, `/api/login`, and Next.js static asset paths are
  exempt.
- No rate-limiting or lockout on wrong passcode attempts (explicitly out
  of scope).
- No password-reset flow.
- Fails closed: if `SITE_PASSCODE` or `SESSION_SECRET` env vars are unset,
  the site blocks all access rather than allowing it through.
- No new npm dependencies — use `crypto.subtle` (Web Crypto API), not
  Node's `crypto` module (which isn't available in the Edge runtime that
  Next.js 14.2 middleware requires) and not a JWT/session library.
- This plan must not modify `lib/matching-game.ts`, `lib/sort-game.ts`,
  `lib/flashcard-game.ts`, or any of their existing routes' internal
  behavior — it only wraps access to the whole app.

---

### Task 1: Session signing/verification module

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/auth.test.ts`

**Interfaces:**
- Consumes: nothing (pure module, only the global `crypto.subtle` Web
  Crypto API — no Prisma, no Next.js, no other lib module).
- Produces:
  - `signSession(secret: string): Promise<string>` — used by the login
    route (Task 2) to create a session token.
  - `verifySession(token: string, secret: string): Promise<boolean>` —
    used by the middleware (Task 3) to check a session cookie.

- [ ] **Step 1: Write the failing test**

`lib/auth.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./auth";

describe("signSession / verifySession", () => {
  it("verifies a token signed with the same secret", async () => {
    const token = await signSession("secret-a");
    expect(await verifySession(token, "secret-a")).toBe(true);
  });

  it("rejects a token verified against a different secret", async () => {
    const token = await signSession("secret-a");
    expect(await verifySession(token, "secret-b")).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await signSession("secret-a");
    const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(await verifySession(tampered, "secret-a")).toBe(false);
  });

  it("produces a deterministic token for the same secret", async () => {
    const a = await signSession("secret-a");
    const b = await signSession("secret-a");
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL with "Cannot find module './auth'"

- [ ] **Step 3: Write minimal implementation**

`lib/auth.ts`:
```typescript
const SESSION_MARKER = "authenticated";

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signSession(secret: string): Promise<string> {
  return hmac(secret, SESSION_MARKER);
}

export async function verifySession(token: string, secret: string): Promise<boolean> {
  const expected = await hmac(secret, SESSION_MARKER);
  return token === expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: add session signing/verification module for passcode gate"
```

---

### Task 2: Login page and API route

**Files:**
- Create: `app/api/login/route.ts`
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `signSession` from `lib/auth.ts` (Task 1); `fetchJson` from
  `lib/fetch-json.ts`; global classes from `app/globals.css` (`.page`,
  `.page-header`, `.page-title`, `.text-input`, `.btn`, `.btn-primary`,
  `.error-banner`).
- Produces: `POST /api/login` with body `{ passcode: string }` →
  `200 { ok: true }` and sets a `session` cookie on success, `401
  { error: string }` on wrong passcode, `500 { error: string }` if the
  server isn't configured (missing env vars). This cookie is consumed by
  the middleware in Task 3 — cookie name is exactly `session`.

- [ ] **Step 1: Implement the login API route**

`app/api/login/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { signSession } from "@/lib/auth";

const COOKIE_NAME = "session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  const sitePasscode = process.env.SITE_PASSCODE;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sitePasscode || !sessionSecret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  if (passcode !== sitePasscode) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const token = await signSession(sessionSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 2: Implement the login page**

`app/login/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/fetch-json";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await fetchJson("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const from = params.get("from") || "/";
    router.push(from);
    router.refresh();
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1 className="page-title">เข้าสู่ระบบ</h1>
      </div>
      {error && <p className="error-banner">{error}</p>}
      <input
        className="text-input"
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="รหัสผ่าน"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={submit}>
          เข้าสู่ระบบ
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Set local env vars for manual verification**

Add these two lines to your local `.env` (not `.env.example` yet — that's
Task 5):
```
SITE_PASSCODE="test1234"
SESSION_SECRET="test-secret-do-not-use-in-production"
```

- [ ] **Step 4: Manually verify with the dev server**

Before starting the dev server, check for and kill any already-running
node processes (`tasklist //FI "IMAGENAME eq node.exe"` then
`taskkill //F //PID <pid>` for any found — this repo has previously had
issues with orphaned dev-server processes locking a Prisma engine DLL on
Windows). Then run `npm run dev` in the background.

`curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"passcode\":\"wrong\"}"`
Expected: `401` with `{"error":"รหัสผ่านไม่ถูกต้อง"}`, no `Set-Cookie` header.

`curl -i -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"passcode\":\"test1234\"}"`
Expected: `200` with `{"ok":true}` and a `Set-Cookie: session=...` header.

`curl http://localhost:3000/login -o /dev/null -w "%{http_code}\n"`
Expected: `200` (the login page itself renders — there's no middleware yet
in this task, so this just confirms the page compiles and loads; the
gate itself is built in Task 3).

Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add app/api/login/route.ts app/login/page.tsx
git commit -m "feat: add login page and API route for passcode gate"
```

---

### Task 3: Middleware — the actual gate

**Files:**
- Create: `middleware.ts` (project root, next to `package.json` — NOT
  inside `app/`, this is a Next.js convention)

**Interfaces:**
- Consumes: `verifySession` from `lib/auth.ts` (Task 1); reads the
  `session` cookie set by `/api/login` (Task 2).
- Produces: none consumed by later tasks (this is the enforcement point;
  Task 4 adds logout, which just clears what this task reads).

- [ ] **Step 1: Implement the middleware**

`middleware.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const COOKIE_NAME = "session";

export async function middleware(req: NextRequest) {
  const sessionSecret = process.env.SESSION_SECRET;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  const authenticated = !!sessionSecret && !!token && (await verifySession(token, sessionSecret));

  if (authenticated) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login).*)"],
};
```

- [ ] **Step 2: Manually verify with the dev server**

Check for and kill any already-running node processes first (same reason
as Task 2). Ensure `.env` still has `SITE_PASSCODE`/`SESSION_SECRET` from
Task 2's Step 3. Run `npm run dev`.

`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/`
Expected: `307` (redirect to `/login`) — no session cookie yet.

`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/sets`
Expected: `401`.

`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login`
Expected: `200` (login page itself is exempt, no redirect loop).

Now log in and reuse the cookie:
`curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d "{\"passcode\":\"test1234\"}" > /dev/null`
`curl -s -b /tmp/cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/`
Expected: `200` (authenticated now, home page loads normally).
`curl -s -b /tmp/cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/sets`
Expected: `200`.

Also confirm existing game-type pages still work when authenticated (no
regression from adding middleware):
`curl -s -b /tmp/cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/sort/edit/new`
Expected: `200`.

Stop the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware gate requiring a valid session cookie"
```

---

### Task 4: Logout

**Files:**
- Create: `app/api/logout/route.ts`
- Modify: `app/page.tsx` (add a logout link to the header)

**Interfaces:**
- Consumes: `fetchJson` from `lib/fetch-json.ts` (in the home page's
  logout handler).
- Produces: `POST /api/logout` → `200 { ok: true }`, clears the `session`
  cookie (same cookie name as Task 2/3: `session`).

- [ ] **Step 1: Implement the logout route**

`app/api/logout/route.ts`:
```typescript
import { NextResponse } from "next/server";

const COOKIE_NAME = "session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 2: Add a logout link to the home page header**

Read the current `app/page.tsx` first with the Read tool — it already has
a header with a title and a row of "create new set" buttons (one per game
type). Add a `logout` function and a button/link for it in that same
header area, without disturbing the existing three create buttons. The
function:
```typescript
async function logout() {
  await fetchJson("/api/logout", { method: "POST" });
  window.location.href = "/login";
}
```
And a button using the existing global classes, e.g.:
```tsx
<button className="btn btn-ghost btn-sm" onClick={logout}>
  ออกจากระบบ
</button>
```
Place it in the header, positioned so it doesn't crowd the three
create-buttons — your judgment on exact placement (e.g., its own row, or
after the three buttons with a bit more gap) based on how the current
header is laid out.

- [ ] **Step 3: Manually verify with the dev server**

Check for and kill any already-running node processes first. Run
`npm run dev`. Using the same cookie-jar approach as Task 3:
`curl -s -b /tmp/cookies.txt -c /tmp/cookies.txt -X POST http://localhost:3000/api/logout -w "%{http_code}\n" -o /dev/null`
Expected: `200`.
`curl -s -b /tmp/cookies.txt -o /dev/null -w "%{http_code}\n" http://localhost:3000/`
Expected: `307` (redirected to login again — the cookie was cleared).

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add app/api/logout/route.ts app/page.tsx
git commit -m "feat: add logout route and header link"
```

---

### Task 5: Env var documentation and full end-to-end verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new (documents the env vars already used by Tasks
  2-3).
- Produces: none (final task in this plan).

- [ ] **Step 1: Update `.env.example`**

Add to the existing `.env.example` (append, don't remove the existing
`DATABASE_URL` line):
```
SITE_PASSCODE="changeme"
SESSION_SECRET="changeme-generate-a-random-string"
```

- [ ] **Step 2: Update README**

Add a step 0.5 (or fold into the existing local-dev steps) telling the
user to set real values for `SITE_PASSCODE` and `SESSION_SECRET` in their
`.env` before running the app, since the app now fails closed without
them. Also add a step to the "Deploy" section instructing the user to set
`SITE_PASSCODE` and `SESSION_SECRET` as Vercel environment variables
alongside the existing `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` ones. Read
the current `README.md` first to match its existing numbering/style
rather than guessing the exact wording.

- [ ] **Step 3: Full end-to-end manual verification**

Check for and kill any already-running node processes first. Run
`npx vitest run` (expect all tests from Tasks 1 plus the existing 16 to
pass — 20 total), `npx tsc --noEmit` (expect clean), `npm run build`
(expect success, confirm `middleware.ts` is picked up — the build output
should mention "Middleware" in its route summary).

Then run `npm run dev` and manually walk through, using a fresh
cookie-jar file:
1. Confirm `/` redirects to `/login` when logged out.
2. Log in with the correct passcode (from your local `.env`).
3. Confirm you can now reach `/`, create a set in each of the three game
   types, play each one, and log out successfully via the header link.
4. Confirm that after logout, `/` redirects to `/login` again.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "docs: document SITE_PASSCODE/SESSION_SECRET env vars for the passcode gate"
```
