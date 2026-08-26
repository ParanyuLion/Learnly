# Category Sort Game (Sub-project 2 of Wordwall-like App) — Design

## Purpose
Add a second game type to the existing single-user study app: a "sort into
categories" game. The creator defines a set of categories and items, each
item belonging to one correct category. The player sorts items into their
categories by clicking an item then clicking a category.

This is additive to the existing matching game (Sub-project 1, see
`docs/superpowers/specs/2026-08-26-matching-game-design.md`) — it does not
change any existing matching-game behavior, data, or routes.

## Constraints & Decisions
(Same project-wide constraints as the matching game.)
- No auth / no login. Single user, public URL, no access control needed.
- Deploy free (Vercel + Turso), same existing deployment.
- Prisma is the only DB access layer.
- Sort-game logic lives in its own pure module (`lib/sort-game.ts`),
  separate from `lib/matching-game.ts` — each game type's logic is isolated,
  per the original project's modularity constraint.
- Stateless API routes — no in-memory session state.
- Interaction is click-to-select, not drag-and-drop (confirmed with user —
  simpler to build, no drag library needed, works identically on
  mouse/touch).
- Category count is creator-defined (not fixed at 2) — minimum 2 categories,
  minimum 1 item per category, enforced on save.

## Stack
Same as the matching game: Next.js (App Router) + Prisma + Turso (libSQL) +
Vercel. No new dependencies.

## Data Model
Added to the existing `prisma/schema.prisma`, alongside `GameSet`/`Pair`
(unchanged):

```prisma
model SortSet {
  id         String         @id @default(cuid())
  title      String
  createdAt  DateTime       @default(now())
  categories SortCategory[]
  items      SortItem[]
}

model SortCategory {
  id    String     @id @default(cuid())
  setId String
  set   SortSet    @relation(fields: [setId], references: [id], onDelete: Cascade)
  name  String
  items SortItem[]
}

model SortItem {
  id         String       @id @default(cuid())
  setId      String
  set        SortSet      @relation(fields: [setId], references: [id], onDelete: Cascade)
  categoryId String
  category   SortCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  text       String
}
```
`SortItem.setId` is a denormalized convenience field (mirrors `Pair.setId`
in the matching game) so items can be fetched/replaced per-set without
joining through categories.

## Pure Logic Module
`lib/sort-game.ts` — framework-free, mirrors `lib/matching-game.ts`'s shape:
```typescript
export type Category = { id: string; name: string };
export type Item = { id: string; text: string; categoryId: string };

export function shuffleItems(items: Item[]): Item[]; // Fisher-Yates, same algorithm as matching-game
export function isCorrectCategory(item: Item, category: Category): boolean; // item.categoryId === category.id
```

## Pages / Routes
1. `/sort/edit/[id]` (`new` for create) — form to name the set, add/remove
   categories (each a name field), and add/remove items under each category
   (each item is text + implicitly belongs to the category it's listed
   under). Same create-vs-edit branching pattern as `/edit/[id]`.
2. `/sort/play/[id]` — an unsorted item pool (shuffled) at the top, and one
   box per category below. Click an item to select it (highlight), then
   click a category:
   - Correct: the item moves out of the pool into that category's box and
     locks (no longer clickable/selectable).
   - Incorrect: the clicked category briefly flashes red; the item stays
     selected in the pool, player can pick a different category or a
     different item.
   Win state once the pool is empty (all items correctly placed).
3. `app/page.tsx` (existing home page) is modified to also fetch sort sets
   and merge them into the same tile grid, each tile tagged with a type
   badge and linking to `/sort/edit/[id]` / `/sort/play/[id]` for sort sets
   vs. the existing `/edit/[id]` / `/play/[id]` for matching sets.

## API Routes
- `GET/POST /api/sort-sets` — list / create SortSets (list includes
  `_count: { items }` for the home-page badge, same pattern as
  `/api/sets`).
- `GET/PUT/DELETE /api/sort-sets/[id]` — read (with categories + items) /
  replace-all (delete existing categories+items, recreate from the request
  body, in a transaction) / delete (cascades).

Validation on `PUT`: title non-blank; at least 2 categories, each with a
non-blank name; every category has at least 1 item; every item has
non-blank text. Same trim-then-validate pattern as the matching game's
`PUT /api/sets/:id`.

## Error Handling
- Same posture as the matching game: basic input validation only, no
  auth/permission errors. Reuse the existing `lib/fetch-json.ts` helper and
  the existing `app/error.tsx` / `app/not-found.tsx` boundaries — no new
  error-handling infrastructure needed.

## Testing
- Unit tests for `lib/sort-game.ts` (shuffle + correctness check), same
  style and rigor as `lib/matching-game.test.ts`.
- Manual browser check of create → edit → play flow, plus a check that the
  home page correctly shows and links both matching sets and sort sets
  together.

## Out of Scope
- Drag-and-drop interaction (click-to-select only, per user's explicit
  choice).
- Any further game types beyond matching and sort (still future work).
- Any authentication or multi-user features (unchanged from Sub-project 1).
