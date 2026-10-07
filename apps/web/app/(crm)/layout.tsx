"use client";
import { Fragment, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Icon from '@/components/Icon';
import { api } from '@/lib/api';
import { homeFor, routePermission, UserContext, type User } from '@/lib/permissions';
export default function CRMLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!localStorage.getItem('crm_token')) { router.replace('/'); return; }
    let current = true, pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const me = await api<User>('/auth/me');
        if (!current) return;
        localStorage.setItem('crm_user', JSON.stringify({ ...me, id: me.sub }));
        setUser(me); setError('');
      } catch (e: any) { if (current) { setUser(null); setError(e.message); } }
      finally { pending = false; }
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { current = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [router, pathname]);
  const allowed = user?.permissions.includes(routePermission(pathname.split('/')[1]));
  const home = homeFor(user);
  useEffect(() => { if (user && pathname === '/dashboard' && !allowed && home !== '/dashboard') router.replace(home); }, [user, pathname, allowed, home, router]);
  if (error) return <main className="content"><p className="error" role="alert">{error}</p><button className="btn" onClick={() => location.reload()}>Try again</button></main>;
  if (!user) return <main className="content" aria-busy="true">Loading...</main>;
  return <UserContext.Provider value={user}><div className="shell"><Sidebar /><main className="content">{allowed ? <Fragment key={[...user.permissions].sort().join(",")}>{children}</Fragment> : <section className="card access-denied"><Icon name="shield" size={36} /><h1>Access restricted</h1><p>Your role does not have permission to view this feature. Contact your Super Admin to request access.</p>{home !== pathname && <Link href={home} className="btn">Open my workspace</Link>}</section>}</main></div></UserContext.Provider>;
}
