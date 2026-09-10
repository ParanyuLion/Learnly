# Images in Sort Items and Flashcards — Design

## Purpose
The sort game and the flashcard game currently store only text. The user
wants to attach an image to:
- each **sort item** (rendered in the pool and in placed slots during play), and
- the **front side** of each **flashcard** (the question side).

The image is **supplementary**: the text field stays required, the image
is an optional illustration alongside it. This is additive — every
existing item and card keeps working unchanged with `imageUrl = NULL`.

## Constraints & Decisions
(Inherits the project's constraints: passcode gate via `middleware.ts`,
Prisma-only DB access, own pure logic modules, `AlertDialog` instead of
native `alert`.)

- One optional image per sort item; one optional image on the flashcard
  **front only** (back stays text-only — confirmed with user).
- Text remains **required and non-blank** on every item and on both card
  sides even when an image is present (confirmed with user).
- Image files are stored in **Vercel Blob** (`@vercel/blob`), uploaded
  **from the user's device** via a single server-side upload route
  (confirmed with user). The database stores only the resulting public
  URL string.
- Upload path is **server upload**: browser → `POST /api/upload` →
  `put()` → Blob → `{ url }` back. Vercel caps a route body at 4.5 MB, so
  the client widget rejects files larger than 4 MB before uploading.
- The upload route is covered by the existing session middleware
  (`middleware.ts` matches everything except `api/login`), so it requires
  a valid session like every other write endpoint. No middleware change
  needed.
- If `BLOB_READ_WRITE_TOKEN` is not configured, `/api/upload` returns
  HTTP 503 with `{ error: "storage not configured" }` — a clear failure,
  not a crash.
- Migration is additive only: `SortItem` and `Flashcard` each gain a
  nullable `imageUrl` column. Generated with `prisma migrate dev` against
  the local SQLite dev database. Production Turso is migrated separately
  by the user via `scripts/apply-turso-migrations.mjs`, which
  auto-discovers the new migration directory.
- Images render with a plain `<img loading="lazy">` (not Next.js
  `<Image>`) to avoid remote-pattern configuration and image-optimization
  infrastructure.

## Data Model
`prisma/schema.prisma`:
```prisma
model SortItem {
  id         String       @id @default(cuid())
  setId      String
  set        SortSet      @relation(fields: [setId], references: [id], onDelete: Cascade)
  categoryId String
  category   SortCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  text       String
  imageUrl   String?
}

model Flashcard {
  id       String       @id @default(cuid())
  setId    String
  set      FlashcardSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  front    String
  back     String
  imageUrl String?
}
```
`Flashcard.imageUrl` is the front-side image; there is no back-side image
column.

One new Prisma migration is generated (`prisma migrate dev`) containing
two `ALTER TABLE ... ADD COLUMN "imageUrl" TEXT;` statements. Adding a
nullable column with no default is safe on both SQLite and libSQL and
needs no backfill — existing rows read back `imageUrl = NULL`.

## Storage & Upload Route
New dependency: `@vercel/blob`.

New file `app/api/upload/route.ts` — `POST` only:
- Reads a single file from `multipart/form-data` (field name `file`).
- Rejects (`400`) when: no file, `file.type` does not start with
  `image/`, or `file.size` > 4 MB.
- Rejects (`503`, `{ error: "storage not configured" }`) when
  `process.env.BLOB_READ_WRITE_TOKEN` is unset.
- On success: `put(\`uploads/${crypto.randomUUID()}-${safeName}\`, file,
  { access: "public", contentType: file.type })` and returns
  `{ url }` (HTTP 201). `safeName` is `file.name` with any character
  outside `[A-Za-z0-9._-]` replaced by `_`.
- No auth logic in the handler itself — `middleware.ts` already blocks
  unauthenticated requests to `/api/*` before the handler runs.

Environment variable `BLOB_READ_WRITE_TOKEN`: set automatically by Vercel
when a Blob store is attached to the project; for local development the
user pulls it with `vercel env pull` or sets a value manually in `.env`.
Documented in the implementation plan, not enforced at build time.

## Shared Upload Component
`components/ImageUploadField.tsx` — a small client component used by both
edit pages.
```typescript
type Props = {
  value: string | null;               // current image URL, or null
  onChange: (url: string | null) => void;
  label?: string;                      // e.g. "รูปด้านหน้า"
};
```
Behavior:
- No image: shows a "+ เพิ่มรูป" button that opens a hidden
  `<input type="file" accept="image/*">`.
- On file pick: client-side size check (≤ 4 MB) → `POST /api/upload` with
  `FormData` → on success calls `onChange(url)`; on failure shows the
  error text inline (red, below the control) and keeps the previous
  value. A `uploading` state disables the control and shows "กำลังอัป
  โหลด...".
- Has image: shows a thumbnail (`max-height: 96px`, `object-fit:
  contain`) with an "✕ ลบรูป" control that calls `onChange(null)`.
  Replacing is remove-then-add (no in-place swap needed).
- The component only ever reports a URL upward; persistence happens when
  the page's existing Save button fires its PUT.

## Wire Format & API Changes

### Sort — `app/api/sort-sets/[id]/route.ts`
`GET` response `items[]` entries gain `imageUrl`:
```json
{ "id": "...", "text": "...", "categoryId": "...", "imageUrl": null }
```
`PUT` request body: the nested `CategoryTreeInput.items` changes from
`string[]` to an array of objects:
```typescript
type ItemInput = { text: string; imageUrl: string | null };
type CategoryTreeInput = {
  name: string;
  items: ItemInput[];        // only meaningful when children is empty
  children: CategoryTreeInput[];
};
```
Changes inside the route:
- `parseCategoryTree`: parse each item as `{ text, imageUrl }` — `text`
  trimmed and required non-blank (an item with blank text is dropped,
  same as today); `imageUrl` accepted only as a non-empty string,
  otherwise coerced to `null`.
- `validateTree` / `collectLeaves`: unchanged logic — they read
  `items.length`, which still works.
- The `flatten` step that builds `itemRows` for `createMany` includes
  `imageUrl` on each row.
- The bulk-insert optimization from commit `bc164f5` is preserved
  as-is; only the row shape gains a field.

### Flashcard — `app/api/flashcard-sets/[id]/route.ts`
`PUT` request body `cards[]` entries gain an optional `imageUrl`:
```typescript
{ front: string; back: string; imageUrl: string | null }
```
Changes inside the route:
- The per-card loop still requires non-blank `front` and `back`;
  `imageUrl` is accepted only as a non-empty string, else `null`.
- The `cards: { create: cards }` nested write includes `imageUrl`.
`GET` already returns the full set via `include: { cards: true }`, so
`imageUrl` flows through automatically with no code change.

## Pure Logic Modules
`lib/sort-game.ts` — `Item` type gains the field:
```typescript
export type Item = { id: string; text: string; categoryId: string; imageUrl?: string | null };
```
`lib/flashcard-game.ts` — `Card` type gains the field:
```typescript
export type Card = { id: string; front: string; back: string; imageUrl?: string | null };
```
No function behavior changes: `shuffleItems`, `isCorrectCategory`,
`shuffleCards`, `moveToBack`, and `buildQuizChoices` all operate on
`id` / `categoryId` / `back` and simply carry the new field along
untouched. Quiz choices remain the card `back` strings — text only.

## Edit Pages

### `app/sort/edit/[id]/page.tsx`
- `CategoryInput.items` changes from `string[]` to
  `{ text: string; imageUrl: string | null }[]`.
- Touched helpers: `updateItem` (now updates `text` on the object),
  `addItem` (pushes `{ text: "", imageUrl: null }`), `removeItem`
  (unchanged), `buildTree` (emits `ItemInput[]`), and the `save()`
  pre-validation (still checks `text` non-blank; image is never
  required).
- Load path: GET's flat `items` are grouped into each category's local
  `items` array as `{ text, imageUrl }`.
- Each item row renders the existing text input plus
  `<ImageUploadField value={item.imageUrl} onChange={...} />`.

### `app/flashcard/edit/[id]/page.tsx`
- `CardInput` gains `imageUrl: string | null` (defaults to `null` in
  `addCard`, populated from GET on load).
- `save()`'s `cleanCards` mapping carries `imageUrl` through; the
  non-blank `front`/`back` filter is unchanged.
- The front half of each card row renders `<ImageUploadField>` under the
  existing "ด้านหน้า" input.

## Play Pages

### `app/sort/play/[id]/page.tsx`
- Data still fetched as flat `Item[]` (now each item may carry
  `imageUrl`).
- Item buttons — in the pool groups and in each leaf category's placed
  list — render, when `item.imageUrl` is set, a `<img loading="lazy">`
  (`max-height: 90px`, `max-width: 100%`, `object-fit: contain`) above
  the existing `{item.text}`. Layout stays a vertical stack inside the
  same button element; the FLIP slide animation is unaffected (it moves
  the whole button).

### `app/flashcard/play/[id]/page.tsx`
- `Card` type carries `imageUrl`.
- Flip mode: when showing the **front** and `current.imageUrl` is set,
  render the image (`max-height: 200px`, `object-fit: contain`) above
  `current.front`. The back face is unchanged.
- Quiz mode: the question block (`currentQuizCard.front`) renders the
  image the same way above the question text. The choice buttons are
  unchanged — they show `back` strings.

## Styling
Image sizing rules live in the relevant `page.module.css` files
(`sort/play`, `flashcard/play`, `sort/edit`, `flashcard/edit`) and the
component's own styles. No global CSS changes. All images use
`object-fit: contain` and a `max-width: 100%` cap so wide images never
break layout.

## Error Handling
- Upload failures (network, 400, 503) surface inline in
  `ImageUploadField` as red text; the field keeps its prior value. No
  new global error infrastructure.
- Edit-page save validation continues to use the existing `AlertDialog`.
- A broken/removed image URL at play time degrades to the browser's
  default broken-image glyph; text is always present as the fallback, so
  the game stays playable. Not specially handled.

## Testing
- `lib/sort-game.test.ts` / `lib/flashcard-game.test.ts`: add cases
  proving `shuffleItems` / `shuffleCards` / `buildQuizChoices` preserve
  `imageUrl` and that quiz choices are still drawn from `back` text only.
- API route tests:
  - Sort `PUT` with an item carrying `imageUrl` → `GET` returns it;
    an item with blank text is still dropped even if it has an
    `imageUrl`.
  - Flashcard `PUT` with `imageUrl` → `GET` returns it; a card with a
    blank `front` or `back` is still rejected even with an `imageUrl`.
  - `/api/upload`: unauthenticated request blocked by middleware;
    non-image file → 400; > 4 MB → 400; missing token → 503; valid
    image → 201 `{ url }` (with `put` mocked).
- Manual verification: in each editor, add an image to an item/card,
  save, reload the editor and confirm the image round-trips; play both
  games and confirm the image shows in the pool, in placed slots, on the
  flashcard front, and in the quiz question; confirm a pre-migration set
  with no images still loads and plays unchanged.

## Out of Scope
- Deleting the Blob object when an image is replaced or removed —
  orphaned blobs are left in the store for this iteration.
- Back-side flashcard images.
- Multiple images per item/card, cropping, rotation, drag-and-drop
  upload, paste-from-clipboard.
- Next.js `<Image>` optimization / responsive `srcset`.
- Any change to the matching game or the passcode gate.
- Image use in the matching game.
