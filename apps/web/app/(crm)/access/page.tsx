"use client";
import { useCallback, useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import Icon from '@/components/Icon';
import { api } from '@/lib/api';
type Feature = { key: string; label: string; actions: string[] };
type Policy = { role: string; permissions: string[]; version: number; updatedAt: string | null; locked: boolean };
type Catalog = { features: Feature[]; dependencies: Record<string, string[]>; roles: Policy[] };
const label = (role: string) => role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const actionLabels: Record<string, string> = { view: 'View', create: 'Create', edit: 'Edit', convert: 'Convert to customer', blocks: 'Manage blocks' };
export default function AccessPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [role, setRole] = useState('VIEWER');
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ id: string; role: string; before: string[]; after: string[]; createdAt: string }[]>([]);
  const policy = catalog?.roles.find(r => r.role === role);
  const dirty = !!policy && JSON.stringify([...draft].sort()) !== JSON.stringify([...policy.permissions].sort());
  const load = useCallback(async () => {
    try { const data = await api<Catalog>('/access/roles'); setCatalog(data); setError(''); setHistory(await api('/access/history')); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraft(catalog?.roles.find(r => r.role === role)?.permissions ?? []); }, [catalog, role]);
  function toggle(key: string, enabled: boolean) {
    if (!catalog || policy?.locked) return;
    const next = new Set(draft);
    if (enabled) {
      const add = (permission: string) => { if (next.has(permission)) return; next.add(permission); (catalog.dependencies[permission] ?? []).forEach(add); };
      add(key);
    } else {
      next.delete(key);
      let changed = true;
      while (changed) { changed = false; for (const permission of next) if ((catalog.dependencies[permission] ?? []).some(d => !next.has(d))) { next.delete(permission); changed = true; } }
    }
    setDraft([...next]); setMessage(''); setError('');
  }
  async function save() {
    if (!policy || policy.locked) return;
    setSaving(true); setError(''); setMessage('');
    try { await api(`/access/roles/${role}`, { method: 'PUT', body: JSON.stringify({ permissions: draft, version: policy.version }) }); await load(); setMessage(`Access saved for ${label(role)}. API restrictions apply immediately; open screens refresh within 15 seconds.`); }
    catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }
  return <>
    <Topbar title="Roles & Access" />
    <section className="card access-intro"><span className="icon-tile violet"><Icon name="shield" /></span><div><h2>The right access for every role</h2><p>Choose what your team can see and do. Changes apply to everyone assigned to the selected role.</p></div></section>
    {error && <div className="error" role="alert">{error}<button className="btn secondary" onClick={load}>Reload permissions</button></div>}
    {message && <div className="success" role="status">{message}</div>}
    {!catalog ? <p aria-busy="true">Loading permissions…</p> : <section className="card access-editor">
      <div className="access-controls"><div className="field"><label htmlFor="access-role">Role to configure</label><select id="access-role" value={role} disabled={saving} onChange={e => {setRole(e.target.value);setMessage('');setError('');}}>{catalog.roles.map(r => <option key={r.role} value={r.role}>{label(r.role)}{r.locked ? ' · Full access (protected)' : ''}</option>)}</select></div><div className="access-summary"><strong>{draft.filter(p => p !== 'access.manage').length} permissions enabled</strong><span>{policy?.locked ? 'Super Admin access cannot be removed' : dirty ? 'Unsaved changes' : 'All changes saved'}</span></div></div>
      <p className="access-help">Related read permissions are included automatically. Turning off View also turns off actions that require it. “Edit” on Bookings includes changing its status. Access settings are reserved for Super Admin.</p>
      <div className="table-wrap"><table className="table access-table"><thead><tr><th>Feature</th><th>View</th><th>Create</th><th>Edit</th><th>Other actions</th></tr></thead><tbody>{catalog.features.map(feature => <tr key={feature.key}><th scope="row">{feature.label}</th>{['view','create','edit'].map(action => <td key={action}>{feature.actions.includes(action) ? <input type="checkbox" aria-label={`${feature.label}: ${actionLabels[action]}`} checked={draft.includes(`${feature.key}.${action}`)} disabled={saving || policy?.locked} onChange={e => toggle(`${feature.key}.${action}`,e.target.checked)} /> : <span className="muted" aria-label="Not available">—</span>}</td>)}<td>{feature.actions.filter(a => !['view','create','edit'].includes(a)).map(action => <label className="access-extra" key={action}><input type="checkbox" checked={draft.includes(`${feature.key}.${action}`)} disabled={saving || policy?.locked} onChange={e => toggle(`${feature.key}.${action}`,e.target.checked)} />{actionLabels[action]}</label>)}</td></tr>)}</tbody></table></div>
      <div className="access-save"><span className="muted">{policy?.updatedAt ? `Last saved ${new Date(policy.updatedAt).toLocaleString()}` : 'Using the default role permissions'}</span><div><button className="btn secondary" disabled={!dirty || saving} onClick={() => setDraft(policy?.permissions ?? [])}>Discard changes</button><button className="btn" disabled={!dirty || saving || policy?.locked} onClick={save}><Icon name="check" size={16} />{saving ? 'Saving…' : 'Save access'}</button></div></div>
    </section>}
    <section className="card access-history"><h2>Recent permission changes</h2>{history.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Role</th><th>Changes</th><th>Saved</th></tr></thead><tbody>{history.map(entry => <tr key={entry.id}><td>{label(entry.role)}</td><td>{entry.after.filter(p => !entry.before.includes(p)).length} granted · {entry.before.filter(p => !entry.after.includes(p)).length} removed</td><td>{new Date(entry.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="muted">Permission changes will appear here after the first save.</p>}</section>
  </>;
}
