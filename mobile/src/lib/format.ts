export const money=(minor:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:0}).format(minor/100);
export const when=(iso:string)=>new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(iso));
export const label=(s:string)=>s.toLowerCase().replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());

