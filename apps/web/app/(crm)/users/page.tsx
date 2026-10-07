"use client";
import { FormEvent, useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import Topbar from '@/components/Topbar';
import Modal from '@/components/Modal';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
const initial = { name: '', email: '', phone: '', password: '', role: 'SALES_EXECUTIVE', status: 'ACTIVE' };
export default function Users() {
  const { can, user } = usePermissions();
  const [list, setList] = useState<any[]>([]), [roles, setRoles] = useState<string[]>([]);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(initial), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { setList(await api('/users')); setRoles(await api('/access/assignable-roles')); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  function edit(person: any) { setEditing(person.id); setForm({ ...initial, ...person, phone: person.phone || '', password: '' }); setError(''); setOpen(true); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const body = editing ? { name: form.name, phone: form.phone || undefined, role: form.role, status: form.status } : { name: form.name, email: form.email, phone: form.phone || undefined, password: form.password, role: form.role };
      await api(editing ? `/users/${editing}` : '/users', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setOpen(false); await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }
  return <>
    <Topbar title="Team & Users" action={can('users.create') && <button className="btn" disabled={!roles.length} onClick={() => {setEditing(null);setForm({...initial,role:roles.includes(initial.role)?initial.role:roles[0]});setError('');setOpen(true);}}><Icon name="plus" size={16} />New User</button>} />
    {error && !open && <div className="error" role="alert">{error}</div>}
    <div className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Created</th>{can('users.edit') && <th>Actions</th>}</tr></thead><tbody>{list.map(person => <tr key={person.id}><td><b>{person.name}</b>{person.id === user?.sub && <span className="count-pill">You</span>}</td><td>{person.email}</td><td>{person.phone || '—'}</td><td><span className="badge">{person.role.replaceAll('_',' ')}</span></td><td><span className={`badge ${person.status}`}>{person.status}</span></td><td>{new Date(person.createdAt).toLocaleDateString()}</td>{can('users.edit') && <td>{roles.includes(person.role) && <button className="btn secondary" aria-label={`Edit ${person.name}`} onClick={() => edit(person)}>Edit user</button>}</td>}</tr>)}</tbody></table></div></div>
    {open && <Modal title={editing ? 'Edit user & role' : 'Create User'} onClose={() => setOpen(false)}>
      {error && <div className="error" role="alert">{error}</div>}
      <form className="form-grid" onSubmit={save}>
        <div className="field"><label htmlFor="user-name">Name</label><input id="user-name" name="name" autoComplete="name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
        <div className="field"><label htmlFor="user-email">Email</label><input id="user-email" name="email" type="email" autoComplete="email" required disabled={!!editing} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
        <div className="field"><label htmlFor="user-phone">Phone</label><input id="user-phone" name="phone" autoComplete="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
        {!editing && <div className="field"><label htmlFor="user-password">Password</label><input id="user-password" name="password" type="password" minLength={8} autoComplete="new-password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>}
        <div className="field"><label htmlFor="user-role">Role</label><select id="user-role" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(role=><option key={role} value={role}>{role.replaceAll('_',' ')}</option>)}</select></div>
        {editing && <div className="field"><label htmlFor="user-status">Account status</label><select id="user-status" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>}
        <p className="muted full">The selected role determines this user’s feature access. Role and status changes apply to existing sessions.</p>
        <button className="btn full" disabled={saving || !roles.includes(form.role)}>{saving ? 'Saving…' : editing ? 'Save user' : 'Create User'}</button>
      </form>
    </Modal>}
  </>;
}
