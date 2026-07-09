# PlacementOS Pro

A personal placement-prep operating system — journal, DSA tracker, English practice hub,
language/subject progress, projects, interview prep, job application Kanban, an AI mentor
for nightly reviews, analytics, and a Placement Readiness Score. Data syncs across devices
via Supabase; AI features fall back to built-in rule-based generation without an API key.

## Stack
- React 18 + React Router, built with Vite (PWA plugin enabled)
- Supabase (Postgres + Auth) as the backend — schema lives in `supabase/schema.sql`
- Recharts for analytics, lucide-react for icons

## Running on Replit
- The `Start application` workflow runs `npm run dev` (Vite) on port 5000.
- Vite is configured with `host: '0.0.0.0'` and `allowedHosts: true` so the Replit
  preview proxy can reach it.
- Requires two secrets (already configured): `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`, from the user's own Supabase project (Settings → API).
  The anon key is safe to expose client-side; row-level security in
  `supabase/schema.sql` protects data per-account.
- To point at a different Supabase project, update those two secrets and restart
  the workflow.

## User preferences
None recorded yet.
