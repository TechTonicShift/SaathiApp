import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { Profile, UserRow } from '@/types';
type AuthState = { session:Session|null; user:UserRow|null; profile:Profile|null; ready:boolean; setSession:(s:Session|null)=>void; setAccount:(u:UserRow|null,p:Profile|null)=>void; setReady:(v:boolean)=>void };
export const useAuthStore = create<AuthState>((set)=>({ session:null,user:null,profile:null,ready:false,setSession:(session)=>set({session}),setAccount:(user,profile)=>set({user,profile}),setReady:(ready)=>set({ready}) }));

