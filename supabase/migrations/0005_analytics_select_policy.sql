-- Allow users to read their own analytics events. Not currently used by the
-- app, but there's no reason to block it, and it lets verification queries
-- distinguish "no events" from "RLS blocked the read".

create policy "users can read own events" on public.analytics_events
  for select using (auth.uid() = user_id);
