import { Alert,Text,View } from 'react-native';
import { router } from 'expo-router';
import { Button,Card,H1,Body,Screen } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { supabase,rpc } from '@/services/supabase';
import { pickAndUpload } from '@/services/media';
export default function Me(){
 const{user,profile}=useAuthStore();
 async function addPhoto(){try{const key=await pickAndUpload('photos',user!.id);if(!key)return;const{count}=await supabase.from('ProfilePhoto').select('*',{count:'exact',head:true}).eq('profileId',user!.id);const{error}=await supabase.from('ProfilePhoto').insert({profileId:user!.id,storageKey:key,position:count??0});if(error)throw error;Alert.alert('Photo uploaded','It will appear to others after a quick review.')}catch(e){Alert.alert('Could not add photo',e instanceof Error?e.message:'Try again')}}
 async function applyHost(){const{error}=await supabase.from('Host').insert({userId:user!.id,bio:profile?.bio});if(error&&!error.message.includes('duplicate'))Alert.alert('Could not apply',error.message);else Alert.alert('Application received','Approve it in the Supabase table editor for the pilot.')}
 function remove(){Alert.alert('Delete account?','Your profile and login will be permanently removed.',[{text:'Keep account',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{await rpc('delete_my_account');useAuthStore.getState().setSession(null)}}])}
 return <Screen className="gap-5 pt-5"><H1>{profile?.displayName??'Your profile'}.</H1><Body>{user?.email}</Body><Card><Text className="font-bold text-ink">Profile photo</Text><Body className="mt-2">Add up to six. New photos need a quick manual review.</Body><View className="mt-4"><Button kind="secondary" title="Add photo" onPress={addPhoto}/></View></Card><Card><Text className="font-bold text-ink">Verification</Text><Text className="mt-2 text-muted">{user?.verificationStatus==='APPROVED'?'✓ Verified adult':user?.verificationStatus==='PENDING'?'Under review':'Required before your first booking'}</Text>{user?.verificationStatus!=='APPROVED'&&<View className="mt-4"><Button title="Verify identity" onPress={()=>router.push('/verification')}/></View>}</Card><Card><Text className="font-bold text-ink">Host a small plan</Text><Body className="mt-2">Start with one activity, one venue, and 4–8 people.</Body><View className="mt-4 gap-2"><Button title="Create a plan" onPress={()=>router.push('/host/create')}/><Button kind="secondary" title="Apply to host" onPress={applyHost}/></View></Card><Button kind="secondary" title="Sign out" onPress={()=>supabase.auth.signOut()}/><Button kind="danger" title="Delete account" onPress={remove}/></Screen>
}

