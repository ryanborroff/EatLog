# EatLog release-readiness audit — 10 October 2026

## Verdict

EatLog is a feature-rich pre-release product approaching a controlled iOS beta. I would not approve a public release from current main. The remaining work is primarily reliability, privacy/security verification, native-device acceptance testing, and release operations rather than building the basic food diary.

A calendar estimate cannot be established from this repository alone. As a planning assumption, allow 1–2 focused engineering weeks to produce a credible beta candidate, then 1–2 weeks of tester feedback and fixes before public submission. This assumes signing/backend setup already works and no major device or nutrition-quality failures emerge; App Review time is additional. This is a judgment, not a measured completion percentage or commitment.

## Scope and evidence

Audited default branch main at `f87028c1e9ab1a41dfe1544a63e7978ebf20c375`, plus the description and diff of open PR #38. Used an isolated checkout because the supplied local workspace contained an empty Git repository. No product source was changed and no PR was merged.

- Fresh locked dependency installation succeeded (`npm ci --ignore-scripts`).
- Local Jest: **22 suites / 265 tests passed**.
- Local TypeScript: **passed**.
- Main CI passed typecheck, tests and iOS JavaScript export: [run](https://github.com/ryanborroff/EatLog/actions/runs/37597947161).
- PR #38 CI is green, but the PR is still open. Its author reports a successful Release launch in an iOS 27 simulator and explicitly leaves device deep links, Siri and notification taps unverified.
- GitHub has no issues and no published GitHub releases. This does not establish whether TestFlight builds exist.
- No signed native build, physical-device session, live Supabase inspection or App Store Connect inspection was performed. Production deployment, signing, privacy submissions and tester acceptance remain unverified.

## Product coverage

The code implements account creation/sign-in/password recovery, onboarding, voice and text logging, barcode lookup, personal foods, usual meals/portions, conversational corrections, dry/cooked clarification, nutrition reference matching and AI estimate checks. It also implements daily goals, water logging/reminders, history, intake/weight insights, diary questions, dark mode, Apple Health writes, Siri integration and account deletion.

This is substantial MVP coverage. Implementation alone does not establish usability, accurate nutrition on representative real meals, or reliability under production conditions. No explicit release acceptance criteria or completed tester record was found. Tests concentrate on service logic; they do not prove native launch, auth callbacks, database isolation, persistence failure recovery or physical-device permissions.

## Release blockers and priorities

### 1. Native launch blocker — confirmed outstanding work

[PR #38](https://github.com/ryanborroff/EatLog/pull/38) reports that main crashes at launch on iOS 27 because it has not adopted the scene lifecycle. Review and validate the fix before shipping. The PR also changes meal grouping, persistence, HealthKit and logging UI; its title understates its scope. Treat it as a broader regression candidate, not just a launch patch.

Acceptance: signed Release build launches on supported devices; cold/warm auth links, password recovery, Siri, notification taps and camera/mic permissions work. Verify iPad because supportsTablet is enabled.

### 2. Meal updates can destroy existing items — confirmed code failure path

In [storageService.ts](https://github.com/ryanborroff/EatLog/blob/f87028c1e9ab1a41dfe1544a63e7978ebf20c375/services/storageService.ts#L243), updateMeal updates the parent, deletes all old items, then inserts replacements in separate requests. If insertion fails, the previous items are already gone. New-meal saves can leave an empty parent when the item request fails. PR #38 retains delete-then-insert and adds multi-request meal merging, introducing further partial-write/duplicate risks.

Acceptance: transactional database operations for save/edit/merge; retry/idempotency behavior defined; failure and concurrent-write integration tests demonstrate that no diary items are lost or duplicated.

### 3. Privacy statements do not match enforced behavior — confirmed mismatch

[Privacy screen](https://github.com/ryanborroff/EatLog/blob/f87028c1e9ab1a41dfe1544a63e7978ebf20c375/app/settings/privacy.tsx) promises voice audio never leaves the device. [Speech startup](https://github.com/ryanborroff/EatLog/blob/f87028c1e9ab1a41dfe1544a63e7978ebf20c375/components/VoiceLogFlow.tsx#L330) does not request on-device-only recognition; the installed library defaults requiresOnDeviceRecognition to false. Network recognition is therefore permitted. See [library documentation](https://github.com/jamsch/expo-speech-recognition).

The screen also says Groq receives only the text of one request, while [ask-diary](https://github.com/ryanborroff/EatLog/blob/f87028c1e9ab1a41dfe1544a63e7978ebf20c375/supabase/functions/ask-diary/index.ts#L100) sends goals and the last 14 days of diary data. Usage events are account-linked, despite the vague “anonymous-ish” wording. Transcripts and parser results are stored in voice_logs.

Acceptance: enforce the intended speech mode with an unsupported-device fallback, or accurately disclose actual processing; explain diary-context sharing and transcript storage/retention; align in-app text, public policy and App Store privacy answers.

### 4. Rate-limit database protection is missing — confirmed migration gap, live exposure unverified

[Migration 0003](https://github.com/ryanborroff/EatLog/blob/f87028c1e9ab1a41dfe1544a63e7978ebf20c375/supabase/migrations/0003_rate_limits.sql) creates public.rate_limits without RLS or explicit client-grant revocation. The existing RLS audit incorrectly treats “the client does not query it” as protection. A client can address exposed tables independently of the app. Actual exposure depends on deployed database grants, which were not inspected. [Supabase guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) explains this requirement.

The limiter also uses a non-atomic read/increment/write, permitting concurrent requests to undercount; it intentionally fails open. No scheduled retention cleanup was found.

Acceptance: deny anon/authenticated access, verify against live-equivalent roles, increment atomically, define quota/failure handling and expiry. Re-audit all 25 migrations; the checked-in RLS report covers only 0001–0006.

### 5. Store and production readiness is not evidenced

Listing/privacy documents remain drafts. The support URL is explicitly a placeholder; no public privacy-policy URL or store screenshot set was found in the repository. The TestFlight checklist is unchecked and lists three deployed functions, omitting the now-present match-food function. Auth config checked into the repository has localhost redirects; verify deployed eatlog:// callback configuration separately.

Acceptance: confirm target Supabase project, all migrations and four functions, AI secrets/quota, auth email delivery and redirects; record fresh-user signup/recovery and two-user isolation checks; exercise account deletion; finish support/privacy URLs, screenshots, review notes and privacy answers; upload and test the exact signed candidate.

## Other work to complete before public launch

- **Dependency triage:** npm audit reported 66 findings: 15 moderate, 49 high, 2 critical. These are package counts including propagated advisories, not 66 independently exploitable app defects. Critical packages were handlebars (ts-jest development tooling) and shell-quote (React Native/Expo tooling paths). Determine reachability and update compatible dependencies; do not blindly run audit fix --force, whose suggested changes include incompatible major versions/downgrades.
- **Date correctness:** foodPipeline supplies UTC ISO timestamps as localTime and writes HealthKit samples at meal.loggedAt, which is current time even for backdated logging. Test non-UTC zones, midnight boundaries and backdated Health samples; establish expected behavior.
- **AI service reliability/quality:** no production load results, quota budget or representative nutrition accuracy benchmark was found. Build a real-meal acceptance set for portions, branded foods, corrections, dry/cooked grains and barcode serving sizes. Measure failure rate and latency. Offline logging is an explicitly documented limitation and may be acceptable for v1 if communicated clearly.
- **Operations:** no dedicated crash-reporting SDK or documented backup/restore drill was found. Establish crash visibility, backend alerts, transcript retention, restore verification and a rollback procedure. Server-side analytics alone does not prove production observability.

## Suggested release sequence

1. Resolve native launch and transactional persistence; correct privacy behavior/disclosures and database access protection.
2. Review dependency findings and pending PR scope. Freeze an iOS beta candidate; keep new feature work out of the stabilization period.
3. Verify deployed backend and auth configuration; run database isolation, deletion, failure/retry and concurrency tests.
4. Test the signed candidate on physical iPhone/iPad devices, including denied permissions, interrupted connectivity, auth links, HealthKit edits/deletes and reminders.
5. Run a controlled TestFlight cohort, recording crashes, failed saves, parser failures, latency and nutrition corrections. Agree launch thresholds in advance.
6. Close high-severity issues, finish store materials and support/privacy pages, then submit that tested build.

The practical distance to release is a stabilization cycle and a demonstrated beta, not another broad feature sprint. There is enough product here to begin that process now, but current main lacks the evidence and safeguards needed for public release approval.
