# Learnly

## Local development
0. `cp .env.example .env` (prerequisite — sets `DATABASE_URL` for Prisma)
1. `npm install`
2. `npm run prisma:migrate` (creates local `dev.db`)
3. `npm run dev` — open http://localhost:3000

## Run tests
`npm test`

## Deploy (free tier)
1. Create a free database at https://turso.tech, note the DB URL and auth token.
2. Push the schema to Turso: `prisma migrate deploy` cannot target a `libsql://` URL directly (the schema's `sqlite` datasource only accepts `file:` URLs). Instead, after creating the Turso DB, apply each migration file in order via the Turso CLI:
   `turso db shell <your-db-name> < prisma/migrations/20260826163255_init/migration.sql`
   `turso db shell <your-db-name> < prisma/migrations/20260826173652_add_sort_game/migration.sql`
   `turso db shell <your-db-name> < prisma/migrations/20260827075158_add_flashcard_game/migration.sql`
   (check `prisma/migrations/` for the current list — apply any new migration directories the same way, in order, as they're added).
3. Push this repo to GitHub.
4. Import the repo into https://vercel.com, set environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
5. Deploy. Vercel builds with `npm run build` automatically.
