// Product analytics (spec §43). Fire-and-forget: a tracking failure must
// never surface to the user or block the UI. `properties` must never contain
// diary content (transcripts, food descriptions) — only small non-content
// fields (counts, booleans, enum-like strings).

import { supabase } from './supabaseClient';

export type AnalyticsProperties = Record<string, string | number | boolean | null>;

export const track = (eventName: string, properties?: AnalyticsProperties): void => {
  void (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from('analytics_events').insert({
        user_id: session.user.id,
        event_name: eventName,
        properties: properties ?? null,
      });
    } catch {
      // Analytics is best-effort — never let a tracking failure affect the app.
    }
  })();
};
