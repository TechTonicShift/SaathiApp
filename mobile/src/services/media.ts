import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
export async function pickAndUpload(bucket:'photos'|'verification', userId:string, camera=false) {
  if (camera) { const p=await ImagePicker.requestCameraPermissionsAsync(); if(!p.granted) throw new Error('Camera permission is required.'); }
  const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes:['images'], quality:.85, cameraType:ImagePicker.CameraType.front }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes:['images'], quality:.85 });
  if (result.canceled) return null;
  const ctx=ImageManipulator.manipulate(result.assets[0].uri); ctx.resize({width:1200});
  const ref=await ctx.renderAsync(); const img=await ref.saveAsync({compress:.75,format:SaveFormat.JPEG});
  const bytes=await (await fetch(img.uri)).arrayBuffer();
  const path=`${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const {error}=await supabase.storage.from(bucket).upload(path,bytes,{contentType:'image/jpeg',upsert:false});
  if(error) throw error; return path;
}
export async function signedPhoto(path?:string|null){ if(!path)return null; const {data}=await supabase.storage.from('photos').createSignedUrl(path,3600); return data?.signedUrl??null; }

