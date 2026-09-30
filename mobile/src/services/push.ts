import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function registerPush(userId:string){
  if(!Device.isDevice)return;
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync('default',{name:'Saath',importance:Notifications.AndroidImportance.DEFAULT});
  let p=await Notifications.getPermissionsAsync(); if(p.status!=='granted')p=await Notifications.requestPermissionsAsync(); if(p.status!=='granted')return;
  const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID??Constants.expoConfig?.extra?.eas?.projectId;
  if(!projectId)return;
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  await supabase.from('User').update({expoPushToken:token,lastActiveAt:new Date().toISOString()}).eq('id',userId);
}

