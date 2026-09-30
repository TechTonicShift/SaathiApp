import { useEffect,useState } from 'react';
import { Text,View } from 'react-native';
import { Button,Field,H1,Body,Pill,Screen,ErrorText } from '@/components/ui';
import { supabase,rpc } from '@/services/supabase';
import { refreshAccount } from '@/services/account';
import type { Catchment,Intent } from '@/types';
const options:[Intent,string][]=[['FRIENDSHIP','Friends'],['DATING','Dating'],['NEW_IN_TOWN','New in town']];
export default function Onboarding(){
 const[name,setName]=useState('');const[dob,setDob]=useState('');const[bio,setBio]=useState('');const[intents,setIntents]=useState<Intent[]>(['FRIENDSHIP']);const[catchments,setCatchments]=useState<Catchment[]>([]);const[catchmentId,setCatchmentId]=useState('');const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{supabase.from('CatchmentArea').select('*').eq('isActive',true).order('cityName').then(({data})=>{setCatchments((data??[]) as Catchment[]);if(data?.[0])setCatchmentId(data[0].id)})},[]);
 function toggle(i:Intent){setIntents(v=>v.includes(i)?v.filter(x=>x!==i):[...v,i])}
 async function finish(){setBusy(true);setError('');try{await rpc('complete_onboarding',{p_date_of_birth:dob,p_display_name:name,p_intents:intents,p_catchment_ids:[catchmentId],p_bio:bio||null,p_languages:['en']});await refreshAccount()}catch(e){setError(e instanceof Error?e.message:'Could not finish setup')}finally{setBusy(false)}}
 return <Screen className="gap-6 pt-8"><H1>Tell us just enough.</H1><Body>Your intentions stay private. Other people only see your name and what you choose to share.</Body><Field label="Display name" value={name} onChangeText={setName} maxLength={40}/><Field label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation"/><Field label="A short intro (optional)" value={bio} onChangeText={setBio} multiline maxLength={300}/><View className="gap-3"><Text className="font-semibold text-ink">What brings you here?</Text><View className="flex-row flex-wrap gap-2">{options.map(([i,l])=><Pill key={i} label={l} active={intents.includes(i)} onPress={()=>toggle(i)}/>)}</View></View><View className="gap-3"><Text className="font-semibold text-ink">Neighborhood</Text>{catchments.length?<View className="flex-row flex-wrap gap-2">{catchments.map(c=><Pill key={c.id} label={c.name+', '+c.cityName} active={catchmentId===c.id} onPress={()=>setCatchmentId(c.id)}/>)}</View>:<Body>No neighborhoods are live yet. Add one with the seed SQL before onboarding.</Body>}</View><ErrorText message={error}/><Button title="Start exploring" onPress={finish} loading={busy} disabled={!name||!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!catchmentId||!intents.length}/></Screen>
}

