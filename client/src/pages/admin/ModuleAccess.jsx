import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { get, post, put, errMsg } from '../../lib/api';
import { PageHeader, PageLoader, Badge } from '../../components/ui';
import { DEPARTMENTS, COMPANIES, ACCESS_MODULES, DEFAULT_ACCESS } from '../../lib/constants';

const LEVELS = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: 'Read only' },
  { value: 'edit', label: 'Edit' },
];
const DEPTS = DEPARTMENTS.filter((d) => d.value !== 'super_admin');

// Access is stored per company + department as role records named "<company>:<department>"
export default function ModuleAccess() {
  const [roles, setRoles] = useState(null);
  const [company, setCompany] = useState(COMPANIES[0].value);
  const [grid, setGrid] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => get('/roles').then(setRoles).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const recordFor = useMemo(() => (dept) => roles?.find((r) => r.roleName === `${company}:${dept}`), [roles, company]);
  useEffect(() => {
    if (!roles) return;
    const g = {};
    for (const d of DEPTS) {
      const rec = recordFor(d.value);
      g[d.value] = {};
      for (const m of ACCESS_MODULES) {
        const p = rec?.permissions?.find((x) => x.name === `module:${m}`);
        g[d.value][m] = p ? (p.access || 'none') : (DEFAULT_ACCESS[d.value]?.[m] || 'none');
      }
    }
    setGrid(g); setDirty(false);
  }, [roles, company, recordFor]);

  if (!roles) return <PageLoader />;

  const setCell = (dept, mod, val) => { setGrid((g) => ({ ...g, [dept]: { ...g[dept], [mod]: val } })); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try {
      for (const d of DEPTS) {
        const permissions = ACCESS_MODULES.map((m) => ({ name: `module:${m}`, access: grid[d.value][m], status: grid[d.value][m] !== 'none' }));
        const rec = recordFor(d.value);
        if (rec) await put(`/roles/${rec.id}`, { roleName: rec.roleName, permissions });
        else await post('/roles', { roleName: `${company}:${d.value}`, description: `Module access for ${company} / ${d.value}`, permissions });
      }
      toast.success('Access saved'); await load();
    } catch (e) { toast.error(errMsg(e, 'Could not save access')); } finally { setSaving(false); }
  };

  const cellTone = { none: 'text-ink-400', view: 'text-sky-700', edit: 'text-emerald-700 font-medium' };

  return (
    <>
      <PageHeader title="Module access" subtitle="Who can open and edit each module, per company and department. Super admins always have full access."
        actions={<button type="button" className="btn-primary" disabled={!dirty || saving} onClick={save}><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {COMPANIES.map((c) => (
          <button type="button" key={c.value} onClick={() => { if (dirty && !window.confirm('Discard unsaved changes?')) return; setCompany(c.value); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${company === c.value ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-700 ring-ink-200'}`}>{c.label}</button>
        ))}
        {dirty && <Badge tone="amber">Unsaved changes</Badge>}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-ink-50/60"><tr><th className="th">Department</th>{ACCESS_MODULES.map((m) => <th key={m} className="th">{m}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100">
            {DEPTS.map((d) => (
              <tr key={d.value}>
                <td className="td font-medium text-ink-800">{d.label}{!recordFor(d.value) && <span className="ml-2 text-xs font-normal text-ink-400">default</span>}</td>
                {ACCESS_MODULES.map((m) => (
                  <td key={m} className="td">
                    <select className={`input py-1.5 ${cellTone[grid[d.value]?.[m]]}`} value={grid[d.value]?.[m] || 'none'} onChange={(e) => setCell(d.value, m, e.target.value)}>
                      {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-400">Users without a company use their department's default until a company is set on their account.</p>
    </>
  );
}
