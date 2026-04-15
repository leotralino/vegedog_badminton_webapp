# 菜狗 Architecture Guide

> **Who this is for:** Someone new to web apps who wants to understand how the pieces fit together — the database, the server, the browser, and how users are kept secure.

---

## Table of Contents

1. [Big Picture: How a Web App Works](#1-big-picture-how-a-web-app-works)
2. [Tech Stack](#2-tech-stack)
3. [Data Model (Database Tables)](#3-data-model-database-tables)
4. [Auth: Who Are You?](#4-auth-who-are-you)
5. [Access Control: Who Sees What?](#5-access-control-who-sees-what)
6. [Key User Flows](#6-key-user-flows)
7. [Realtime: Live Updates](#7-realtime-live-updates)
8. [Concurrency: The Race Condition Problem](#8-concurrency-the-race-condition-problem)

---

## 1. Big Picture: How a Web App Works

Think of a web app as three layers:

```
[ Browser / Phone ]  ←──→  [ Next.js Server ]  ←──→  [ Supabase (DB + Auth) ]
  Shows the UI              Renders pages              Stores all data
  Runs your clicks          Runs server code           Enforces who can access what
```

**What happens when you open the app:**
1. Your browser requests a page (e.g., `/sessions/abc123`)
2. Next.js fetches data from Supabase and builds the HTML
3. The HTML arrives in your browser — you see the page
4. The page then sets up a *live connection* so future changes (new joins, payment updates) appear without refreshing

**What happens when you click "加入" (Join):**
1. Browser sends a request to Supabase with your login token
2. Supabase checks: "Is this user allowed to do this?" (RLS — see §5)
3. If yes, runs a function that adds you to the queue
4. Every other user watching that session sees your name appear in ~1 second (Realtime — see §7)

---

## 2. Tech Stack

| Layer | Technology | What it does |
|-------|-----------|--------------|
| **UI Framework** | [Next.js 15](https://nextjs.org) | Renders pages, handles routing (`/sessions`, `/sessions/[id]`, etc.) |
| **Styling** | Tailwind CSS | Utility-class CSS — controls colors, padding, layout |
| **Language** | TypeScript | JavaScript with types, catches bugs before runtime |
| **Database** | PostgreSQL (via Supabase) | Stores all tables, runs stored procedures |
| **Auth** | Supabase Auth | Handles login, sessions, tokens |
| **Realtime** | Supabase Realtime | WebSocket connection for live DB updates |
| **Hosting** | Vercel | Deploys Next.js; auto-rebuilds on git push |

**What is Supabase?**
Supabase is a hosted "backend as a service." Instead of running your own server and database, you use theirs. It gives you:
- A PostgreSQL database
- A REST/RPC API auto-generated from your tables
- Authentication (login, tokens)
- Realtime subscriptions (WebSocket)
- Row-Level Security (access control built into the DB)

---

## 3. Data Model (Database Tables)

Tables are like spreadsheets. Each row is one record, each column is one field. Tables link to each other via **foreign keys** (one table's ID column referenced by another table).

### Entity Relationship Diagram

```
auth.users (Supabase built-in)
    │
    └─── profiles (1:1)
              │
              ├─── sessions (many:1 — one user creates many sessions)
              │         │
              │         ├─── participants (many sessions, many users)
              │         │         │
              │         │         └─── payment_records (1:1 per participant)
              │         │
              │         └─── payment_methods (many per session)
              │
              └─── participants (one user joins many sessions)
```

---

### `profiles`
One row per user. Created automatically when someone signs up.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Same as their Supabase `auth.users` ID |
| `nickname` | text | Display name (e.g., "Yang") |
| `avatar_url` | text | Profile photo URL (DiceBear auto-generated if none) |
| `venmo_username` | text | Venmo handle for payment links |

---

### `sessions`
One row per badminton event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique ID for this event |
| `title` | text | Event name, e.g., "周三菜狗" |
| `location` | text | Venue name |
| `location_address` | text | Full address (for copy-to-maps) |
| `starts_at` | timestamp | Start time (stored as UTC) |
| `withdraw_deadline` | timestamp | After this → withdrawal is "late" and may incur a fee |
| `max_participants` | int | Capacity; beyond this → waitlist |
| `court_count` | int | Number of courts reserved |
| `fee_per_person` | decimal | Cost per player (optional) |
| `late_withdraw_ratio` | decimal | Fee multiplier for late withdrawal (e.g., 0.5 = 50% of fee) |
| `notes` | text | Admin notes shown to all participants |
| `status` | enum | Current state: `open` → `locked` → `closed` (or `canceled`) |
| `initiator_id` | UUID | FK → `profiles.id` of who created this session |

**Status lifecycle:**
```
open  ──(admin locks)──►  locked  ──(admin closes)──►  closed
  └──(admin cancels)──►  canceled
```
- **open**: Accepting new joins and withdrawals
- **locked**: Queue frozen; payment tracking begins
- **closed**: Read-only; moved to history
- **canceled**: Event called off

---

### `participants`
One row per "slot" in a session. A user can have multiple rows in one session (e.g., "+1", "+2" guests).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique slot ID |
| `session_id` | UUID | FK → `sessions.id` |
| `user_id` | UUID | FK → `profiles.id` |
| `display_name` | text | Name shown in the queue |
| `queue_position` | int | Insertion order (used to promote waitlist) |
| `status` | enum | `joined` / `waitlist` / `withdrawn` / `late_withdraw` |
| `stayed_late` | boolean | Admin marks if this person stayed for overtime |
| `joined_at` | timestamp | When they joined |
| `withdrew_at` | timestamp | When they left (null if still in) |

**Status meanings:**
```
joined       → playing (counts toward max_participants)
waitlist     → in line; auto-promoted when a joined player withdraws
withdrawn    → left before deadline (no fee)
late_withdraw → left after deadline (may owe fee)
```

---

### `payment_methods`
The session initiator's payment receivers (e.g., "pay Alice on Venmo").

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique method ID |
| `session_id` | UUID | FK → `sessions.id` |
| `type` | enum | `venmo` / `zelle` / `other` |
| `label` | text | Payee's name (e.g., "Alice") |
| `account_ref` | text | Venmo handle without @ (e.g., "alice-venmo") |
| `amount` | decimal | Per-person amount (e.g., 18.00) |
| `created_by` | UUID | FK → `profiles.id` (always the initiator) |

---

### `payment_records`
One row per participant in a locked session. Tracks who has paid.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique record ID |
| `session_id` | UUID | FK → `sessions.id` |
| `participant_id` | UUID | FK → `participants.id` (unique — one record per person) |
| `base_fee` | decimal | Core session cost |
| `late_fee` | decimal | Penalty for late withdrawal |
| `status` | enum | `unpaid` / `paid` / `waived` |
| `note` | text | Optional admin note |

**Auto-created by DB trigger** when session is locked — every `joined` participant gets an `unpaid` record automatically.

---

## 4. Auth: Who Are You?

### Login Methods

| Method | How it works |
|--------|-------------|
| **Google OAuth** | Click "Sign in with Google" → redirected to Google → come back logged in |
| **Magic Link** | Enter email → get a one-time link → click it → logged in (no password needed) |
| **Email + Password** | Classic signup and login |

### What "logged in" means technically

When you log in, Supabase gives your browser a **JWT token** (a cryptographically signed string that says "I am user X"). Your browser stores this token in a cookie. Every request you make to Supabase includes this token, so Supabase knows who you are.

If the token is missing or expired → you're treated as an anonymous visitor.

### Route Protection

The file `src/middleware.ts` runs on every page request before Next.js renders anything. It checks if you have a valid token:

- If **not logged in** and you try to visit `/sessions`, `/history`, or `/settings` → redirected to `/login?next=/sessions` (will send you back after login)
- `/login` and `/auth/*` are always accessible

### Roles

There are no custom database roles. Instead, three levels of access are enforced by **who the user is relative to the data**:

| "Role" | Who | How it's enforced |
|--------|-----|-------------------|
| **Anonymous** | Not logged in | Supabase token is null; most RLS policies block writes |
| **Authenticated user** | Logged in | `auth.uid()` matches their own rows |
| **Session initiator (admin)** | The user who created a session | `auth.uid() = sessions.initiator_id` checked per-action |

There is no global "admin" account — someone is only "admin" for sessions they created.

---

## 5. Access Control: Who Sees What?

Supabase uses **Row-Level Security (RLS)**. Every table has a set of policies — rules written in SQL that decide if a query is allowed. Even if a bug in the frontend skips a UI check, RLS ensures the database itself rejects unauthorized writes.

Think of it as: each row in each table has a bouncer. Before you can read, write, or delete it, the bouncer checks if you're allowed.

### `profiles` (user info)

| Action | Who | Rule |
|--------|-----|------|
| Read any profile | Everyone | Always allowed — profiles are public |
| Edit a profile | Only yourself | Your user ID must match the row's ID |

### `sessions` (events)

| Action | Who | Rule |
|--------|-----|------|
| Read any session | Everyone | Always allowed |
| Create a session | Any logged-in user | You must set yourself as `initiator_id` |
| Lock / cancel / close | Only the initiator | Your user ID must match `initiator_id` |

### `participants` (queue entries)

| Action | Who | Rule |
|--------|-----|------|
| Read all entries | Everyone | Always allowed — the queue is public |
| Join (insert) | Only yourself | `user_id` must be your own ID |
| Withdraw (update own) | Only yourself | `user_id` must match your ID |
| Toggle `stayed_late` | Session initiator only | Your ID must match the session's `initiator_id` |

### `payment_methods` (who to pay)

| Action | Who | Rule |
|--------|-----|------|
| Read | Everyone | Always allowed |
| Add / edit / delete | Session initiator only | Your ID must match the session's `initiator_id` |

### `payment_records` (who has paid)

| Action | Who | Rule |
|--------|-----|------|
| Read | Any logged-in user | You must be authenticated (logged in) |
| Mark yourself paid | Only yourself | Your participant row must belong to you |
| Update your own status | Only yourself | Same as above |

> **Note:** Admins cannot mark OTHER people as paid directly — payment records are self-reported. The initiator can see everyone's status but must ask them to update it themselves (or use a waiver note).

### Summary Table

```
Table               | anon read | auth read | self write | initiator write
--------------------|-----------|-----------|------------|----------------
profiles            |    ✓      |    ✓      |  own only  |      —
sessions            |    ✓      |    ✓      |  own only  |  lock/close/cancel
participants        |    ✓      |    ✓      |  own only  |  stayed_late toggle
payment_methods     |    ✓      |    ✓      |     —      |  full CRUD
payment_records     |    ✗      |    ✓      |  own only  |      —
```

---

## 6. Key User Flows

### Join a Session

```
User clicks "加入"
    │
    ├─ Optimistic UI: name added to list instantly (with temp ID)
    │
    └─ DB: calls join_session(sessionId, userId, displayName) RPC
              │
              ├─ Acquires advisory lock on session (prevents race conditions)
              ├─ Checks: session is 'open'
              ├─ Checks: no duplicate name for this user in this session
              ├─ Counts current 'joined' participants
              │
              ├─ if count < max_participants → status = 'joined'
              └─ else → status = 'waitlist'
              
              Inserts participant row → returns new row
              
    Browser refreshes from DB (replaces temp ID with real UUID)
    Other viewers see the new entry via Realtime
```

### Withdraw

```
User clicks "–" (minus) button on their entry
    │
    ├─ Optimistic UI: entry hidden immediately
    │
    └─ DB: calls withdraw_participant(participantId, userId) RPC
              │
              ├─ Checks user owns this entry
              ├─ if now() > withdraw_deadline → status = 'late_withdraw'
              └─ else → status = 'withdrawn'
              
              Auto-promotion: if there's a waitlisted player,
              promote the one with lowest queue_position to 'joined'
              
    Other viewers see the queue update via Realtime
```

### Lock Session (Admin Only)

```
Admin clicks "🔒 锁定接龙"
    │
    ├─ Updates sessions.status → 'locked'
    │
    └─ DB trigger fires automatically (on_session_locked):
              │
              └─ For each 'joined' participant with no payment record:
                    Insert payment_record(status='unpaid', base_fee=0, late_fee=0)
    
    Admin adds payment methods (Venmo handles + amounts)
    Participants can now self-report payment
```

### Pay via Venmo Deep Link

```
User clicks "Venmo 付款"
    │
    ├─ Builds URL: venmo://paycharge?txn=pay&recipients=HANDLE&amount=X&note=SESSION @NICKNAME
    ├─ Sets window.location.href to venmo:// URL
    │       └─ If Venmo app installed → app opens with pre-filled form
    │
    └─ After 1.5 seconds (fallback):
            Opens https://venmo.com/HANDLE in new tab
            (in case app wasn't installed)
```

### Move to History (Admin Only)

```
Admin clicks "📁 移动到历史"
    │
    ├─ Confirm dialog
    └─ Updates sessions.status → 'closed'
    
    Session disappears from active list
    Appears in /history
    ALL edits disabled (RLS + UI checks enforce read-only)
```

---

## 7. Realtime: Live Updates

When you're on a session detail page, the app maintains a persistent **WebSocket connection** to Supabase. This is like a phone call that stays open — instead of asking "anything new?" every second, the server calls you when something changes.

**What's being watched:**

| Table | Filter | What triggers an update |
|-------|--------|------------------------|
| `participants` | This session's ID | Someone joins, withdraws, or admin toggles stayed_late |
| `payment_records` | This session's ID | Someone marks themselves paid/unpaid |

When either table changes, the app re-fetches the latest data and re-renders. This is why you see other people's names appear in the queue without refreshing.

**Setup (simplified):**
```typescript
supabase
  .channel('session-xyz')
  .on('postgres_changes', { table: 'participants', filter: 'session_id=eq.xyz' }, refreshParticipants)
  .on('postgres_changes', { table: 'payment_records', filter: 'session_id=eq.xyz' }, refreshPayRecords)
  .subscribe()
```

The channel is cleaned up when you navigate away from the page.

---

## 8. Concurrency: The Race Condition Problem

Imagine 10 people try to join the last available spot at exactly the same time. Without protection:

1. All 10 query: "are there slots?" → all see 1 slot available
2. All 10 insert: "I'm joined!" → 10 people added to a 1-slot vacancy

**Solution: PostgreSQL Advisory Locks**

The `join_session` function calls `pg_advisory_xact_lock(session_id)` at the start. This is a database-level mutex — only one transaction can hold the lock for a given session at a time. All other calls wait in line.

```
User A, B, C all call join_session at the same time
    │
    ├─ User A acquires lock → runs → sees 1 slot → joins as 'joined' → releases lock
    ├─ User B acquires lock → runs → sees 0 slots → joins as 'waitlist' → releases lock
    └─ User C acquires lock → runs → sees 0 slots → joins as 'waitlist' → releases lock
```

Result: exactly one person gets the last "joined" slot. The rest go to waitlist. No double-booking.

---

## File Map

```
src/
├── app/
│   ├── (tabs)/               # Routes with tab navigation
│   │   ├── sessions/         # Active sessions list
│   │   ├── history/          # Past sessions
│   │   └── settings/         # User profile
│   ├── sessions/
│   │   ├── [id]/
│   │   │   ├── page.tsx                  # Server component: fetches session data
│   │   │   └── SessionDetailClient.tsx   # Client component: all interactive logic
│   │   └── new/page.tsx                  # Create session form
│   ├── login/page.tsx                    # Login UI
│   └── auth/callback/route.ts            # OAuth redirect handler
├── lib/
│   ├── types.ts              # TypeScript type definitions for all DB tables
│   └── supabase/
│       ├── client.ts         # Supabase browser client
│       └── server.ts         # Supabase server client (uses cookies)
└── middleware.ts              # Auth guard — runs before every page

supabase/
├── schema.sql                # All tables, RLS policies, initial triggers
└── patches.sql               # Incremental fixes applied after initial deploy
```
