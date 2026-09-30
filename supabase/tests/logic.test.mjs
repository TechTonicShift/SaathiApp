import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../migrations/', import.meta.url).pathname;
const files = readdirSync(root).filter(f => f.endsWith('.sql')).sort();

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;
  GRANT USAGE ON SCHEMA public TO authenticated, anon;
  -- Supabase platform stubs
  CREATE PUBLICATION supabase_realtime;
  CREATE SCHEMA cron; CREATE TABLE cron.jobs (name text PRIMARY KEY, schedule text, command text);
  CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO cron.jobs VALUES (n, s, c) RETURNING 1::bigint $$;
  CREATE SCHEMA net; CREATE TABLE net.calls (url text, body jsonb, headers jsonb);
  CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb) RETURNS bigint LANGUAGE sql AS
    $$ INSERT INTO net.calls VALUES (url, body, headers) RETURNING 1::bigint $$;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
    $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  GRANT USAGE ON SCHEMA storage TO authenticated; GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
`);
const strip = (s) => s
  .replace(/CREATE EXTENSION IF NOT EXISTS "?(postgis|pg_cron|pg_net)"?;/g, '')
  .replace(/geometry\(MultiPolygon, 4326\)/g, 'text')
  .replace(/geography\(Point, 4326\)/g, 'text');
for (const f of files) {
  try { await db.exec(strip(readFileSync(root + f, 'utf8'))); console.log('OK   ', f); }
  catch (e) { console.log('FAIL ', f, '\n', e.message, e.position ? '@' + e.position : ''); process.exit(1); }
}

let failures = 0;
const ok = (cond, msg) => { console.log(cond ? '  pass' : '  FAIL', msg); if (!cond) failures++; };
const as = async (uid, sql, params = []) => {
  await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '" + (uid ?? '') + "', false); SET ROLE authenticated;");
  try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE;'); }
};
const expectErr = async (uid, sql, params, code) => {
  try { await as(uid, sql, params); ok(false, 'expected error ' + code); }
  catch (e) { ok(e.message.includes(code), 'rejects with ' + code + ' (got ' + e.message + ')'); }
};
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

const U = (n) => '00000000-0000-0000-0000-00000000000' + n;
const C = '11111111-1111-1111-1111-111111111111';
const genders = ['WOMAN', 'MAN', 'WOMAN', 'MAN', 'NON_BINARY', 'WOMAN', 'MAN'];
await db.exec(`INSERT INTO "CatchmentArea"(id, slug, name, "cityName", "countryCode", timezone, currency, "emergencyNumber")
  VALUES ('${C}', 'indiranagar', 'Indiranagar', 'Bengaluru', 'IN', 'Asia/Kolkata', 'INR', '112');`);
for (let i = 1; i <= 7; i++) await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [U(i), 'u' + i + '@x.test']);
ok((await one('SELECT count(*)::int n FROM "User"')).n === 7, 'auth trigger creates User rows');

console.log('Onboarding');
await expectErr(U(1), `SELECT complete_onboarding('2012-01-01', 'Kid', '{FRIENDSHIP}', ARRAY['${C}']::uuid[])`, [], 'age_out_of_range');
for (let i = 1; i <= 7; i++) {
  const intents = i <= 4 ? '{DATING,FRIENDSHIP}' : '{FRIENDSHIP}';
  await as(U(i), `SELECT complete_onboarding('1996-05-0${i}', 'User ${i}', '${intents}', ARRAY['${C}']::uuid[], '${genders[i-1]}', '{}')`);
}
ok((await one(`SELECT count(*)::int n FROM "User" WHERE status='ACTIVE'`)).n === 7, 'users active after onboarding');
await expectErr(U(2), 'SELECT book_event(gen_random_uuid())', [], 'verification_required');

console.log('Privacy');
const own = await as(U(2), 'SELECT * FROM "User"');
ok(own.rows.length === 1 && own.rows[0].id === U(2), 'User rows (gender, prefs) are owner-only');
ok((await as(U(2), 'SELECT * FROM "UserIntent"')).rows.every(r => r.userId === U(2)), 'intents are owner-only');

console.log('Verification');
await as(U(1), 'SELECT start_verification()');
await as(U(1), `SELECT submit_verification('${U(1)}/selfie.jpg', '${U(1)}/id.jpg')`);
await expectErr(U(2), `SELECT submit_verification('${U(1)}/selfie.jpg', '${U(1)}/id.jpg')`, [], 'invalid_key');
await expectErr(U(1), `SELECT review_verification('${U(2)}', true)`, [], 'permission denied');
await db.exec(`UPDATE "User" SET "verificationStatus"='APPROVED'`);

console.log('Hosting');
await as(U(1), `INSERT INTO "Host"("userId", bio) VALUES ('${U(1)}', 'Board game nights')`);
const mk = (extra = '') => `SELECT host_create_event('${C}','Cafe','Near metro','12th Main, 100ft Rd','Board games','fun','GAMES', now()+interval '1 day', now()+interval '1 day 3 hours', 30000${extra}) id`;
await expectErr(U(1), mk(), [], 'not_an_approved_host');
await db.exec(`UPDATE "Host" SET status='APPROVED'`);
await expectErr(U(1), mk(', 12'), [], 'event_capacity');
const ev = (await as(U(1), mk(", 5, 4, '{OPEN_TO_DATING}'"))).rows[0].id;
ok(!!ev, 'approved host creates event');
ok((await one('SELECT "platformFeeMinor" f FROM "Event" WHERE id=$1', [ev])).f === 3000, 'platform fee = 10%');

console.log('Discovery & booking');
const feed = (await as(U(2), 'SELECT discover_events() j')).rows[0].j;
ok(feed.length === 1 && !('address' in feed[0]) && !('checkInCode' in feed[0]), 'feed hides address and code');
await expectErr(U(2), 'SELECT "addressLine" FROM "Venue"', [], 'permission denied');
await expectErr(U(2), 'SELECT "checkInCode" FROM "Event"', [], 'permission denied');
await expectErr(U(1), 'SELECT book_event($1)', [ev], 'host_cannot_book');
const st = [];
for (let i = 2; i <= 6; i++) st.push((await as(U(i), 'SELECT book_event($1) s', [ev])).rows[0].s);
ok(st.every(s => s === 'CONFIRMED'), 'five confirmed');
ok((await as(U(2), 'SELECT book_event($1) s', [ev])).rows[0].s === 'CONFIRMED', 'booking is idempotent');
const det = (await as(U(2), 'SELECT event_detail($1) j', [ev])).rows[0].j;
ok(det.address === '12th Main, 100ft Rd' && det.checkInCode == null, 'attendee sees address, not code');
ok((await as(U(7), 'SELECT book_event($1) s', [ev])).rows[0].s === 'WAITLISTED', 'full event waitlists');
await as(U(6), 'SELECT cancel_booking($1)', [ev]);
ok((await one('SELECT status FROM "EventBooking" WHERE "userId"=$1', [U(7)])).status === 'CONFIRMED', 'cancel promotes waitlist');
await as(U(6), 'SELECT book_event($1)', [ev]);

console.log('Blocking');
await as(U(7), `INSERT INTO "UserBlock"("blockerId","blockedId") VALUES ('${U(7)}','${U(6)}')`);
ok((await as(U(6), 'SELECT discover_events() j')).rows[0].j.length === 0, 'blocked user cannot see the shared event');
await as(U(7), 'SELECT cancel_booking($1)', [ev]);
ok((await one('SELECT status FROM "EventBooking" WHERE "userId"=$1', [U(6)])).status === 'CONFIRMED', 'waitlist promoted after leave');
await expectErr(U(7), 'SELECT book_event($1)', [ev], 'event_not_bookable');

console.log('Group chat');
await as(U(2), `INSERT INTO "EventChannelMessage"("eventId","senderId",body) VALUES ($1,'${U(2)}','See you')`, [ev]);
await expectErr(U(7), `INSERT INTO "EventChannelMessage"("eventId","senderId",body) VALUES ($1,'${U(7)}','hi')`, [ev], 'row-level security');
await expectErr(U(2), `INSERT INTO "EventChannelMessage"("eventId","senderId",kind,body) VALUES ($1,'${U(2)}','ANNOUNCEMENT','x')`, [ev], 'row-level security');

console.log('Event lifecycle');
await db.query(`UPDATE "Event" SET "startsAt"=now()+interval '10 minutes', "endsAt"=now()+interval '2 hours' WHERE id=$1`, [ev]);
await db.exec('SELECT saath_tick()'); await db.exec('SELECT saath_tick()');
ok((await one(`SELECT count(*)::int n FROM "Notification" WHERE data->>'kind'='reminder'`)).n === 5, 'reminders queued once for 5');
const code = (await as(U(1), 'SELECT event_detail($1) j', [ev])).rows[0].j.checkInCode;
ok(/^\d{4}$/.test(code), 'host sees 4-digit code');
await expectErr(U(2), 'SELECT check_in($1, $2)', [ev, code === '0000' ? '0001' : '0000'], 'check_in_failed');
for (const i of [2, 3, 4]) await as(U(i), 'SELECT check_in($1, $2)', [ev, code]);
await as(U(1), 'SELECT host_set_attendance($1, $2, true)', [ev, U(5)]);
await db.query(`UPDATE "Event" SET "startsAt"=now()-interval '3 hours', "endsAt"=now()-interval '1 minute' WHERE id=$1`, [ev]);
await db.exec('SELECT saath_tick()'); await db.exec('SELECT saath_tick()');
let e = await one('SELECT status, "matchingStatus" m FROM "Event" WHERE id=$1', [ev]);
ok(e.status === 'COMPLETED' && e.m === 'NOT_OPEN', 'completed, matching not open yet');
await expectErr(U(2), `SELECT submit_post_event($1, '[]', 5, 5, true)`, [ev], 'matching_not_open');
await db.query(`UPDATE "Event" SET "matchingOpensAt"=now()-interval '1 minute' WHERE id=$1`, [ev]);
await db.exec('SELECT saath_tick()');
ok((await one('SELECT "matchingStatus" m FROM "Event" WHERE id=$1', [ev])).m === 'OPEN', 'matching opens');
ok((await one('SELECT attendance a FROM "EventBooking" WHERE "userId"=$1', [U(6)])).a === 'NO_SHOW', 'no-show marked');
await expectErr(U(6), 'SELECT matching_candidates($1)', [ev], 'not_attended');
await expectErr(U(1), 'SELECT host_set_attendance($1, $2, true)', [ev, U(6)], 'attendance_locked');

console.log('Double-blind matching');
const cands = (await as(U(2), 'SELECT matching_candidates($1) j', [ev])).rows[0].j.candidates;
ok(cands.length === 3 && cands.every(c => c.userId !== U(6)), 'candidates = other checked-in attendees');
const pick = (from, arr) => as(U(from), 'SELECT submit_post_event($1, $2::jsonb, 5, 4, true)',
  [ev, JSON.stringify(arr.map(([to, choice]) => ({ toUserId: U(to), choice })))]);
await pick(2, [[3, 'DATING'], [4, 'EITHER'], [5, 'PASS']]);
await pick(3, [[2, 'DATING'], [5, 'DATING'], [4, 'PASS']]);
await pick(4, [[2, 'FRIENDSHIP'], [5, 'FRIENDSHIP']]);
await pick(5, [[3, 'EITHER'], [4, 'PASS'], [6, 'DATING']]);
ok((await one('SELECT count(*)::int n FROM "PostEventInteraction" WHERE "toUserId"=$1', [U(6)])).n === 0, 'picks for no-shows ignored');
await pick(2, [[3, 'PASS']]);
ok((await one(`SELECT choice FROM "PostEventInteraction" WHERE "fromUserId"=$1 AND "toUserId"=$2`, [U(2), U(3)])).choice === 'DATING', 'picks are write-once');
ok((await as(U(3), 'SELECT * FROM "PostEventInteraction"')).rows.every(r => r.fromUserId === U(3)), 'nobody reads picks about them');
ok((await as(U(2), 'SELECT * FROM "Match"')).rows.length === 0, 'nothing revealed before window closes');
await db.query(`UPDATE "Event" SET "matchingClosesAt"=now()-interval '1 minute' WHERE id=$1`, [ev]);
await db.exec('SELECT saath_tick()');
const ms = (await db.query('SELECT "userAId" a, "userBId" b, type FROM "Match" ORDER BY a, b')).rows
  .map(m => m.a.slice(-1) + '-' + m.b.slice(-1) + ':' + m.type).join(' ');
ok(ms === '2-3:DATING 2-4:FRIENDSHIP', 'matches = ' + ms);
const n = await one(`SELECT count(*)::int n, count(DISTINCT body)::int d FROM "Notification" WHERE data->>'kind'='matching_closed'`);
ok(n.n === 4 && n.d === 1, 'all attendees get identical results notification');
ok((await as(U(1), 'SELECT "ratingCount" c FROM "Host"')).rows[0].c === 4, 'host ratings recorded');

console.log('1:1 chat');
const m23 = (await as(U(2), 'SELECT my_matches() j')).rows[0].j.find(m => m.otherUserId === U(3)).id;
await as(U(2), `INSERT INTO "Message"("matchId","senderId","clientId",body) VALUES ($1,'${U(2)}','c1','Hey!')`, [m23]);
await expectErr(U(4), `INSERT INTO "Message"("matchId","senderId","clientId",body) VALUES ($1,'${U(4)}','c1','x')`, [m23], 'row-level security');
ok((await as(U(4), 'SELECT * FROM "Message"')).rows.length === 0, 'non-members cannot read chat');
ok((await one(`SELECT count(*)::int n FROM "Notification" WHERE "userId"=$1 AND data->>'kind'='message'`, [U(3)])).n === 1, 'message push queued');
await as(U(3), `INSERT INTO "UserBlock"("blockerId","blockedId") VALUES ('${U(3)}','${U(2)}')`);
ok((await one('SELECT status FROM "Match" WHERE id=$1', [m23])).status === 'BLOCKED', 'block ends match');
await expectErr(U(2), `INSERT INTO "Message"("matchId","senderId","clientId",body) VALUES ($1,'${U(2)}','c2','?')`, [m23], 'row-level security');

console.log('Safety');
await as(U(4), `INSERT INTO "SafetyReport"("reporterId","subjectUserId",category,description) VALUES ('${U(4)}','${U(5)}','SAFETY_THREAT','Followed me')`);
ok((await one(`SELECT severity s FROM "SafetyReport" WHERE category='SAFETY_THREAT'`)).s === 'CRITICAL', 'threats are CRITICAL');
await expectErr(U(4), `INSERT INTO "SafetyReport"("reporterId",category,description,severity) VALUES ('${U(4)}','OTHER','x','LOW')`, [], 'permission denied');

console.log('Platform');
ok((await one('SELECT count(*)::int n FROM cron.jobs')).n === 2, 'tick + push jobs scheduled');
ok((await one('SELECT count(*)::int n FROM storage.buckets WHERE NOT public')).n === 2, 'two private buckets');
await as(U(2), "INSERT INTO storage.objects(bucket_id, name) VALUES ('photos', '" + U(2) + "/a.jpg')");
await expectErr(U(2), "INSERT INTO storage.objects(bucket_id, name) VALUES ('photos', '" + U(3) + "/a.jpg')", [], 'row-level security');
ok((await as(U(2), 'SELECT * FROM storage.objects')).rows.length === 1, 'owner reads own photo');
ok((await as(U(3), 'SELECT * FROM storage.objects')).rows.length === 0, 'blocked user cannot read photo');
ok((await as(U(5), 'SELECT * FROM storage.objects')).rows.length === 1, 'other members can read photo');
await as(U(2), "UPDATE \"User\" SET \"expoPushToken\" = 'ExponentPushToken[abc]' WHERE id = '" + U(2) + "'");
await expectErr(U(2), 'SELECT dispatch_push()', [], 'permission denied');
const queued = (await one('SELECT count(*)::int n FROM "Notification" WHERE "sentAt" IS NULL')).n;
let sent = 0; for (;;) { const k = (await one('SELECT dispatch_push() n')).n; if (!k) break; sent += k; }
ok(sent === queued && (await one('SELECT count(*)::int n FROM "Notification" WHERE "sentAt" IS NULL')).n === 0, 'outbox drained (' + sent + ')');
const call = await one('SELECT body FROM net.calls LIMIT 1');
ok(call && call.body.every(m => m.to === 'ExponentPushToken[abc]'), 'push only sent to users with tokens');

console.log('Account deletion');
await as(U(4), 'SELECT delete_my_account()');
const d = await one('SELECT status, email FROM "User" WHERE id=$1', [U(4)]);
ok(d.status === 'DELETED' && d.email === null, 'account anonymised');
ok((await one('SELECT count(*)::int n FROM auth.users WHERE id=$1', [U(4)])).n === 0, 'auth user removed');

console.log(failures ? '\n' + failures + ' FAILED' : '\nALL PASSED');
process.exit(failures ? 1 : 0);
