# Fastlane (local builds, alternative to EAS)

Builds and uploads to TestFlight from your own Mac instead of Expo's cloud
queue. Gems are already installed locally (`bundle install`, scoped to
`vendor/bundle` so it doesn't need sudo).

## One-time setup

1. **Code signing.** Open `ios/EatLog.xcworkspace` in Xcode at least once:
   - Xcode → Settings → Accounts → sign in with your Apple ID.
   - Select the `EatLog` target → Signing & Capabilities → check
     "Automatically manage signing" → pick your team.
   This lets `build_app` (gym) sign the archive without any extra fastlane
   cert setup (no `match`/certificates repo needed).

2. **Upload auth — pick one:**
   - **Easiest / avoids 2FA prompts:** create an App Store Connect API key
     (App Store Connect → Users and Access → Keys → Generate API Key), then
     set these env vars (e.g. in `.env`, which is already gitignored — just
     don't commit the `.p8` key itself, also gitignored):
     ```
     ASC_KEY_ID=...
     ASC_ISSUER_ID=...
     ASC_KEY_CONTENT=<base64 of the .p8 file: base64 -i AuthKey_XXXX.p8>
     ```
   - **Or:** leave those unset and `upload_to_testflight` will prompt for
     your Apple ID interactively (2FA code included).

## Running it

```bash
bundle exec fastlane beta
```

This runs `expo prebuild`, `pod install`, bumps the build number, builds a
release `.ipa`, and uploads it to TestFlight.

## Fastlane vs EAS

Both end up in the same place (TestFlight). EAS builds on Expo's servers and
handles signing remotely; Fastlane builds locally and needs the Xcode
signing step above once. Use whichever fits how you want to work — they
don't conflict, and nothing here changes the EAS setup.
