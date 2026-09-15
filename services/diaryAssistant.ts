// Thin wrapper over the ask-diary Edge Function (spec §27).

import { supabase } from './supabaseClient';

export class DiaryAssistantError extends Error {}

export const askDiary = async (question: string): Promise<string> => {
  const { data, error } = await supabase.functions.invoke<{ answer: string }>('ask-diary', {
    body: { question, localTime: new Date().toISOString() },
  });

  if (error) {
    throw new DiaryAssistantError(error.message ?? 'Could not reach the assistant');
  }
  if (!data?.answer) {
    throw new DiaryAssistantError('No answer returned');
  }

  return data.answer;
};
