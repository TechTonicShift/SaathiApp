import { supabase } from './supabase';
import { useAuthStore } from '@/store/auth';
import type { Profile, UserRow } from '@/types';
export async function refreshAccount() {
  const session = useAuthStore.getState().session;
  if (!session) return useAuthStore.getState().setAccount(null,null);
  const [{ data:user,error },{ data:profile }] = await Promise.all([
    supabase.from('User').select('*').eq('id',session.user.id).single(),
    supabase.from('Profile').select('*').eq('userId',session.user.id).maybeSingle(),
  ]);
  if (error) throw error;
  useAuthStore.getState().setAccount(user as UserRow, profile as Profile|null);
}

