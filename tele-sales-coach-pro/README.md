# Tele Sales Coach Pro

Production-ready Vite + React app for tele sales call scorecards, coaching dashboard, Excel export, AI transcript scoring and optional audio transcription.

## What is included

- 5 scorecard categories, 1–4 scoring
- Behavioral scoring anchors
- Metadata fields: seller, customer/company, call ID, review type, outcome
- Coaching focus and next actions
- Saved evaluations
- LocalStorage fallback mode
- Optional Supabase login + database mode
- CSV export for Excel
- JSON backup / import
- Manager dashboard
- Skill heatmap
- Seller leaderboard
- Trend chart
- AI transcript scoring via `/api/score`
- Audio transcription via `/api/transcribe`
- Deploy-ready for Vercel

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Vercel deploy

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Add `OPENAI_API_KEY` as a Vercel environment variable if you want AI features.
4. Add Supabase variables if you want cloud sync and login.
5. Deploy.

## Supabase setup, optional but recommended for real team use

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql` from this project.
4. Add these to Vercel env vars:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Without Supabase, the app works fully in one browser using localStorage.

## Privacy note

- Local mode stores data only in the browser.
- Supabase mode stores evaluations in your Supabase project.
- AI scoring sends transcript/audio to your own Vercel serverless API route, which then calls OpenAI using your server-side key.
