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
 */
export const handleAuthRedirectUrl = async (url: string) => {
  const fragment = url.split('#')[1];
  if (!fragment) return;
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
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
