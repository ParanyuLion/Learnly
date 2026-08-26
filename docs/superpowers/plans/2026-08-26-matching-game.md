# Matching Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a website (Next.js + Prisma + SQLite/Turso) where a single
user can create sets of word pairs and play a matching game against them,
deployable free on Vercel.

**Architecture:** One Next.js (App Router, TypeScript) app. Prisma ORM talks
to a local SQLite file in dev and Turso (libSQL) in production via the same
schema. Three pages (`/`, `/edit/[id]`, `/play/[id]`) call two API route
files (`/api/sets`, `/api/sets/[id]`). Game shuffle/match logic lives in a
pure, unit-tested module with no framework dependencies.

**Tech Stack:** Next.js 14 (App Router, TypeScript), Prisma, SQLite (dev) /
Turso libSQL (prod), Vitest for unit tests, Vercel for deploy.

**Spec:** `docs/superpowers/specs/2026-08-26-matching-game-design.md`

## Global Constraints

- No authentication, no login, no access control — public app, single user.
- Free-tier deploy only: Vercel (hosting) + Turso (DB).
- Prisma is the only DB access layer — no raw SQL — so the DB is swappable later.
- No in-memory server state (stateless API routes) — required for future horizontal scaling.
- Game-type logic (matching) must live in its own module, separate from other future game types.

---

### Task 1: Project scaffold + Prisma + SQLite

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `prisma/schema.prisma`
- Create: `.env`
- Create: `.gitignore`
- Create: `lib/prisma.ts`

**Interfaces:**
- Produces: `prisma` client singleton exported from `lib/prisma.ts` as
  `export const prisma: PrismaClient`, used by all API routes in later tasks.
- Produces: `GameSet` and `Pair` Prisma models (see schema below), used by
  all later tasks.

- [ ] **Step 1: Create Next.js app files**

`package.json`:
```json
{
  "name": "studyweb",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "test": "vitest run",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "@prisma/adapter-libsql": "^5.20.0",
    "@libsql/client": "^0.14.0",
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "prisma": "^5.20.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`app/layout.tsx`:
```tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "StudyWeb" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
```

`app/globals.css`:
```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f7; }
```

`.gitignore`:
```
node_modules
.next
dev.db
.env
```

`.env`:
```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 2: Create Prisma schema**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model GameSet {
  id        String   @id @default(cuid())
  title     String
  createdAt DateTime @default(now())
  pairs     Pair[]
}

model Pair {
  id    String  @id @default(cuid())
  setId String
  set   GameSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  left  String
  right String
}
```

- [ ] **Step 3: Create Prisma client singleton**

`lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Install dependencies and generate the local SQLite DB**

Run: `npm install`
Run: `npx prisma migrate dev --name init`
Expected: creates `dev.db`, `prisma/migrations/`, and generates the Prisma client with no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.mjs app/layout.tsx app/globals.css prisma lib/prisma.ts .gitignore
git commit -m "chore: scaffold Next.js app with Prisma + SQLite"
```

---

### Task 2: Matching-game pure logic module

**Files:**
- Create: `lib/matching-game.ts`
- Test: `lib/matching-game.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: nothing (pure module, no dependencies on Prisma or Next.js).
- Produces:
  - `type Pair = { id: string; left: string; right: string }`
  - `type Card = { id: string; pairId: string; text: string; side: "left" | "right" }`
  - `shuffleIntoCards(pairs: Pair[]): Card[]` — used by the play page (Task 6).
  - `isMatch(a: Card, b: Card): boolean` — used by the play page (Task 6).

- [ ] **Step 1: Create vitest config**

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Write the failing test**

`lib/matching-game.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { shuffleIntoCards, isMatch, type Pair } from "./matching-game";

const pairs: Pair[] = [
  { id: "p1", left: "Dog", right: "Sunuk" },
  { id: "p2", left: "Cat", right: "Maew" },
  { id: "p3", left: "Bird", right: "Nok" },
];

describe("shuffleIntoCards", () => {
  it("produces two cards per pair, one left and one right", () => {
    const cards = shuffleIntoCards(pairs);
    expect(cards).toHaveLength(pairs.length * 2);
    for (const pair of pairs) {
      const cardsForPair = cards.filter((c) => c.pairId === pair.id);
      expect(cardsForPair).toHaveLength(2);
      expect(cardsForPair.some((c) => c.side === "left" && c.text === pair.left)).toBe(true);
      expect(cardsForPair.some((c) => c.side === "right" && c.text === pair.right)).toBe(true);
    }
  });

  it("gives every card a unique id", () => {
    const cards = shuffleIntoCards(pairs);
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(cards.length);
  });
});

describe("isMatch", () => {
  it("returns true for two cards from the same pair on opposite sides", () => {
    const cards = shuffleIntoCards(pairs);
    const left = cards.find((c) => c.pairId === "p1" && c.side === "left")!;
    const right = cards.find((c) => c.pairId === "p1" && c.side === "right")!;
    expect(isMatch(left, right)).toBe(true);
  });

  it("returns false for cards from different pairs", () => {
    const cards = shuffleIntoCards(pairs);
    const left = cards.find((c) => c.pairId === "p1" && c.side === "left")!;
    const right = cards.find((c) => c.pairId === "p2" && c.side === "right")!;
    expect(isMatch(left, right)).toBe(false);
  });

  it("returns false for two cards on the same side", () => {
    const cards = shuffleIntoCards(pairs);
    const left1 = cards.find((c) => c.pairId === "p1" && c.side === "left")!;
    const left2 = cards.find((c) => c.pairId === "p2" && c.side === "left")!;
    expect(isMatch(left1, left2)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/matching-game.test.ts`
Expected: FAIL with "Cannot find module './matching-game'"

- [ ] **Step 4: Write minimal implementation**

`lib/matching-game.ts`:
```typescript
export type Pair = { id: string; left: string; right: string };
export type Card = { id: string; pairId: string; text: string; side: "left" | "right" };

export function shuffleIntoCards(pairs: Pair[]): Card[] {
  const cards: Card[] = pairs.flatMap((pair) => [
    { id: `${pair.id}-left`, pairId: pair.id, text: pair.left, side: "left" as const },
    { id: `${pair.id}-right`, pairId: pair.id, text: pair.right, side: "right" as const },
  ]);

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

export function isMatch(a: Card, b: Card): boolean {
  return a.pairId === b.pairId && a.side !== b.side;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/matching-game.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/matching-game.ts lib/matching-game.test.ts vitest.config.ts
git commit -m "feat: add pure matching-game shuffle/match logic with tests"
```

---

### Task 3: API routes — list & create sets

**Files:**
- Create: `app/api/sets/route.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts` (Task 1).
- Produces:
  - `GET /api/sets` → `200 { id, title, createdAt, _count: { pairs } }[]`
  - `POST /api/sets` with body `{ title: string }` → `201 { id, title, createdAt }`, or `400` if title is blank.

- [ ] **Step 1: Implement the route**

`app/api/sets/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sets = await prisma.gameSet.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pairs: true } } },
  });
  return NextResponse.json(sets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const set = await prisma.gameSet.create({ data: { title } });
  return NextResponse.json(set, { status: 201 });
}
```

- [ ] **Step 2: Manually verify with the dev server**

Run: `npm run dev` (in background), then in another terminal:
`curl -X POST http://localhost:3000/api/sets -H "Content-Type: application/json" -d "{\"title\":\"Animals\"}"`
Expected: `201` response with a JSON object containing `id` and `title: "Animals"`.
Then: `curl http://localhost:3000/api/sets`
Expected: `200` response, an array containing the set just created.

- [ ] **Step 3: Commit**

```bash
git add app/api/sets/route.ts
git commit -m "feat: add GET/POST /api/sets routes"
```

---

### Task 4: API routes — read, update, delete a single set

**Files:**
- Create: `app/api/sets/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma` from `lib/prisma.ts` (Task 1).
- Produces:
  - `GET /api/sets/:id` → `200 { id, title, createdAt, pairs: { id, left, right }[] }`, or `404` if not found.
  - `PUT /api/sets/:id` with body `{ title: string, pairs: { left: string, right: string }[] }` → replaces the title and the full set of pairs, `200` with the updated set (same shape as GET), or `400` on invalid input.
  - `DELETE /api/sets/:id` → `204`, cascades to delete its pairs.

- [ ] **Step 1: Implement the route**

`app/api/sets/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const set = await prisma.gameSet.findUnique({
    where: { id: params.id },
    include: { pairs: true },
  });

  if (!set) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(set);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const pairs = Array.isArray(body.pairs) ? body.pairs : null;

  if (!title || !pairs) {
    return NextResponse.json({ error: "title and pairs are required" }, { status: 400 });
  }

  for (const pair of pairs) {
    const left = typeof pair.left === "string" ? pair.left.trim() : "";
    const right = typeof pair.right === "string" ? pair.right.trim() : "";
    if (!left || !right) {
      return NextResponse.json({ error: "each pair needs left and right text" }, { status: 400 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.pair.deleteMany({ where: { setId: params.id } });
    return tx.gameSet.update({
      where: { id: params.id },
      data: {
        title,
        pairs: {
          create: pairs.map((p: { left: string; right: string }) => ({
            left: p.left.trim(),
            right: p.right.trim(),
          })),
        },
      },
      include: { pairs: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.gameSet.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Manually verify with the dev server**

Using the set id created in Task 3's manual check:
`curl -X PUT http://localhost:3000/api/sets/<id> -H "Content-Type: application/json" -d "{\"title\":\"Animals\",\"pairs\":[{\"left\":\"Dog\",\"right\":\"Sunuk\"}]}"`
Expected: `200` with `pairs` containing one item.
`curl http://localhost:3000/api/sets/<id>`
Expected: `200`, same data.
`curl -X DELETE http://localhost:3000/api/sets/<id>`
Expected: `204`, then a subsequent GET on that id returns `404`.

- [ ] **Step 3: Commit**

```bash
git add "app/api/sets/[id]/route.ts"
git commit -m "feat: add GET/PUT/DELETE /api/sets/:id routes"
```

---

### Task 5: Home page — list sets

**Files:**
- Create: `app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sets` (Task 3) — client-side fetch.
- Produces: links to `/edit/[id]`, `/play/[id]`, and `/edit/new` used by Tasks 6-7.

- [ ] **Step 1: Implement the page**

`app/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SetSummary = {
  id: string;
  title: string;
  createdAt: string;
  _count: { pairs: number };
};

export default function HomePage() {
  const [sets, setSets] = useState<SetSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/sets")
      .then((res) => res.json())
      .then(setSets);
  }, []);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>ชุดโจทย์ของฉัน</h1>
      <p>
        <Link href="/edit/new">+ สร้างชุดโจทย์ใหม่</Link>
      </p>
      {sets === null && <p>กำลังโหลด...</p>}
      {sets?.length === 0 && <p>ยังไม่มีชุดโจทย์ สร้างชุดแรกกันเลย</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {sets?.map((set) => (
          <li
            key={set.id}
            style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ddd" }}
          >
            <span>
              {set.title} ({set._count.pairs} คู่)
            </span>
            <span>
              <Link href={`/play/${set.id}`}>เล่น</Link>
              {" | "}
              <Link href={`/edit/${set.id}`}>แก้ไข</Link>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`, open `http://localhost:3000/`.
Expected: page loads, shows any sets created during earlier manual API testing (or "ยังไม่มีชุดโจทย์" if none exist), with working links.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add home page listing game sets"
```

---

### Task 6: Edit page — create/edit pairs

**Files:**
- Create: `app/edit/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sets/:id` (Task 4) when `id !== "new"`; `POST /api/sets` (Task 3) and `PUT /api/sets/:id` (Task 4) to save.
- Produces: navigates to `/` on save, using the same set shape as Task 4/5.

- [ ] **Step 1: Implement the page**

`app/edit/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PairInput = { left: string; right: string };

export default function EditSetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";
  const [title, setTitle] = useState("");
  const [pairs, setPairs] = useState<PairInput[]>([{ left: "", right: "" }]);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/sets/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data.title);
        setPairs(data.pairs.map((p: { left: string; right: string }) => ({ left: p.left, right: p.right })));
        setLoading(false);
      });
  }, [isNew, params.id]);

  function updatePair(index: number, field: keyof PairInput, value: string) {
    setPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPair() {
    setPairs((prev) => [...prev, { left: "", right: "" }]);
  }

  function removePair(index: number) {
    setPairs((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    const cleanPairs = pairs
      .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
      .filter((p) => p.left && p.right);

    if (!title.trim() || cleanPairs.length === 0) {
      alert("ต้องมีชื่อชุดโจทย์และคู่คำอย่างน้อย 1 คู่");
      return;
    }

    if (isNew) {
      const created = await fetch("/api/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      }).then((res) => res.json());

      await fetch(`/api/sets/${created.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), pairs: cleanPairs }),
      });
    } else {
      await fetch(`/api/sets/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), pairs: cleanPairs }),
      });
    }

    router.push("/");
  }

  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>{isNew ? "สร้างชุดโจทย์ใหม่" : "แก้ไขชุดโจทย์"}</h1>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="ชื่อชุดโจทย์"
        style={{ display: "block", width: "100%", padding: 8, marginBottom: 16 }}
      />
      {pairs.map((pair, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={pair.left}
            onChange={(e) => updatePair(i, "left", e.target.value)}
            placeholder="คำซ้าย"
            style={{ flex: 1, padding: 8 }}
          />
          <input
            value={pair.right}
            onChange={(e) => updatePair(i, "right", e.target.value)}
            placeholder="คำขวา"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={() => removePair(i)}>ลบ</button>
        </div>
      ))}
      <button onClick={addPair}>+ เพิ่มคู่คำ</button>
      <div style={{ marginTop: 16 }}>
        <button onClick={save}>บันทึก</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify**

Open `http://localhost:3000/edit/new`, fill in a title and a couple of pairs,
click บันทึก. Expected: redirected to `/`, new set appears in the list with
the correct pair count. Click แก้ไข on it, change a pair, save again.
Expected: pair count/content updated on the home page.

- [ ] **Step 3: Commit**

```bash
git add "app/edit/[id]/page.tsx"
git commit -m "feat: add create/edit page for game set pairs"
```

---

### Task 7: Play page — matching game

**Files:**
- Create: `app/play/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/sets/:id` (Task 4); `shuffleIntoCards`, `isMatch`, `Card` from `lib/matching-game.ts` (Task 2).
- Produces: none consumed by later tasks (final page in this plan).

- [ ] **Step 1: Implement the page**

`app/play/[id]/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { shuffleIntoCards, isMatch, type Card, type Pair } from "@/lib/matching-game";

export default function PlaySetPage({ params }: { params: { id: string } }) {
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);

  useEffect(() => {
    fetch(`/api/sets/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data.title);
        const pairs: Pair[] = data.pairs;
        setCards(shuffleIntoCards(pairs));
      });
  }, [params.id]);

  function handleClick(card: Card) {
    if (matchedPairIds.has(card.pairId) || card.id === selected?.id) return;

    if (!selected) {
      setSelected(card);
      return;
    }

    if (isMatch(selected, card)) {
      setMatchedPairIds((prev) => new Set(prev).add(card.pairId));
      setSelected(null);
    } else {
      setWrongPair([selected.id, card.id]);
      setTimeout(() => setWrongPair(null), 500);
      setSelected(null);
    }
  }

  if (!cards) return <p>กำลังโหลด...</p>;

  const won = matchedPairIds.size > 0 && matchedPairIds.size === cards.length / 2;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h1>{title}</h1>
      {won && <p>ยินดีด้วย! จับคู่ครบแล้ว 🎉</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {cards.map((card) => {
          const isMatched = matchedPairIds.has(card.pairId);
          const isSelected = selected?.id === card.id;
          const isWrong = wrongPair?.includes(card.id);
          return (
            <button
              key={card.id}
              onClick={() => handleClick(card)}
              disabled={isMatched}
              style={{
                padding: 16,
                background: isMatched ? "#c8f7c5" : isWrong ? "#f7c5c5" : isSelected ? "#c5d8f7" : "white",
                border: "1px solid #ccc",
                borderRadius: 8,
                cursor: isMatched ? "default" : "pointer",
              }}
            >
              {card.text}
            </button>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Manually verify**

Open `http://localhost:3000/play/<id>` for a set with at least 3 pairs.
Expected: cards shown in random order; clicking a correct pair marks both
green and disables them; clicking a wrong pair briefly flashes red then
resets; after all pairs are matched, the win message appears.

- [ ] **Step 3: Commit**

```bash
git add "app/play/[id]/page.tsx"
git commit -m "feat: add matching game play page"
```

---

### Task 8: Deployment setup (Turso + Vercel)

**Files:**
- Modify: `prisma/schema.prisma` (swap SQLite connector for libSQL-compatible driver adapter)
- Create: `README.md`

**Interfaces:**
- Consumes: `lib/prisma.ts` (Task 1) — update to use the libSQL driver adapter when `TURSO_DATABASE_URL` is set.
- Produces: deployed production URL (manual step, documented in README).

- [ ] **Step 1: Update Prisma client to support Turso in production**

`lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;

  if (tursoUrl) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Document deployment steps**

`README.md`:
```markdown
# StudyWeb — Matching Game

## Local development
1. `npm install`
2. `npm run prisma:migrate` (creates local `dev.db`)
3. `npm run dev` — open http://localhost:3000

## Run tests
`npm test`

## Deploy (free tier)
1. Create a free database at https://turso.tech, note the DB URL and auth token.
2. Push schema to Turso: `npx prisma migrate deploy` with `DATABASE_URL` pointed at the Turso libSQL URL (or run migrations locally against SQLite and mirror the schema — for a single-user app either works).
3. Push this repo to GitHub.
4. Import the repo into https://vercel.com, set environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
5. Deploy. Vercel builds with `npm run build` automatically.
```

- [ ] **Step 3: Manually verify the app still runs locally**

Run: `npm run dev`
Expected: app behaves identically to before (no `TURSO_DATABASE_URL` set locally, so it falls back to local SQLite).

- [ ] **Step 4: Commit**

```bash
git add lib/prisma.ts README.md
git commit -m "feat: support Turso libSQL in production, document deploy steps"
```
