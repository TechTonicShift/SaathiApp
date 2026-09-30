import type { Choice } from '@/types';
export type MatchType='DATING'|'FRIENDSHIP'|null;
export function resolveMatchType(a:Choice,b:Choice,aDating=true,bDating=true):MatchType{
 if(a==='PASS'||b==='PASS')return null;
 if(['DATING','EITHER'].includes(a)&&['DATING','EITHER'].includes(b)&&aDating&&bDating)return 'DATING';
 if(['FRIENDSHIP','EITHER'].includes(a)&&['FRIENDSHIP','EITHER'].includes(b))return 'FRIENDSHIP';
 return null;
}

