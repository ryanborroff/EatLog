# TestFlight checklist

## Before uploading a build

- [ ] `.env` has real `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
      for the environment you're shipping (dev vs. a separate prod Supabase
      project, if you split them later)
- [ ] Supabase secrets are set on the target project: `GROQ_API_KEY`
      (`supabase secrets set GROQ_API_KEY=...`)
- [ ] All migrations applied to the target project (`supabase db push`)
- [ ] Both Edge Functions deployed (`supabase functions deploy parse-food`,
      `supabase functions deploy ask-diary`)
- [ ] `app.json` version/build number bumped
- [ ] Xcode signing set up (Apple Developer account, provisioning profile —
      `eas build` handles this automatically if using EAS; manual builds via
      `npx expo run:ios --configuration Release` need it set up in Xcode)

## Build & upload

Using EAS (recommended — handles signing and upload):
```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios
```

Or manually via Xcode: `npx expo prebuild`, open `ios/EatLog.xcworkspace`,
Product → Archive, then upload via Xcode Organizer.

## Internal testing group

- [ ] Create an internal testing group in App Store Connect → TestFlight
- [ ] Add testers by Apple ID email (up to 100 internal testers, no App
      Review needed for internal-only builds)
- [ ] Write "What to Test" notes for this build (what's new since the last one)

## What a tester should manually verify

- [ ] Sign up with a new email, confirm via the email link, sign in
- [ ] Log food by voice: "two eggs and a slice of toast" → check it appears
      on Today with sensible calories/protein
- [ ] Log food by text (the "or type it" fallback)
- [ ] Say a correction right after logging: "actually it was tuna" → same
      entry updates, not a duplicate
- [ ] Create a personal food (Settings → Personal foods), then say "I had my
      usual yoghurt" (or whatever nickname was set) and confirm it resolves
      without an AI guess
- [ ] Create a "usual breakfast" meal default with 2+ items, say "I had my
      usual breakfast", confirm all items log at once
- [ ] Pick a past date via the calendar in the logging modal, log something,
      confirm it appears on that day in History (not today)
- [ ] Ask a diary question ("how much protein have I had today?") via the
      Ask screen and confirm the answer matches Today's real totals
- [ ] Force a "some pasta"-style vague entry and confirm the clarification
      flow appears instead of a silent guess
- [ ] Turn off Wi-Fi/cellular and try to log food — confirm the "Couldn't
      connect" message appears rather than a crash or a false "Logged"
- [ ] Sign out and back in — confirm data persists (it's server-side, not
      per-device)

## Known limitations to tell testers about

- Groq's free tier has request-rate limits shared across all EatLog users
  during testing — occasional "AI parser request failed" errors under load
  are a known current limitation, not necessarily a bug to report.
- No account-deletion flow yet — testers who want their test data removed
  should ask you to delete it manually via the Supabase dashboard.
- No offline queueing — logging while offline fails cleanly but isn't
  retried automatically once back online.
