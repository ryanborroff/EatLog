# RLS audit (Stage 5)

Verification pass against migrations `0001`–`0006` (all applied to the remote
project). No schema changes here — this just confirms every table that holds
user data has RLS enabled with the policy we intend, and calls out the two
tables that intentionally don't.

| Table | RLS enabled | Policy | Notes |
|---|---|---|---|
| `users` | ✅ | `for all using (auth.uid() = id)` | Own row only. |
| `user_goals` | ✅ | `for all using (auth.uid() = user_id)` | Own row only. |
| `user_foods` | ✅ | `for all using (auth.uid() = user_id)` | Own row only. |
| `user_defaults` | ✅ | `for all using (auth.uid() = user_id)` | Own row only. |
| `user_default_items` | ✅ | scoped via `default_id in (select id from user_defaults where user_id = auth.uid())` | Indirect ownership through the parent default — correct, since the child table has no `user_id` column of its own. |
| `meals` | ✅ | `for all using (auth.uid() = user_id)` | Own row only. |
| `meal_items` | ✅ | scoped via `meal_id in (select id from meals where user_id = auth.uid())` | Same indirect-ownership pattern as `user_default_items`. |
| `voice_logs` | ✅ | `for all using (auth.uid() = user_id)` | Own row only. Holds raw transcripts — correctly private per-user. |
| `analytics_events` | ✅ | insert: `auth.uid() = user_id`; select: `auth.uid() = user_id` | Insert-only from the client in practice (app never reads its own events back); the select policy exists solely so verification queries can distinguish "no events" from "RLS blocked the read" (see `0005`). No update/delete policy — events are immutable by design, so none is needed. |
| `foods` | ✅ | select-only: `auth.role() = 'authenticated'` | Shared reference data. No insert/update/delete policy for any role but service_role, by omission — correct, since this table is meant to be centrally curated, not user-writable. |
| `food_aliases` | ✅ | select-only: `auth.role() = 'authenticated'` | Same as `foods`. |
| `rate_limits` | ⚠️ intentionally no RLS | — | Written only by Edge Functions via the service-role key (`_shared/rateLimit.ts`), which bypasses RLS entirely and is never exposed to the client SDK. Enabling RLS here would add nothing, since no anon/authenticated-role client ever touches this table. |

## Things specifically checked

- **No table holding user-identifiable data is missing an `enable row level
  security` statement.** Every `create table` in `0001`–`0006` other than
  `rate_limits` is followed by `alter table ... enable row level security`
  and at least one policy.
- **Indirect-ownership tables** (`meal_items`, `user_default_items`) use a
  subquery against the parent's `user_id` rather than duplicating a `user_id`
  column — verified both `using` and `with check` clauses are present on
  both, so the same rule applies to reads and writes.
- **`foods`/`food_aliases` are read-only from the client side** — confirmed
  there is no insert/update/delete policy for `authenticated`, only for
  `select`. Writes to the reference food database can only happen via the
  service role (i.e. a maintainer script), not from the app.
- **`analytics_events.properties` never contains diary content** — this is
  enforced by discipline in `services/analytics.ts`'s call sites, not by RLS
  (RLS can't validate JSONB shape). Spot-checked the call sites in
  `VoiceModal.tsx`, `personal-foods.tsx`, and `usual-foods.tsx`: all pass only
  counts/enums/booleans, never transcript or food-description text.
- **`rate_limits` is the one deliberately RLS-less table** — confirmed it's
  never queried from `services/` (client code), only from
  `supabase/functions/_shared/rateLimit.ts` using the service-role key.

## Conclusion

No regressions found. Every user-data table added since Stage 2 correctly
carries forward the same `auth.uid() = user_id` (or indirect equivalent)
pattern, and the two exceptions (`foods`/`food_aliases` read-only,
`rate_limits` service-role-only) are both intentional and correctly scoped.
