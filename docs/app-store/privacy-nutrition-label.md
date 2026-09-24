# App Privacy (Apple's "privacy nutrition label") — draft answers

Fill these into App Store Connect → App Privacy. This reflects what the app
*actually* does as built — update it if the data handling changes before
submission. Spec §38 requires clearly explaining AI processing to users;
these answers are the App Store side of that same disclosure.

## Data types collected

### Contact Info
- **Email Address** — collected for account creation/sign-in (Supabase Auth).
  - Linked to the user's identity: **Yes**
  - Used for: App Functionality (authentication)
  - Not used for tracking, not shared with third parties for advertising.

### Health & Fitness
- **Other Health & Fitness Data** — the food diary itself: what the user
  logged, quantities, calories, macros, meal type, dates — plus optional
  profile biometrics and body-weight weigh-ins the user types in (entered
  manually, never read from Apple Health).
  - Linked to identity: **Yes**
  - Used for: App Functionality (the core product)
  - Not shared with data brokers or used for advertising.

### User Content
- **Audio Data** — the spoken description captured for voice logging is
  transcribed **on-device** (Apple/Android's native speech recognition via
  `expo-speech-recognition`). The raw audio itself is not uploaded to
  EatLog's servers or any third party; only the resulting **text
  transcription** leaves the device.
  - The transcription is sent to: (1) EatLog's own Supabase backend
    (stored in `voice_logs` for debugging/improving parsing, per spec §33),
    and (2) **Groq** (a third-party AI inference provider) to interpret the
    food description into structured data.
  - Linked to identity: **Yes** (stored against the user's account)
  - Used for: App Functionality only.

### Identifiers
- **User ID** — Supabase auth user ID, used to scope all data access (RLS).
  - Linked to identity: **Yes**
  - Used for: App Functionality.

### Usage Data
- **Product Interaction** — anonymous-ish in-app event names (e.g.
  `food_logged`, `voice_log_started`) with small non-content properties
  (counts, meal type, boolean flags). **Never** includes transcript text or
  food descriptions.
  - Linked to identity: **Yes** (stored against user ID, not shared/sold)
  - Used for: Analytics (first-party, EatLog's own understanding of usage —
    not a third-party analytics SDK).

## Data NOT collected
- Precise or coarse location
- Contacts
- Browsing history
- Photos/videos
- Financial info
- Advertising identifiers / data used for third-party advertising
- Data sold to data brokers

## Third parties data is shared with
- **Supabase** (database, auth, and serverless functions hosting) — acts as
  EatLog's infrastructure processor.
- **Groq** — processes food-description text and diary-question text to
  return structured/plain-text responses. Does not receive the user's email
  or account identity, only the text content of a given request plus recent
  diary context needed to answer it.

## In-app disclosure (spec §38 "clearly explain AI processing")
Recommend a short line in Settings → Privacy (not yet built — see the Stage
5 backlog item for an account-deletion/privacy screen) stating: "When you
log food or ask a question, the text is sent to Groq, a third-party AI
service, to interpret it. Your raw voice audio never leaves your device."
