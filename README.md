# Hifz Journal

A Quran memorization tracking app with community features.

## Setup

### 1. Supabase Database
1. Go to your Supabase project → SQL Editor → New query
2. Paste the entire contents of `schema.sql` and click Run
3. That's it — all tables and security rules are created automatically

### 2. Deploy to Vercel
1. Create a free account at vercel.com
2. Install Vercel CLI (optional) or use the web interface
3. **Option A — Web (easiest):**
   - Go to vercel.com → New Project
   - Upload this folder as a zip, OR connect your GitHub repo
   - Click Deploy — done
4. **Option B — GitHub:**
   - Push this folder to a GitHub repository
   - Go to vercel.com → New Project → Import from GitHub
   - Select your repo → Deploy

### 3. You're live
Your site will be at `https://your-project.vercel.app`

## Features
- Sign up / sign in with email
- Log memorization sessions (surah, ayah range, confidence)
- Track all 114 surahs with progress bars
- Revision queue sorted by longest untouched
- Activity heatmap
- Daily commitment calculator
- Community creation and joining
- Leaderboards (surahs memorized, streak, revision consistency)
- Profile and stats

## Tech stack
- Plain HTML/CSS/JS frontend
- Supabase (auth + database)
- Deployed on Vercel (free)
