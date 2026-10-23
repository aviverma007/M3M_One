import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, MapPin, Trash2, Pencil, ArrowRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { get, del, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getPortfolio } from '../components/Layout';
import { PageHeader, PageLoader, Empty, Badge, Confirm, Pagination } from '../components/ui';
import { PROJECT_TYPES, CATEGORIES, ALL_CATEGORIES, categoryLabel, fmtDate, canManageProjects, isAdmin } from '../lib/constants';

const TYPE_TONE = { residential: 'brand', commercial: 'blue' };

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(getPortfolio());
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { const f = () => setPortfolio(getPortfolio()); window.addEventListener('m3m:portfolio', f); return () => window.removeEventListener('m3m:portfolio', f); }, []);
  useEffect(() => { setPage(1); }, [debounced, type, category, from, to, portfolio]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await get('/project', { search: debounced, projectType: type, projectCategory: category, fromDate: from, toDate: to ? `${to}T23:59:59` : '', page, limit: 12, locationCategory: portfolio }));
    } catch (e) { toast.error(errMsg(e, 'Could not load projects')); } finally { setLoading(false); }
  }, [debounced, type, category, from, to, page, portfolio]);
  useEffect(() => { load(); }, [load]);

  const categories = type ? CATEGORIES[type] : ALL_CATEGORIES;
  const filtersOn = search || type || category || from || to;
  const reset = () => { setSearch(''); setType(''); setCategory(''); setFrom(''); setTo(''); };

  const remove = async () => {
    setDeleting(true);
    try { await del(`/project/${toDelete.id}`); toast.success(`${toDelete.name} deleted`); setToDelete(null); load(); } catch (e) { toast.error(errMsg(e)); } finally { setDeleting(false); }
  };

  const rows = useMemo(() => data?.rows || [], [data]);

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={portfolio ? `${portfolio} portfolio` : 'All portfolios'}
        actions={canManageProjects(user) && <Link to="/projects/new" className="btn-primary"><Plus className="h-4 w-4" />New project</Link>}
      />

      <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <input className="input pl-9" placeholder="Search by name or category" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" value={type} onChange={(e) => { setType(e.target.value); setCategory(''); }}>
          <option value="">All types</option>
          {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Project date from" />
        <div className="flex gap-2">
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Project date to" />
          {filtersOn && <button type="button" className="btn-ghost px-2" onClick={reset} title="Clear filters"><X className="h-4 w-4" /></button>}
        </div>
      </div>

      {loading && !data ? <PageLoader /> : rows.length === 0 ? (
        <div className="card"><Empty title={filtersOn ? 'No projects match these filters' : 'No projects yet'}>{canManageProjects(user) && !filtersOn && 'Create the first one with "New project".'}</Empty></div>
      ) : (
        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
          {rows.map((p) => (
            <div key={p.id} className="card group flex flex-col p-5 transition hover:ring-brand-300">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => navigate(`/projects/${p.id}`)} className="min-w-0 text-left">
                  <h3 className="truncate text-base font-semibold text-ink-900 group-hover:text-brand-700">{p.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{p.location || '—'}</p>
                </button>
                <Badge tone={TYPE_TONE[p.projectType] || 'gray'} className="capitalize">{p.projectType || '—'}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><dt className="text-xs text-ink-400">Category</dt><dd className="font-medium">{categoryLabel(p.category)}</dd></div>
                <div><dt className="text-xs text-ink-400">Stage</dt><dd className="truncate font-medium">{p.projectClassification || '—'}</dd></div>
                <div><dt className="text-xs text-ink-400">Portfolio</dt><dd className="font-medium">{p.locationCategory || '—'}</dd></div>
                <div><dt className="text-xs text-ink-400">Date</dt><dd className="font-medium">{fmtDate(p.date)}</dd></div>
              </dl>
              <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-3">
                <div className="flex gap-1">
                  {canManageProjects(user) && <Link to={`/projects/${p.id}/edit`} className="btn-ghost p-1.5" title="Edit details"><Pencil className="h-4 w-4" /></Link>}
                  {isAdmin(user) && <button type="button" className="btn-ghost p-1.5 hover:text-red-600" title="Delete" onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4" /></button>}
                </div>
                <Link to={`/projects/${p.id}`} className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:gap-2 transition-all">Open<ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm text-ink-500">{data.count} project{data.count === 1 ? '' : 's'}</span>
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </div>
      )}

      <Confirm open={!!toDelete} danger busy={deleting} title="Delete project" confirmLabel="Delete project"
        message={`${toDelete?.name} and all its key ratios, answers and progress will be permanently removed.`}
        onClose={() => setToDelete(null)} onConfirm={remove} />
    </>
  );
}
