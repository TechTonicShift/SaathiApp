import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) console.warn('Missing Supabase variables. Copy .env.example to .env.');
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'placeholder', {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
AppState.addEventListener('change', (state) => state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());

export async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}
export function friendlyError(message: string) {
  const key = ['age_out_of_range','verification_required','account_not_active','event_not_bookable','host_cannot_book','too_late_to_cancel','check_in_failed','matching_not_open','not_attended','not_an_approved_host'].find(x => message.includes(x));
  return ({ age_out_of_range:'Saath is currently for adults aged 21–35.', verification_required:'Complete verification before booking.', account_not_active:'Finish setting up your profile first.', event_not_bookable:'This plan is no longer available.', host_cannot_book:'You are hosting this plan.', too_late_to_cancel:'This plan has already started.', check_in_failed:'That code is incorrect or check-in is closed.', matching_not_open:'The private matching window is not open.', not_attended:'Only checked-in attendees can do this.', not_an_approved_host:'Your host application is awaiting approval.' } as Record<string,string>)[key ?? ''] ?? message;
}

