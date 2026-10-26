# Setup and hosting guide

## 1. Create the database

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**.
3. Copy and run `supabase-schema.sql`.
   This creates the festival/task tables, authentication policies, automatic team profiles for new accounts, a backfill for existing accounts, and the public `posters` Storage bucket.
   Poster uploads accept images or PDFs up to 10 MB.
5. After registering the first coordinator, promote that account in SQL Editor:
   `update public.team_profiles set role = 'admin' where email = 'your-email@example.com';`
4. In **Project Settings → API**, copy the project URL and anon key.

## 2. Run the prototype

Open `index.html` directly in a browser. For the most reliable browser behavior, serve the folder with a simple local server such as `npx serve .`.

## 3. Deploy the prototype

1. Create a GitHub repository.
2. Upload this project folder.
3. Import the repository into Vercel.
4. Deploy using the default settings; `vercel.json` configures clean URLs automatically.
   Use `.env.example` as a reference when configuring deployment variables.

## 4. AI festival discovery

Add `OPENAI_API_KEY` in Vercel Environment Variables. The optional `OPENAI_DISCOVERY_MODEL` defaults to `gpt-4.1-mini`. The dashboard sends the signed-in user's session to `/api/discover`; only admins and coordinators can run discovery. Candidates include source URLs and are individually approved before insertion.

## 5. Integrations to connect next

- Supabase Storage for uploaded poster assets
- Google OAuth and Calendar API for calendar events
- Resend API for reminders
- A server-side AI API key for daily festival discovery

Never put API keys in `index.html`, `app.js`, or any committed file. Use Vercel Environment Variables.

## Suggested daily automation

Run once daily:

1. Fetch trusted festival sources.
2. Ask the AI to extract candidate events as structured JSON.
3. Compare candidates with existing festival names and dates.
4. Save candidates as `ai_discovered = true`.
5. Require coordinator approval before creating poster tasks.
