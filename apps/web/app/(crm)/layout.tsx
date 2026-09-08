"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { api } from '@/lib/api';
import { UserContext, type User } from '@/lib/permissions';
export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!localStorage.getItem('crm_token')) { router.replace('/'); return; }
    let current = true;
    api<User>('/auth/me').then(me => {
      if (!current) return;
      localStorage.setItem('crm_user', JSON.stringify({ ...me, id: me.sub }));
      setUser(me);
    }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [router]);
  if (error) return <main className="content"><p className="error" role="alert">{error}</p><button className="btn" onClick={() => location.reload()}>Try again</button></main>;
  if (!user) return <main className="content" aria-busy="true">Loading...</main>;
  return <UserContext.Provider value={user}><div className="shell"><Sidebar /><main className="content">{children}</main></div></UserContext.Provider>;
}
