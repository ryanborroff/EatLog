import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Retries a Supabase call once if PostgREST rejects the JWT as "issued at
 * future" (error code PGRST303) — a transient clock-skew race that can occur
 * for the first request right after sign-in, before the token has propagated
 * across Supabase's nodes. Self-resolves after a short delay.
 */
export const withClockSkewRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'PGRST303') {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return fn();
    }
    throw error;
  }
};
