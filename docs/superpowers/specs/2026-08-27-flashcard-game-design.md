# Flashcard Game (Sub-project 3 of Wordwall-like App) — Design

## Purpose
Add a third game type to the existing single-user study app: a classic
flashcard deck. The creator defines cards (front/back pairs). The player
flips through a shuffled deck, marking each card "จำได้" (known, removed
from the deck) or "ยังไม่จำ" (not yet known, sent to the back of the deck),
looping until every card has been marked known at least once.

This is additive to the existing matching game (Sub-project 1) and category
sort game (Sub-project 2) — it does not change either of their behavior,
data, or routes.

## Constraints & Decisions
(Same project-wide constraints as the prior two game types.)
- No auth / no login. Single user, public URL, no access control needed.
- Deploy free (Vercel + Turso), same existing deployment.
- Prisma is the only DB access layer.
- Flashcard-game logic lives in its own pure module (`lib/flashcard-game.ts`),
  separate from `lib/matching-game.ts` and `lib/sort-game.ts` — each game
  type's logic is isolated, per the project's established modularity
  constraint.
- Stateless API routes — no in-memory session state.
- Card interaction is click-to-flip (visual aid only, does not gate
  anything) plus two buttons: "จำได้" (remove from deck) and "ยังไม่จำ"
  (move to the back of the deck) — confirmed with user.
- A card marked "ยังไม่จำ" reappears later in the same round (moved to the
  back of the queue), not immediately — confirmed with user. The round
  continues, looping as needed, until the deck is empty (every card has
  been marked "จำได้" at least once).

## Stack
Same as the existing app: Next.js (App Router) + Prisma + Turso (libSQL) +
Vercel. No new dependencies.

## Data Model
Added to the existing `prisma/schema.prisma`, alongside `GameSet`/`Pair`
and `SortSet`/`SortCategory`/`SortItem` (all unchanged):

```prisma
model FlashcardSet {
  id        String       @id @default(cuid())
  title     String
  createdAt DateTime     @default(now())
  cards     Flashcard[]
}

model Flashcard {
  id     String        @id @default(cuid())
  setId  String
  set    FlashcardSet  @relation(fields: [setId], references: [id], onDelete: Cascade)
  front  String
  back   String
}
```

## Pure Logic Module
`lib/flashcard-game.ts` — framework-free, mirrors the shape of
`lib/matching-game.ts` / `lib/sort-game.ts`:
```typescript
export type Card = { id: string; front: string; back: string };

export function shuffleCards(cards: Card[]): Card[]; // Fisher-Yates, same algorithm as the other two games
export function moveToBack<T>(deck: T[]): T[]; // returns a new array with deck[0] moved to the end; no-op (returns a copy) for length 0 or 1
```

## Pages / Routes
1. `/flashcard/edit/[id]` (`new` for create) — form to name the set and
   add/remove/edit cards (each card is a front + back text pair). Same
   create-vs-edit branching pattern as the other two game types' edit
   pages.
2. `/flashcard/play/[id]` — shows the current card (front by default,
   flips to back on click), a small progress indicator (e.g. "เหลือ N
   ใบ"), and two buttons: "จำได้ ✓" (removes the current card from the
   deck) and "ยังไม่จำ ✗" (moves the current card to the back of the deck
   via `moveToBack`). The card-flip state resets whenever the current card
   changes. Win state once the deck is empty.
3. `app/page.tsx` (existing home page) is modified again to also fetch
   flashcard sets and merge them into the same tile grid (now three game
   types), each tile tagged with its type badge and linking to
   `/flashcard/edit/[id]` / `/flashcard/play/[id]` for flashcard sets.

## API Routes
- `GET/POST /api/flashcard-sets` — list / create FlashcardSets (list
  includes `_count: { cards }`, same pattern as the other two game types'
  list endpoints).
- `GET/PUT/DELETE /api/flashcard-sets/[id]` — read (with cards) /
  replace-all (delete existing cards, recreate from the request body, in a
  transaction) / delete (cascades).

Validation on `PUT`: title non-blank; at least 1 card; every card has
non-blank front AND non-blank back (after trimming). Same
trim-then-validate pattern as the other two game types.

## Error Handling
Same posture as the other two game types: basic input validation only, no
auth/permission errors. Reuse the existing `lib/fetch-json.ts` helper and
the existing `app/error.tsx` / `app/not-found.tsx` boundaries.

## Testing
- Unit tests for `lib/flashcard-game.ts`: `shuffleCards` (same rigor as the
  other two games' shuffle tests) and `moveToBack` (normal case, single-
  element deck, empty deck).
- Manual browser check of create → edit → play flow, including looping
  behavior (mark a card "ยังไม่จำ", confirm it reappears later in the same
  round rather than immediately, and confirm the deck eventually empties
  once every card has been marked "จำได้").
- Confirm the home page correctly shows and links all three game types
  together.

## Out of Scope
- Spaced-repetition scheduling (e.g. Anki-style intervals) — this is a
  simple "retry until known" loop within a single play session, not
  persisted between sessions.
- Any further game types beyond matching, sort, and flashcard (still
  future work).
- Any authentication or multi-user features (unchanged from prior
  sub-projects).
