# Nested (Sub-)Categories for the Sort Game — Design

## Purpose
The sort game (`docs/superpowers/specs/2026-08-27-sort-game-design.md`)
currently supports only a flat list of categories. The user wants
categories that can contain subcategories — e.g. "Animals" containing
"Mammals" and "Birds" — nested to unlimited depth, with items only ever
placed inside a leaf (childless) category.

This is additive to the existing sort game: existing sets keep working
unchanged (every existing category simply has no parent, i.e. is a root
category, which is also a leaf as long as it has no children — identical
behavior to today).

## Constraints & Decisions
(Inherits the sort-game spec's constraints: no auth, Prisma-only DB access,
click-to-select interaction, own pure logic module.)
- Nesting depth is **unlimited** (confirmed with user) — not capped at one
  level.
- Items may only be placed in **leaf** categories (categories with no
  children) — confirmed with user.
- A category cannot have both child categories and items at the same time.
  Adding a subcategory to a category that currently holds items clears
  those items (with an explicit in-app confirm dialog before it happens,
  using the existing `ConfirmDialog` component — never a silent data loss
  and never the browser's native `confirm()`).
- Migration is additive only: `SortCategory` gains a nullable `parentId`
  column. No existing table is dropped or renamed; every existing row gets
  `parentId = NULL` and continues to behave exactly as before (a root-level
  leaf category). This migration must be applied only to the local dev
  database via `prisma migrate dev` — it does not touch the production
  Turso database, which is migrated separately by the user via
  `scripts/apply-turso-migrations.mjs` at their own pace.
- During play, clicking a non-leaf category expands it in place to reveal
  its direct children; it never accepts an item placement itself (confirmed
  with user).
- Save validation (same spirit as today's "≥2 categories, each ≥1 item"):
  the whole tree must contain **at least 2 leaf categories**, and **every
  leaf category must have at least 1 item**. Non-leaf (container)
  categories are exempt from the item-count rule since they can't hold
  items at all.

## Data Model
`prisma/schema.prisma` — `SortCategory` gains a self-relation:
```prisma
model SortCategory {
  id       String         @id @default(cuid())
  setId    String
  set      SortSet        @relation(fields: [setId], references: [id], onDelete: Cascade)
  name     String
  parentId String?
  parent   SortCategory?  @relation("CategoryChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children SortCategory[] @relation("CategoryChildren")
  items    SortItem[]
}
```
`SortItem` and `SortSet` are unchanged. Deleting an entire set's categories
(the existing `sortCategory.deleteMany({ where: { setId } })` used by the
save/replace flow) already deletes every category regardless of depth in
one call, since it filters by `setId` (present on every row at every
depth) rather than walking the tree — no cascade-ordering concerns.

A new Prisma migration is generated for this (`prisma migrate dev`),
applied to the local SQLite dev database only, per the constraint above.

## Pure Logic Module
`lib/sort-game.ts` — extends the existing module, still framework-free:
```typescript
export type Category = { id: string; name: string; parentId: string | null };
export type Item = { id: string; text: string; categoryId: string };

export function shuffleItems(items: Item[]): Item[]; // unchanged
export function isCorrectCategory(item: Item, category: Category): boolean; // unchanged

// New:
export function getChildren(categories: Category[], parentId: string | null): Category[];
// Categories whose parentId strictly equals the given value (null = root level).

export function isLeafCategory(categories: Category[], categoryId: string): boolean;
// True when no category in the list has parentId === categoryId.

export function getLeafCategories(categories: Category[]): Category[];
// Filters `categories` down to only the leaves, via isLeafCategory.
```
These three new functions are the single source of truth for tree
structure — both the edit page (rendering the nested editor, validating
before save) and the play page (rendering the drill-down UI, computing the
win condition) use them instead of re-deriving tree logic locally.

## Wire Format
`GET /api/sort-sets/[id]` returns categories and items as two **flat**
arrays (not nested), which map directly onto the pure `Category[]`/`Item[]`
types above:
```json
{
  "id": "...", "title": "...",
  "categories": [{ "id": "...", "name": "...", "parentId": null }],
  "items": [{ "id": "...", "text": "...", "categoryId": "..." }]
}
```
This keeps the play page's data shape a direct, no-transformation match for
`lib/sort-game.ts`'s types (today's play page has to `flatMap` items out of
a nested `categories[].items[]` shape — this removes that step entirely).

`PUT /api/sort-sets/[id]` accepts a **nested tree** in the request body,
because the save flow fully replaces a set's categories/items every time
(delete-all, recreate-from-scratch) and Prisma's nested `create` naturally
builds a tree of brand-new rows in one transaction, without the client
needing to invent or track real IDs for not-yet-saved categories:
```typescript
type CategoryTreeInput = {
  name: string;
  items: string[];          // only meaningful when children is empty
  children: CategoryTreeInput[];
};
// body: { title: string, categories: CategoryTreeInput[] }
```

## Edit Page (`app/sort/edit/[id]/page.tsx`)
Local component state becomes a **flat** list mirroring the GET shape, plus
an `items: string[]` field per category for in-progress editing, plus a
client-only temporary `id` (e.g. `crypto.randomUUID()`) so newly-added
categories can be referenced as a parent before they're ever saved:
```typescript
type CategoryInput = { id: string; name: string; parentId: string | null; items: string[] };
```
- Loading existing data: GET's flat `categories`/`items` are merged into
  this shape (`items` grouped by `categoryId` into each category's local
  `items` array).
- Rendering: a recursive function walks the flat list via
  `getChildren(categories, parentId)` starting from `null`, rendering each
  category indented by depth, with:
  - a name input,
  - an item-editor (add/remove item text fields) **shown only when the
    category is currently a leaf** (`isLeafCategory(categories, cat.id)`),
  - a "+ เพิ่มหมวดย่อย" (add subcategory) button,
  - a "✕" remove button that also recursively removes all descendants.
- Adding a subcategory to a category that currently has non-empty items
  shows the existing `ConfirmDialog` ("การเพิ่มหมวดย่อยจะลบไอเทม N
  รายการในหมวดนี้ ดำเนินการต่อ?"); confirming clears that category's
  `items` and adds the new child. Adding to a category with zero items
  requires no confirmation.
- Save validation (before hitting the API) mirrors the API's rule: at least
  2 leaf categories (via `getLeafCategories`), every leaf non-blank name
  with ≥1 non-blank item, every non-leaf category still needs a non-blank
  name. Failures show the existing `AlertDialog`.
- On save, the flat `CategoryInput[]` is converted to the nested
  `CategoryTreeInput[]` wire format (a small conversion built with
  `getChildren`, local to the edit page — not exported from the pure
  module, since it's a one-way UI-to-wire conversion, not game logic).

## Play Page (`app/sort/play/[id]/page.tsx`)
- Fetches the flat `categories`/`items` directly as `Category[]`/`Item[]`
  (no transformation needed, per the Wire Format section above).
- Renders category boxes recursively, starting from
  `getChildren(categories, null)`:
  - **Leaf category**: unchanged from today — clicking it attempts a
    placement (immediate-mode correctness check, or batch-mode
    unconditional placement); shows its placed-item chips with the
    existing FLIP slide animation.
  - **Non-leaf category**: clicking it toggles membership in a local
    `expandedIds: Set<string>` state instead of attempting a placement; an
    expand/collapse indicator (▸/▾) shows current state; when expanded, its
    children render indented beneath it (recursively, so a grandchild can
    itself be a container that expands further).
- Win condition:
  - Immediate mode: unchanged (`totalItems > 0 && pool.length === 0`) —
    total item count doesn't change with nesting.
  - Batch mode's `isFullyCorrect()` narrows its check to
    `getLeafCategories(categories)` only, since non-leaf categories never
    receive placements.
- `placed` state continues to be keyed by category id for every category
  (leaf and non-leaf alike, as today) — non-leaf entries simply stay empty
  and are never read for rendering or scoring.

## Error Handling
Same posture as the base sort-game spec: input validation only, surfaced
via the existing `AlertDialog`/`ConfirmDialog` components (per the project's
recent move away from native `alert`/`confirm`). No new error-handling
infrastructure.

## Testing
- New unit tests in `lib/sort-game.test.ts` for `getChildren`,
  `isLeafCategory`, and `getLeafCategories` — covering: root-level query
  (`parentId: null`), a mid-tree parent with multiple children, a leaf with
  no children, and an empty category list.
- Manual verification: create a set with a 2-level nested tree, save,
  reload the edit page and confirm the tree round-trips correctly; play it
  end-to-end in both immediate and batch mode; confirm an existing
  (pre-migration, flat) sort set still loads and plays exactly as before.

## Out of Scope
- Moving/re-parenting an existing category via drag-and-drop or similar —
  editing the tree shape is add/remove only for this iteration.
- An aggregate "N of M placed" count shown on non-leaf category boxes —
  nice-to-have, not required for the core feature.
- Any change to the matching game, flashcard game, or the passcode gate.
