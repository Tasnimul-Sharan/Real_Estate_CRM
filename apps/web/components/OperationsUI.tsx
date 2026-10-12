"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
export const amount=(value:any)=>new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value??0));
export const dhakaDate=()=>new Date(Date.now()+21600000).toISOString().slice(0,10);
export const dateTime=(value:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function Metric({label,value,note}:{label:string;value:string|number;note?:string}){return <div className="card ops-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>;}
export function Empty({children}:{children:React.ReactNode}){return <div className="empty">{children}</div>;}
export default function Reminders(){
 const {can}=usePermissions();const [data,setData]=useState<any>(null);
 const enabled=can('calendar.view')||can('installments.view');
 useEffect(()=>{if(!enabled)return;let active=true;const load=()=>api('/operations/reminders').then(d=>{if(active)setData(d)}).catch(()=>{if(active)setData(null)});load();const timer=setInterval(load,60000);return()=>{active=false;clearInterval(timer)};},[enabled]);
 if(!data)return null;
 const follow=data.followUps,installments=data.installments;
 if(!(follow?.overdue||follow?.today||Number(installments?.overdue)||Number(installments?.dueToday)))return null;
 return <aside className="ops-reminders" aria-label="Reminders"><strong>Needs attention</strong>{follow&&(follow.overdue>0||follow.today>0)&&<Link href="/calendar">My follow-ups: {follow.today} today · {follow.overdue} overdue</Link>}{installments&&(Number(installments.overdue)>0||Number(installments.dueToday)>0)&&<Link href="/installments">Collections: {amount(installments.dueToday)} due today · {amount(installments.overdue)} overdue</Link>}</aside>;
}
