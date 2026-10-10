# Transactional diary saves

Deploy migration `0026_transactional_diary_saves.sql` **before distributing the updated app**. Older builds continue to use their existing table writes; the new RPC safeguards apply to updated builds only. No production migration has been applied by this change.

The client now saves, replaces and merges meal items through one `persist_diary_meal` transaction. Failed inserts roll back parent creation, item deletion and merge changes. The function uses invoker security and existing RLS, checks ownership/date for edits, and serializes cooperating RPC writes per user/day with a transaction advisory lock. Breakfast/lunch/dinner grouping and one-hour snack grouping are retained.

Run `supabase/tests/transactional_diary_saves.sql` with `psql -v ON_ERROR_STOP=1` against a disposable migrated database as its admin role. It creates temporary auth users and rolls everything back. It verifies successful append/merge, failed replacement/addition/merge rollback, cross-account edit denial, and unauthenticated rejection. Run the Jest suite for client error and notification behavior.

This change does not add offline retrying, request-id deduplication, or stale-edit conflict detection. A new submission after an ambiguous network timeout can still duplicate an addition, and a stale editor can replace newer items. Those need separate request identity/version handling before automatic retries are introduced. Legacy clients and direct table writes do not acquire the advisory lock.
