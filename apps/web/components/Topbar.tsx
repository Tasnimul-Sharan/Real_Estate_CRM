"use client";
import { useEffect, useState } from 'react';

export default function Topbar({title,action}:{title:string,action?:React.ReactNode}){
  const [user,setUser]=useState<any>(null);
  useEffect(()=>{ try{ setUser(JSON.parse(localStorage.getItem('crm_user')||'null')); }catch{} },[]);
  return <div className="topbar"><div><h1>{title}</h1><div className="muted" style={{fontSize:13}}>Real Estate Sales & Inventory Management</div></div><div className="topbar-actions">{action}<span className="badge">{user?.name||'User'}</span></div></div>;
}
