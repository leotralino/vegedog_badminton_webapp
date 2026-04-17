# Development Guide

This guide walks through setting up one environment (prod). Repeat for dev, substituting dev values where noted.

---

## 1. Deploy to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new)
2. Choose a region close to your users (e.g. `us-west-1` for US West Coast)
3. Skip env vars for now — we'll add them after setting up Supabase
4. Deploy. Note your app URL: `https://your-app.vercel.app`

---

## 2. Create Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Choose the **same region** as your Vercel deployment (reduces latency)
3. Run `supabase/schema.sql` in the SQL editor

**Collect these values** (Settings → API):

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key |

---

## 3. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 client (Web application type)
3. Under **Authorized redirect URIs**, add:
   ```
   https://<your-supabase-ref>.supabase.co/auth/v1/callback
   ```
   *(This tells Google to hand control back to Supabase after sign-in)*
4. Save. **Collect these values**:

| Variable | Where to find it |
|----------|-----------------|
| `GOOGLE_CLIENT_ID` | OAuth client → Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client → Client Secret |

5. In Supabase: **Authentication → Providers → Google** → enter Client ID and Client Secret

---

## 4. Configure Supabase URL Settings

In Supabase: **Authentication → URL Configuration**

| Field | Value | Why |
|-------|-------|-----|
| Site URL | `https://your-app.vercel.app` | Where users land after magic link / OAuth login |
| Redirect URLs | `https://your-app.vercel.app/**` | Allows any path on your app as a valid redirect target |

> If this is wrong, login will redirect users to the wrong host after sign-in.

---

## 5. Set Environment Variables

### In Vercel (Settings → Environment Variables)

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | from step 2 | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 2 | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 2 | Production |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Production |
| `GMAIL_USER` | your Gmail address | Production |
| `GMAIL_APP_PASSWORD` | Gmail app password* | Production |
| `COURT_EMAIL` | court's email address | Production |

*Gmail → Google Account → Security → App Passwords (requires 2FA)

### In `.env.local` (local dev only, never commit)

Same variables as above, but using **dev** Supabase project values and dev `NEXT_PUBLIC_SITE_URL`.

```bash
cp .env.local.example .env.local
# fill in with dev project values
```

---

## 6. Redeploy Vercel

After setting env vars, trigger a redeploy so the build picks them up:
Vercel → Deployments → find latest → Redeploy.

---

## Dev Environment

Repeat steps 2–6 for a second Supabase project (dev). The only differences:

- Supabase Site URL → your Vercel **preview** URL (e.g. `https://your-app-git-develop-xxx.vercel.app`)
- In Vercel, set the dev Supabase vars under **Preview + Development** environments (not Production)
- In Google Console, add the dev Supabase callback URI alongside the prod one:
  ```
  https://<your-dev-ref>.supabase.co/auth/v1/callback
  ```

> Google OAuth changes can take up to a few hours to propagate. Use magic link login in the meantime.

---

## Local Dev

```bash
git clone https://github.com/leotralino/vegedog_badminton_webapp.git
cd vegedog_badminton_webapp
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Branching Strategy

| Branch | Deploys to | DB |
|--------|-----------|-----|
| `main` | Production | prod DB |
| `develop` | Vercel preview URL | dev DB |

Merge `develop` → `main` via PR to ship to production.

---

## E2E Tests

Tests use [Playwright](https://playwright.dev/) and cover the core session lifecycle: create, join, +1, withdraw, waitlist, lock, 加时, payment.

**Setup:** create a dedicated test account (email + password) in your dev Supabase project (Authentication → Users → Add user), then add to `.env.local`:

```
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=your-test-password
```

**Run** (requires `npm run dev` running):

```bash
npm run test:e2e        # headless
npm run test:e2e:ui     # Playwright visual UI (recommended first time)
```

---

## DB Keep-Alive

The dev Supabase project (free tier) pauses after 1 week of inactivity. A daily cron at `/api/ping` (configured in `vercel.json`) queries the DB to keep it alive automatically.
