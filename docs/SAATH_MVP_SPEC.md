# Saath MVP — Technical Spec

Meet through real plans, not endless profiles. Small hosted group plans (4–8 people), private intentions, and double-blind matching after the plan.

This spec is written for a launch on free tiers only. The whole backend is one Supabase project on the free plan. There is no separate API server, no Redis and no paid third-party services.

## 1. Architecture

~~~mermaid
flowchart LR
  subgraph Client["Expo app (SDK 57, Expo Router, NativeWind)"]
    UI[Screens] --> RQ[TanStack Query]
    UI --> ZS[Zustand: session/account]
    RQ --> SB[supabase-js]
  end
  subgraph Supabase["Supabase free tier"]
    AUTH[Auth: email OTP]
    PG[(Postgres + PostGIS\nRLS + RPC functions)]
    RT[Realtime: chat]
    ST[Storage: photos, selfies]
    CRON[pg_cron: tick every 5 min, push every 1 min]
    NET[pg_net]
  end
  SB --> AUTH
  SB -->|rpc / select| PG
  SB -->|subscribe| RT
  SB -->|signed URLs| ST
  RT --- PG
  CRON --> PG
  PG --> NET -->|HTTP| EXPO[Expo Push API, free]
  PRISMA[Prisma schema] -. generates .-> PG
~~~

What replaced what, and why:

| Original stack item | MVP choice | Cost | Upgrade path |
|---|---|---|---|
| Node/Express or NestJS API | Postgres functions called via supabase.rpc, guarded by RLS | Free | Add an Edge Function or small server only when logic outgrows SQL |
| Prisma ORM | Prisma owns the schema and generates migration 1; the app calls Supabase directly | Free | Use Prisma Client in a server later |
| Redis + BullMQ | pg_cron running saath_tick() | Free | BullMQ when jobs need retries/fan-out at scale |
| Socket.io | Supabase Realtime postgres_changes (RLS-filtered) | Free | — |
| Phone OTP | Email OTP (Supabase built-in) | Free | Phone OTP via Twilio/MSG91 once there is revenue |
| Persona liveness | Selfie with a random gesture, reviewed by a moderator | Free | Persona/IDfy when volume grows |
| Stripe/Razorpay | Price breakdown shown in-app, paid to host at venue (provider FREE) | Free | Razorpay: add a HELD → CONFIRMED webhook step |
| S3 | Supabase Storage, private buckets, client-side resize to 1200px JPEG | Free (1 GB) | — |
| PostHog, OpenAI moderation | Not wired in the MVP; reports go to an in-DB queue | Free | Both have free tiers; add in sprint 4+ |

Free-tier limits to watch: 500 MB database, 1 GB storage, 50k monthly active auth users, 200 concurrent realtime connections, and projects pause after 7 days without activity. Supabase's built-in email sender is rate-limited (a few emails per hour), so connect a free SMTP provider (Resend or Brevo free plan) before launch.

## 2. Database

- prisma/schema.prisma — source of truth for tables, enums and indexes (validated with Prisma 6.16.2).
- supabase/migrations/…001_schema.sql — generated from Prisma (prisma migrate diff).
- supabase/migrations/…002_app.sql — CHECK constraints, RLS policies, column grants, triggers and every RPC.
- supabase/migrations/…003_platform.sql — Realtime publication, storage buckets and policies, push dispatch, cron schedules.
- supabase/tests/logic.test.mjs — runs all three migrations on an in-memory Postgres (PGlite, with Supabase auth/storage/cron stubbed) and exercises the full flow: 70+ assertions covering privacy, booking, waitlists, blocking, check-in, matching and deletion.

Models: User (private fields: gender, dating preferences, verification), UserIntent (private), Profile, ProfilePhoto, CatchmentArea (PostGIS boundary + centroid, currency, timezone, emergency number), UserCatchment, Venue (public area label vs. private address), Host, Event, EventBooking, PostEventInteraction, EventFeedback, Match, Message, EventChannelMessage, SafetyReport, UserBlock, Notification (push outbox).

Location-agnostic by design: a new city is only new CatchmentArea rows. Users pick 1–3 catchments; nobody's live location is tracked, and the venue address is revealed only to confirmed attendees and the host.

Privacy rules enforced in the database, not the app:

- Intents, gender and dating preferences are readable only by their owner.
- Nobody can read picks made about them; picks are write-once.
- Blocked pairs never see each other's profiles, photos or shared plans, and cannot book the same plan.
- Clients cannot read Venue addresses or Event check-in codes directly; RPCs decide who sees them.

## 3. API (Supabase RPC + Realtime)

All calls use the user's session JWT. Errors come back as short codes (e.g. event_not_bookable) that the app maps to friendly text.

| Area | Call | Notes |
|---|---|---|
| Auth | auth.signInWithOtp / verifyOtp | Email OTP; a trigger creates the User row |
| Onboarding | rpc complete_onboarding | DOB (21–35, locked once set), name, intents, 1–3 catchments, preferences |
| Verification | rpc start_verification → upload to verification bucket → rpc submit_verification | Moderator runs review_verification(user, true/false) in the SQL editor |
| Profile | update Profile, insert/delete ProfilePhoto | Column-level grants limit what can change |
| Discovery | rpc discover_events(catchment, from, to, max price, format, language, dietary, alcohol) | Hides plans with blocked users |
| Detail | rpc event_detail(id) | Address only for confirmed/host; code only for host |
| Booking | rpc book_event, rpc cancel_booking | Row-locked; full plans waitlist; cancellations auto-promote |
| My plans | rpc my_plans, rpc event_members | |
| Hosting | rpc host_create_event, host_cancel_event, host_roster, host_set_attendance | Host must be APPROVED; start ≥ 6 h ahead |
| Check-in | rpc check_in(event, code) | 4-digit code shown by host, valid from 30 min before start |
| Matching | rpc matching_candidates, rpc submit_post_event | Feedback + picks in one private submission |
| Matches | rpc my_matches, rpc unmatch; insert Message | |
| Safety | insert SafetyReport, insert/delete UserBlock | Severity set server-side; CRITICAL pages moderators |
| Account | rpc delete_my_account | Cancels bookings/hosted plans, anonymises, deletes auth user |
| Realtime | channel on Message (match), EventChannelMessage (event), Match | Rows filtered by RLS |

Scheduled job saath_tick() every 5 minutes: auto-cancel plans under minimum 3 h before start, send reminders 2 h before, close waitlists at start, mark plans completed, open matching 2 h after the end (unchecked attendees become no-shows), close matching at 24 h and reveal matches, purge group chats 48 h after the plan.

## 4. Double-blind matching

~~~mermaid
stateDiagram-v2
  [*] --> NOT_OPEN: plan published
  NOT_OPEN --> NOT_OPEN: check-ins during plan
  NOT_OPEN --> OPEN: endsAt + 2h (no-shows marked, attendees notified)
  OPEN --> OPEN: each attendee submits private picks once
  OPEN --> CLOSED: endsAt + 24h → compute_matches()
  CLOSED --> [*]: identical "results are in" push to every attendee
~~~

Matches are revealed together when the window closes, never the moment the second person picks. Everyone gets the same notification, so nobody can tell from timing or wording that they were passed over.

Compatibility matrix (mobile/src/lib/matching.ts, mirrored by resolve_match_type in SQL):

~~~ts
export function resolveMatchType(a: Choice, b: Choice, aDating = true, bDating = true): MatchType {
  if (a === 'PASS' || b === 'PASS') return null;
  // Dating needs both to want it AND both to be eligible (DATING intent + gender preference fits).
  if (['DATING', 'EITHER'].includes(a) && ['DATING', 'EITHER'].includes(b) && aDating && bDating) return 'DATING';
  // EITHER counts as friendship too.
  if (['FRIENDSHIP', 'EITHER'].includes(a) && ['FRIENDSHIP', 'EITHER'].includes(b)) return 'FRIENDSHIP';
  return null; // a DATING pick is never silently downgraded to friendship
}
~~~

| A / B | Friendship | Dating | Either | Pass |
|---|---|---|---|---|
| Friendship | Friendship | — | Friendship | — |
| Dating | — | Dating* | Dating* | — |
| Either | Friendship | Dating* | Dating*, else Friendship | — |
| Pass | — | — | — | — |

*Only if both are dating-eligible. Only checked-in attendees can pick or be picked, blocked or inactive users never match, and one Match row exists per pair across all plans.

## 5. Mobile app structure

~~~
mobile/src/
  app/                      Expo Router routes (guards in _layout.tsx via Stack.Protected)
    (auth)/index.tsx        Email OTP sign-in
    onboarding.tsx          Profile, intents, catchments
    (tabs)/index.tsx        Discover feed + filters
    (tabs)/plans.tsx        Upcoming/past plans, hosting
    (tabs)/matches.tsx      Mutual matches
    (tabs)/me.tsx           Profile, photos, verification, host application, sign out, delete
    event/[id].tsx          Detail, price breakdown, book/cancel, emergency button
    event/[id]/channel.tsx  Temporary group chat
    event/[id]/checkin.tsx  4-digit code check-in
    event/[id]/evaluate.tsx Private ratings + picks
    match/[id].tsx          1:1 chat, unmatch/block/report
    host/create.tsx         Create a plan
    host/[id]/roster.tsx    Roster, manual check-in, announcements, cancel
    report.tsx, verification.tsx
  components/               ui.tsx, event-card.tsx, chat.tsx
  services/                 supabase.ts (client + rpc helper), account.ts, media.ts, push.ts
  store/auth.ts             Zustand session + account
  lib/                      format.ts, matching.ts
  types.ts
~~~

Every native module used ships in Expo Go except push notifications, which need a development build (npx eas-cli build --profile development). The iOS bundle exports cleanly at about 4.5 MB.

## 6. Four-sprint plan

| Sprint | Goal | Done when |
|---|---|---|
| 1. Foundation | Supabase project, run migrations, seed 3–5 catchments in the launch city, email OTP + onboarding, profile photos | A new user can sign up and finish a profile on a real phone |
| 2. Plans | Host applications (approve in dashboard), create plan, discovery + filters, booking, waitlist, cancellation, reminders | 5 test users book one plan and get reminders |
| 3. The plan and after | Group chat, check-in, selfie verification queue, post-event form, matching reveal, 1:1 chat | A full dry-run plan produces the expected matches |
| 4. Safety and launch | Reports queue + moderator routine, blocking checks, SMTP setup, store listings, privacy policy, EAS build + TestFlight/Play internal testing | Store review passed; first real plans scheduled |

Launch-ops notes: approve hosts and verifications by hand at first (it is also your quality filter), keep the emergency number on each catchment correct, and put a real support email in the store listings.

## Setup

1. Create a free Supabase project. In the SQL editor run the three files in supabase/migrations in order.
2. Auth → Providers → Email: enable, and switch the email template to show the 6-digit token ({{ .Token }}).
3. Insert catchments, e.g. INSERT INTO "CatchmentArea"(slug, name, "cityName", "countryCode", timezone, currency, "emergencyNumber") VALUES ('indiranagar', 'Indiranagar', 'Bengaluru', 'IN', 'Asia/Kolkata', 'INR', '112');
4. Make yourself a moderator: UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
5. cd mobile, copy .env.example to .env, fill in the project URL and anon key, then npm install and npx expo start.
6. Test the database logic any time with: node supabase/tests/logic.test.mjs (needs @electric-sql/pglite installed).
