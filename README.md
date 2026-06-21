# PlacementOS Pro

A personal placement-prep operating system — journal, DSA tracker, English practice hub, language/subject progress, projects, interview prep, job application Kanban, an AI mentor for nightly reviews, analytics, and a Placement Readiness Score. Everything syncs across devices through Supabase, and every AI feature works fully without an API key (it falls back to built-in rule-based generation).

This guide assumes you have never used Supabase before. Follow it top to bottom once, in order, and you'll have a working deployed app.

---

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is fastest).
2. Click **New project**.
3. Pick any organization, give the project a name (e.g. `placementos-pro`), set a database password (save it somewhere — you won't need it day-to-day, but keep it), and pick the region closest to you.
4. Click **Create new project** and wait \~2 minutes while it provisions.

## 2. Run the database schema

1. In your new project, open the **SQL Editor** from the left sidebar.
2. Click **New query**.
3. Open `supabase/schema.sql` from this project (it's a single file), copy the entire contents, and paste it into the SQL editor.
4. Click **Run**. It should finish in a few seconds and create 12 tables (profiles, journal_entries, english_logs, dsa_topics, dsa_problems, language_progress, subject_progress, projects, interview_questions, job_applications, mentor_reviews, daily_tasks, goals), each with row-level security already enabled so your data is private to your account.
5. If it errors on `create extension "uuid-ossp"` because it already exists, that's fine — ignore that one line and re-run; everything else will still apply. If any other table fails because it already exists (e.g. you ran this twice), drop the tables first or use a fresh project.

## 3. Get your API keys

1. In your Supabase project, go to **Settings → API**.
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`).
3. Copy the **anon public** key (a long string under "Project API keys").

You'll need both in the next step. The anon key is safe to expose in a frontend app — Supabase's row-level security policies (already created by the schema) are what actually keep your data private, not the secrecy of this key.

## 4. Configure environment variables locally

1. In the project root, copy `.env.example` to a new file named `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the two values from step 3:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your-long-key...
   ```
3. Save the file. `.env` is already in `.gitignore` so it won't get committed or pushed anywhere.

## 5. Run it locally

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Sign up with an email and password — this creates your account directly in your own Supabase project. Every page should load without errors once you're logged in.

---

## 6. Deploy to Netlify

You have two options. **Option A (recommended)** is more reliable for a multi-file project like this one because Netlify rebuilds it cleanly from source every time and you can update it just by pushing to GitHub. Option B works if you don't want to use GitHub.

### Option A — Deploy via GitHub (recommended)

1. Create a new GitHub repository and push this project to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/placementos-pro.git
   git push -u origin main
   ```
2. Go to [app.netlify.com](https://app.netlify.com) and sign in.
3. Click **Add new site → Import an existing project**, choose GitHub, and select your repo.
4. Netlify should auto-detect the settings, but confirm:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Before deploying, click **Add environment variables** (or go to **Site configuration → Environment variables** after the first deploy) and add the same two variables from your `.env` file:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy site**. After the build finishes (\~1-2 minutes), you'll get a live URL like `https://your-site-name.netlify.app`.
7. Any time you push new commits to `main`, Netlify automatically rebuilds and redeploys.

### Option B — Drag-and-drop deploy (no GitHub)

1. Build the project locally:
   ```bash
   npm run build
   ```
   This creates a `dist/` folder.
2. Go to [app.netlify.com](https://app.netlify.com), and drag the `dist` folder onto the deploy area on the dashboard.
3. **Important**: drag-and-drop deploys don't read your `.env` file (env vars only apply at build time, and Netlify isn't building anything here — it's just hosting the files you already built). To fix this, either:
   - Rebuild with the env vars set inline before dragging: `VITE_SUPABASE_URL=https://xxxxx.supabase.co VITE_SUPABASE_ANON_KEY=eyJ... npm run build`, then drag the new `dist` folder, or
   - Switch to Option A, which handles this for you automatically.

## 7. Access from your phone

Once deployed, just open your Netlify URL in your phone's browser and log in with the same email/password — your data syncs instantly through Supabase since both desktop and mobile read from the same database. On Android Chrome or iOS Safari, you can use "Add to Home Screen" from the browser menu to get an app-like icon, though this build doesn't include a full installable PWA manifest/service worker — it's a responsive site that works great in the browser, not an offline-capable installed app.

---

## AI features (optional)

Go to **Settings** inside the app to add an API key for Gemini, OpenAI, or Claude. This unlocks AI-generated English practice prompts and richer Mentor review feedback. Without a key, the app uses built-in rule-based logic for all of the same features — nothing is locked behind AI, it's just smarter with a key.

Gemini's free tier (`gemini-2.0-flash`) is the cheapest way to turn this on if you want to try it.

Your key is encrypted client-side before being saved to your Supabase profile (see the note in Settings for the honest details on what that protects against). If you ever want stronger protection, route AI calls through a Supabase Edge Function instead of calling provider APIs directly from the browser — the abstraction layer in `src/lib/aiProvider.js` is written so that's a contained change.

## Backup & restore

Settings → Backup & restore lets you export your entire account (every journal entry, DSA log, project, etc.) as a single `.json` file, and re-import it later. This is on top of — not a replacement for — the fact that your data already lives safely in Supabase and is available on every device the moment you log in.

## Project structure

```
src/
  pages/          one file per major section (Dashboard, Journal, DSA Tracker, etc.)
  components/     shared UI (gauge, modal, stat cards, layout/sidebar)
  lib/api/        one file per database table — all Supabase reads/writes live here
  lib/aiProvider.js     swaps between Gemini / OpenAI / Claude / rule-based fallback
  lib/ruleBasedFallback.js   the no-API-key version of every AI feature
  lib/readinessScore.js     the weighted formula behind the Placement Readiness gauge
  styles/         design tokens (colors, spacing) + shared component CSS
supabase/
  schema.sql      run this once in Supabase SQL Editor — sets up every table + security policy
```

## Troubleshooting

- **Blank page after deploy / "Failed to fetch" errors**: almost always means the environment variables weren't set in Netlify, or were set but the site wasn't rebuilt after adding them. Trigger a new deploy after confirming both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present in Site configuration → Environment variables.
- **Sign-up works but nothing loads after**: check the Supabase SQL Editor ran the full schema without errors, especially the `profiles` table — there's a trigger that auto-creates your profile row on signup, so if that table or trigger failed to create, the app has nowhere to store your streak/settings.
- **"new row violates row-level security policy"**: this means a write happened without a matching `user_id`, almost always from re-running an incomplete schema. Re-run all of `schema.sql` against a clean project.
