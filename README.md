# SilverBeam Companion App

MVP scaffold for SilverBeam LLC's AI companionship app: a senior-facing
companion (daily check-in, chat, one-button video call) and a family
dashboard (mood/summary updates, escalation alerts). Built with Expo (React
Native) + Supabase. See `silverbeam-app` plan history for the full design
rationale.

**This machine doesn't have Node.js installed**, so none of this has been
installed or run yet — every file here was hand-authored to the target
structure. Follow the steps below to actually get it running.

## 1. Install prerequisites

Install Node.js LTS, then the Expo/EAS/Supabase CLIs:

```bash
winget install OpenJS.NodeJS.LTS
```

Restart your terminal after installing Node, then:

```bash
npm install -g eas-cli supabase
```

## 2. Install project dependencies

From `silverbeam-app/`:

```bash
npm install
npx expo install --fix
```

`expo install --fix` reconciles the hand-written package versions in
`package.json` against whatever Expo SDK actually resolves — run it any
time dependency versions look mismatched.

## 3. Set up Supabase

1. Create a project at supabase.com (or run one locally with `supabase
   start` if you have Docker).
2. Copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL`
   / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from your project's API settings.
3. Link the CLI and push the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This runs `supabase/migrations/0001_init.sql` — creates all tables and
   RLS policies described in the plan (family members can only ever read
   mood + AI summaries + escalation alerts, never raw chat transcripts).
4. Deploy the two Edge Functions:
   ```bash
   supabase functions deploy chat
   supabase functions deploy create-call
   ```
5. Set Edge Function secrets (these never go in the mobile app bundle):
   ```bash
   supabase secrets set AI_PROVIDER=anthropic
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set DAILY_API_KEY=...
   supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=...
   supabase secrets set FOUNDER_ALERT_PUSH_TOKEN=...
   ```
   `AI_PROVIDER` can be switched to `openai` (with `OPENAI_API_KEY` set)
   later with no app changes — see
   `supabase/functions/chat/companion/config.ts`.

## 4. Daily.co (video calls)

Sign up for a free Daily.co account, create an API key, and set it as
`DAILY_API_KEY` above. The free tier (10,000 participant-minutes/month)
comfortably covers a 10-family beta.

## 5. Branding assets

`app.config.ts` references `./assets/icon.png`, `./assets/splash.png`, and
`./assets/adaptive-icon.png`, which don't exist yet. Add real SilverBeam
branding (1024×1024 icon, etc.) before your first build — the business plan
budgets $200–$1,500 for this under "Domain, branding & app icon."

## 6. Run it

Because the app uses `react-native-webview` and `expo-notifications`
(native modules), you need a dev client build rather than plain Expo Go:

```bash
eas build --profile development --platform ios   # or android
```

**Before your first EAS build**, register the `EXPO_PUBLIC_*` vars from
`.env.local` as EAS environment variables — the cloud build machine never
sees your local `.env.local` (it's gitignored on purpose), so without this
the build "succeeds" but the installed app crashes immediately on launch
(`supabase.ts` throws on purpose when these are missing, and nothing
catches it — this is exactly what happened during beta testing before this
note existed):

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --visibility plaintext --environment preview --environment development --environment production
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --visibility plaintext --environment preview --environment development --environment production
```

`plaintext` is correct here, not `secret` — these are the public anon
key/URL, meant to ship inside the client bundle. Verify anytime with
`eas env:list --environment preview`.

Once installed on a device/simulator:

```bash
npx expo start --dev-client
```

For a quick sanity check without a device/simulator (auth screens, basic
navigation — not the video call or push notifications), `npm run web` boots
the same app in a browser via react-native-web. This is how the initial
scaffold was verified end-to-end: it correctly redirected to `(auth)/login`,
rendered the signup screen, and surfaced a clean "Failed to fetch" error
(not a crash) when signing in against a placeholder Supabase URL.

**Note on `@supabase/supabase-js`**: it's pinned to an exact `2.45.4` rather
than a floating `^2.x`. Newer 2.x releases ship type-level generics that
this project's TypeScript/Expo SDK combination can't resolve correctly —
`.single()`/`.eq()` results collapse to `never` and every table access
breaks. If you bump this dependency later, re-run `npx tsc --noEmit` and
fix or re-pin if the same thing happens.

## 7. Beta onboarding (10 founding families)

Seniors don't need an email or phone number to use the app. A family member
sets up the senior's device once, in person, via **"Setting up a device for
a senior? Tap here"** on the login screen
(`app/(auth)/setup-senior-device.tsx`). That calls
`supabase.auth.signInAnonymously()` — no credential of any kind — creates
their `profiles` row (`role = 'senior'`), and the device just stays signed
in indefinitely from then on (matches the accessibility baseline: no forced
re-auth for the senior experience). The screen displays the new senior's id
at the end for linking.

**Post-beta upgrade path**: an anonymous account isn't portable — if the
device is lost or reset, that identity can't be recovered elsewhere. The
mechanism to fix that already exists and is enabled
(`enable_anonymous_sign_ins = true` alongside standard email/password
auth): call `supabase.auth.updateUser({ email })` or `{ phone }` on the
senior's own session to attach a recoverable identity. The user id and all
their data (check-ins, conversation history, escalation events) carry over
unchanged — Supabase just flips `auth.users.is_anonymous` to `false` once
confirmed. No UI for this exists yet; add it as a family-initiated action
(e.g., from the senior's settings) when you're ready to move past the beta.

For each founding family:

1. Family member signs up in-app (`(auth)/signup.tsx` creates a
   `role = 'family'` profile) — this one does use a real email/password.
2. Family member sets up the senior's device as above, then sends you the
   displayed senior id.
3. Link them:
   ```sql
   insert into senior_family_links (senior_id, family_member_id, relationship, is_emergency_contact)
   values ('<senior-uuid>', '<family-uuid>', 'daughter', true);
   ```
   See `supabase/seed.sql` for a template.

## 8. Verification checklist

- [ ] App loads to `(auth)/login` when signed out.
- [ ] Senior login routes to `(senior)/home`; family login routes to
      `(family)/dashboard`.
- [ ] Senior check-in → chat message → assistant reply loop works end to
      end, and a `check_ins`/`conversation_messages` row is written.
- [ ] Run the escalation test matrix (see plan §6) against sample phrases
      and confirm `escalation_events` rows are created and the linked
      family member (+ founder, for medium/high) gets a push.
- [ ] As a family member, confirm you can read `check_ins` and
      `escalation_events` for your linked senior but querying
      `conversation_messages` directly returns nothing (RLS check).
- [ ] Full test video call between two devices via the "Call Family"
      button.

## What's deferred

Stripe billing, a dedicated support/ticketing platform, self-serve senior
signup, and any ML-based sentiment model beyond keyword + LLM tagging are
explicitly out of scope for this build — see the original plan for why.
