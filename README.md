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
