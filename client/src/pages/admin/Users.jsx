import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { get, post, put, del, errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PageHeader, PageLoader, Modal, Field, Badge, Confirm, Empty } from '../../components/ui';
import { ROLES, DEPARTMENTS, COMPANIES, roleLabel, deptLabel, companyLabel } from '../../lib/constants';

const BLANK = { name: '', email: '', phone: '', company: '', department: '', role: '', password: '', status: 'active' };
const DESIGN_DEPTS = ['design', 'design_arch', 'design_str', 'design_mep'];
const rolesFor = (dept) => (dept === 'super_admin' ? ROLES.filter((r) => r.value === 'super_admin')
  : DESIGN_DEPTS.includes(dept) ? ROLES.filter((r) => r.value.startsWith('design_'))
  : dept ? ROLES.filter((r) => r.value.startsWith('general_')) : ROLES);

function UserForm({ initial, onClose, onSaved }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value, ...(k === 'department' ? { role: '' } : {}) }));
  const submit = async (e) => {
    e.preventDefault();
    if (!v.name || !v.email || !v.department || !v.role) { toast.error('Name, email, department and role are required'); return; }
    if (!editing && v.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (editing && v.password && v.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setBusy(true);
    const body = { ...v }; if (!body.password) delete body.password; delete body.id;
    try { editing ? await put(`/auth/users/${initial.id}`, body) : await post('/auth/users', body); toast.success(editing ? 'User updated' : 'User added'); onSaved(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={editing ? 'Edit user' : 'Add user'} wide footer={<>
      <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" form="user-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add user'}</button>
    </>}>
      <form id="user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><input className="input" value={v.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="input" type="email" value={v.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="input" value={v.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Company">
          <select className="input" value={v.company || ''} onChange={set('company')}><option value="">—</option>{COMPANIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        </Field>
        <Field label="Department">
          <select className="input" value={v.department || ''} onChange={set('department')}><option value="">Select…</option>{DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
        </Field>
        <Field label="Role">
          <select className="input" value={v.role || ''} onChange={set('role')}><option value="">Select…</option>{rolesFor(v.department).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </Field>
        <Field label={editing ? 'New password' : 'Password'} hint={editing ? 'Leave blank to keep the current password' : 'At least 8 characters'}>
          <input className="input" type="password" autoComplete="new-password" value={v.password} onChange={set('password')} />
        </Field>
        {editing && <Field label="Status"><select className="input" value={v.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive (cannot sign in)</option></select></Field>}
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => get('/auth/users').then(setUsers).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);
  const rows = useMemo(() => (users || []).filter((u) => (!dept || u.department === dept) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))), [users, q, dept]);
  if (!users) return <PageLoader />;
  const remove = async () => {
    setBusy(true);
    try { await del(`/auth/users/${removing.id}`); toast.success('User removed'); setRemoving(null); load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Users" subtitle={`${users.length} accounts`} actions={<button type="button" className="btn-primary" onClick={() => setEditing({ ...BLANK })}><Plus className="h-4 w-4" />Add user</button>} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-3 border-b border-ink-100 p-4">
          <div className="relative min-w-[14rem] flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-56" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
        </div>
        {rows.length === 0 ? <Empty title="No users found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-ink-50/60"><tr><th className="th">Name</th><th className="th">Department</th><th className="th">Role</th><th className="th">Company</th><th className="th">Status</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="td"><p className="font-medium text-ink-900">{u.name || '—'} {u.id === me.id && <Badge tone="brand" className="ml-1">You</Badge>}</p><p className="text-xs text-ink-500">{u.email}</p></td>
                    <td className="td">{deptLabel(u.department)}</td>
                    <td className="td">{roleLabel(u.role)}</td>
                    <td className="td">{companyLabel(u.company)}</td>
                    <td className="td">{u.status === 'inactive' ? <Badge tone="gray">Inactive</Badge> : <Badge tone="green">Active</Badge>}</td>
                    <td className="td"><div className="flex justify-end gap-1">
                      <button type="button" className="btn-ghost p-1.5" title="Edit" onClick={() => setEditing({ ...BLANK, ...u, password: '' })}><Pencil className="h-4 w-4" /></button>
                      {u.id !== me.id && <button type="button" className="btn-ghost p-1.5 hover:text-red-600" title="Delete" onClick={() => setRemoving(u)}><Trash2 className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <UserForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <Confirm open={!!removing} danger busy={busy} title="Delete user" confirmLabel="Delete user" message={`${removing?.name || removing?.email} will no longer be able to sign in. Their past activity stays in the log.`} onClose={() => setRemoving(null)} onConfirm={remove} />
    </>
  );
}
