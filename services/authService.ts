import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from './supabaseClient';

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: Linking.createURL('/auth/callback') },
  });
  if (error) throw error;
  return data;
};

/**
 * Supabase email links redirect back with the session tokens in the URL
 * fragment (#access_token=...). Parse them out and establish the session,
 * since detectSessionInUrl is off (there's no window/fragment handling on RN).
 * Returns the link's `type` (e.g. "signup", "recovery") so callers can route
 * a password-recovery link to the reset-password screen instead of just
 * dropping the user into the main app.
 */
export const handleAuthRedirectUrl = async (url: string): Promise<string | null> => {
  const fragment = url.split('#')[1];
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return params.get('type');
};

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Linking.createURL('/auth/callback'),
  });
  if (error) throw error;
};

export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Permanently deletes the current user's account and all their data
 * (spec §38). The Edge Function only ever acts on the caller's own verified
 * JWT identity, so this can't be pointed at another account. Signs the
 * client out locally afterward, since the session is no longer valid.
 */
export const deleteAccount = async (): Promise<void> => {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
};

export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data.subscription;
};
