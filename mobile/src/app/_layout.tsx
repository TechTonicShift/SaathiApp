import '@/global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { refreshAccount } from '@/services/account';
import { useAuthStore } from '@/store/auth';
import { registerPush } from '@/services/push';
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:1},mutations:{retry:0}}});
export default function RootLayout(){
 const {session,user,ready,setSession,setReady}=useAuthStore();
 useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session)).finally(()=>setReady(true));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(session)refreshAccount().catch(console.error);else useAuthStore.getState().setAccount(null,null)},[session?.user.id]);
 useEffect(()=>{if(user?.id)registerPush(user.id).catch(()=>{})},[user?.id]);
 if(!ready||session&&!user)return null; const active=!!session&&user?.status==='ACTIVE';
 return <QueryClientProvider client={queryClient}><StatusBar style="dark"/><Stack screenOptions={{headerShadowVisible:false,headerStyle:{backgroundColor:'#FBF7F0'},contentStyle:{backgroundColor:'#FBF7F0'}}}>
  <Stack.Protected guard={!session}><Stack.Screen name="(auth)" options={{headerShown:false}}/></Stack.Protected>
  <Stack.Protected guard={!!session&&!!user&&!active}><Stack.Screen name="onboarding" options={{headerShown:false}}/></Stack.Protected>
  <Stack.Protected guard={active}><Stack.Screen name="(tabs)" options={{headerShown:false}}/><Stack.Screen name="event/[id]" options={{title:'Plan'}}/><Stack.Screen name="event/[id]/channel" options={{title:'Plan chat'}}/><Stack.Screen name="event/[id]/checkin" options={{title:'Check in'}}/><Stack.Screen name="event/[id]/evaluate" options={{title:'After the plan'}}/><Stack.Screen name="match/[id]" options={{title:'Chat'}}/><Stack.Screen name="host/create" options={{title:'Host a plan'}}/><Stack.Screen name="host/[id]/roster" options={{title:'Attendees'}}/><Stack.Screen name="report" options={{presentation:'modal',title:'Safety report'}}/><Stack.Screen name="verification" options={{title:'Get verified'}}/></Stack.Protected>
 </Stack></QueryClientProvider>
}
