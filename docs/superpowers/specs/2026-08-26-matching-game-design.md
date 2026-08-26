# Matching Game (Sub-project 1 of Wordwall-like App) — Design

## Purpose
Build a website where the user can create and play a "matching pairs" game,
as the first of several game types planned (quiz, wordsearch, etc. later).
This is a personal tool: single creator, single player (same person), no
other users.

## Constraints & Decisions
- **No auth / no login.** Single user, public URL, no access control needed.
- **Deploy free.** Target Vercel (hosting) + Turso (DB), both free tiers.
- **Scalability:** Not a load concern (1-2 users), but the design should not
  block future growth:
  - Use Prisma as the ORM so the underlying DB (Turso/libSQL now) can be
    swapped for Postgres later without rewriting query logic.
  - Keep game-type logic modular (see Data Model) so adding new game types
    (quiz, wordsearch, ...) doesn't require restructuring existing tables.
  - Stateless Next.js API routes — no in-memory session state — so the app
    can scale horizontally on Vercel with zero changes if usage ever grows.

## Stack
- **Next.js (App Router)** — UI + API routes, single deployable app.
- **Prisma + Turso (libSQL)** — free relational DB, easy migrations.
- **Vercel** — free deploy from GitHub push.

## Data Model
```prisma
model GameSet {
  id        String   @id @default(cuid())
  title     String
  createdAt DateTime @default(now())
  pairs     Pair[]
}

model Pair {
  id      String  @id @default(cuid())
  setId   String
  set     GameSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  left    String
  right   String
}
```

## Pages / Routes
1. `/` — list all GameSets, button to create a new one.
2. `/edit/[id]` — form to add/edit/remove pairs within a set (also used to
   create a new set, via `/edit/new`).
3. `/play/[id]` — matching game: cards are shuffled and shown, player
   clicks/drags to match `left` items with their `right` counterpart, with
   a simple timer and win state.

## API Routes
- `GET/POST /api/sets` — list / create GameSets
- `GET/PUT/DELETE /api/sets/[id]` — read / update (pairs) / delete a set

## Error Handling
- Basic validation only (non-empty title, non-empty pair text) — no need for
  auth/permission errors since there's no access control.
- Standard Next.js error boundaries for unexpected failures.

## Testing
- Unit tests for the matching-game shuffle/match logic (pure functions).
- Manual browser check of create → edit → play flow before calling it done.

## Out of Scope (future sub-projects)
- Additional game types (quiz, wordsearch, anagram, random wheel).
- Any authentication, sharing, or multi-user features.
