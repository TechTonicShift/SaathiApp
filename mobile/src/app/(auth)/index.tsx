import { useState } from 'react';
import { Text, View } from 'react-native';
import { H1,Body,Button,Field,Screen,ErrorText } from '@/components/ui';
import { supabase } from '@/services/supabase';
export default function Welcome(){
 const[email,setEmail]=useState('');const[sent,setSent]=useState(false);const[code,setCode]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 async function send(){setBusy(true);setError('');const{error}=await supabase.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{shouldCreateUser:true}});setBusy(false);if(error)setError(error.message);else setSent(true)}
 async function verify(){setBusy(true);setError('');const{error}=await supabase.auth.verifyOtp({email:email.trim().toLowerCase(),token:code,type:'email'});setBusy(false);if(error)setError(error.message)}
 return <Screen className="justify-between pt-16"><View className="gap-5"><View className="h-16 w-16 items-center justify-center rounded-3xl bg-coral"><Text className="text-3xl">🤝</Text></View><H1>Real plans.{"\n"}Real people.</H1><Body>Small hosted activities for 4–8 people. Meet first; match privately after.</Body><View className="mt-6 gap-4"><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!sent} placeholder="you@example.com"/>{sent&&<Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="123456"/>}<ErrorText message={error}/><Button title={sent?'Verify code':'Email me a code'} onPress={sent?verify:send} loading={busy} disabled={!email||(sent&&!code)}/>{sent&&<Button kind="secondary" title="Use another email" onPress={()=>{setSent(false);setCode('')}}/>}</View></View><Body className="text-center text-sm">By continuing, you confirm you are 21–35 and agree to Saath's community rules.</Body></Screen>
}

