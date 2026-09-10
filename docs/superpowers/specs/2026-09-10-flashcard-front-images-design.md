# Images on Flashcard Fronts — Design

## Purpose
The flashcard game currently stores only text. The user wants to attach
an optional image to the **front side** (the question side) of each
flashcard.

The image is **supplementary**: the `front` and `back` text fields stay
required, the image is an optional illustration alongside the front text.
This is additive — every existing card keeps working unchanged with
`imageUrl = NULL`.

The sort game is **not** in scope (scope reduced by the user after the
first draft); its items stay text-only.

## Constraints & Decisions
(Inherits the project's constraints: passcode gate via `middleware.ts`,
Prisma-only DB access, own pure logic modules, `AlertDialog` instead of
native `alert`.)

- One optional image on the flashcard **front only** — the back stays
  text-only (confirmed with user).
- `front` and `back` text remain **required and non-blank** even when an
  image is present (confirmed with user).
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
- Migration is additive only: `Flashcard` gains a nullable `imageUrl`
  column. Generated with `prisma migrate dev` against the local SQLite
  dev database. Production Turso is migrated separately by the user via
  `scripts/apply-turso-migrations.mjs`, which auto-discovers the new
  migration directory.
- Images render with a plain `<img loading="lazy">` (not Next.js
  `<Image>`) to avoid remote-pattern configuration and image-optimization
  infrastructure.

## Data Model
`prisma/schema.prisma`:
```prisma
model Flashcard {
  id       String       @id @default(cuid())
  setId    String
  set      FlashcardSet @relation(fields: [setId], references: [id], onDelete: Cascade)
  front    String
  back     String
  imageUrl String?
}
```
`imageUrl` is the front-side image; there is no back-side image column.

One new Prisma migration is generated (`prisma migrate dev`) containing a
single `ALTER TABLE "Flashcard" ADD COLUMN "imageUrl" TEXT;`. Adding a
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
  { access: "public", contentType: file.type })` and returns `{ url }`
  (HTTP 201). `safeName` is `file.name` with any character outside
  `[A-Za-z0-9._-]` replaced by `_`.
- No auth logic in the handler itself — `middleware.ts` already blocks
  unauthenticated requests to `/api/*` before the handler runs.

Environment variable `BLOB_READ_WRITE_TOKEN`: set automatically by Vercel
when a Blob store is attached to the project; for local development the
user pulls it with `vercel env pull` or sets a value manually in `.env`.
Documented in the implementation plan, not enforced at build time.

## Upload Component
`components/ImageUploadField.tsx` — a client component used by the
flashcard edit page. Kept as its own component (not inlined) so its
upload/preview/error state machine can be reasoned about and tested in
isolation.
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
  value. An `uploading` state disables the control and shows "กำลังอัป
  โหลด...".
- Has image: shows a thumbnail (`max-height: 96px`, `object-fit:
  contain`) with an "✕ ลบรูป" control that calls `onChange(null)`.
  Replacing is remove-then-add (no in-place swap needed).
- The component only ever reports a URL upward; persistence happens when
  the page's existing Save button fires its PUT.

## Wire Format & API Changes
`app/api/flashcard-sets/[id]/route.ts`:

`PUT` request body `cards[]` entries gain an optional `imageUrl`:
```typescript
{ front: string; back: string; imageUrl: string | null }
```
Changes inside the route:
- The per-card loop still requires non-blank `front` and `back`;
  `imageUrl` is accepted only as a non-empty string, otherwise coerced
  to `null`.
- The existing `cards: { create: cards }` nested write includes
  `imageUrl`.

`GET` already returns the full set via `include: { cards: true }`, so
`imageUrl` flows through automatically with no code change.

## Pure Logic Module
`lib/flashcard-game.ts` — the `Card` type gains the field:
```typescript
export type Card = { id: string; front: string; back: string; imageUrl?: string | null };
```
No function behavior changes: `shuffleCards`, `moveToBack`, and
`buildQuizChoices` all operate on `id` / `back` and simply carry the new
field along untouched. Quiz choices remain the card `back` strings —
text only.

## Edit Page — `app/flashcard/edit/[id]/page.tsx`
- `CardInput` gains `imageUrl: string | null` — defaulted to `null` in
  `addCard`, populated from the GET response on load.
- `save()`'s `cleanCards` mapping carries `imageUrl` through unchanged;
  the non-blank `front`/`back` filter is unchanged (a card still needs
  both text sides — an image alone does not make a card valid).
- The front half of each card row renders `<ImageUploadField>` beneath
  the existing "ด้านหน้า" input, wired to that card's `imageUrl`.

## Play Page — `app/flashcard/play/[id]/page.tsx`
- `Card` type carries `imageUrl` (from the shared pure module).
- **Flip mode**: when the card is showing its **front** and
  `current.imageUrl` is set, render `<img loading="lazy">`
  (`max-height: 200px`, `max-width: 100%`, `object-fit: contain`) above
  `current.front`. The back face is unchanged.
- **Quiz mode**: the question block (`currentQuizCard.front`) renders the
  image the same way, above the question text. The choice buttons are
  unchanged — they show `back` strings only.

## Styling
Image sizing rules live in `app/flashcard/play/[id]/page.module.css`,
`app/flashcard/edit/[id]/page.module.css`, and the component's own
styles. No global CSS changes. All images use `object-fit: contain` and
a `max-width: 100%` cap so a wide image never breaks layout.

## Error Handling
- Upload failures (network, 400, 503) surface inline in
  `ImageUploadField` as red text; the field keeps its prior value. No
  new global error infrastructure.
- Edit-page save validation continues to use the existing `AlertDialog`.
- A broken or removed image URL at play time degrades to the browser's
  default broken-image glyph; the front text is always present as a
  fallback, so the game stays playable. Not specially handled.

## Testing
- `lib/flashcard-game.test.ts`: add cases proving `shuffleCards` /
  `moveToBack` / `buildQuizChoices` preserve `imageUrl` and that quiz
  choices are still drawn from `back` text only.
- API route tests (`app/api/flashcard-sets/[id]`):
  - `PUT` with a card carrying `imageUrl` → `GET` returns it.
  - A card with a blank `front` or blank `back` is still rejected even
    when it has an `imageUrl`.
  - `imageUrl` given as an empty string is stored as `null`.
- `/api/upload` tests: unauthenticated request blocked by middleware;
  non-image file → 400; > 4 MB → 400; missing `BLOB_READ_WRITE_TOKEN`
  → 503; valid image → 201 `{ url }` (with `put` mocked).
- Manual verification: in the flashcard editor, add an image to a card
  front, save, reload the editor and confirm the image round-trips; play
  the set and confirm the image shows on the card front in flip mode and
  in the quiz question; confirm the back face and quiz choices are
  unaffected; confirm a pre-migration set with no images still loads and
  plays unchanged.

## Out of Scope
- The sort game — items stay text-only.
- Deleting the Blob object when an image is replaced or removed —
  orphaned blobs are left in the store for this iteration.
- Back-side flashcard images.
- Multiple images per card, cropping, rotation, drag-and-drop upload,
  paste-from-clipboard.
- Next.js `<Image>` optimization / responsive `srcset`.
- Any change to the matching game, the sort game, or the passcode gate.
