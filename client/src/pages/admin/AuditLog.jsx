import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { get, download, errMsg } from '../../lib/api';
import { PageHeader, PageLoader, Empty, Pagination, Badge } from '../../components/ui';
import { AUDIT_TYPES, fmtDateTime } from '../../lib/constants';

const toneFor = (t) => (/Deleted/.test(t) ? 'red' : /Created|Creation|Added/.test(t) ? 'green' : /Login|Password/.test(t) ? 'blue' : /Completed/.test(t) ? 'brand' : 'gray');

export default function AuditLog() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [debounced, type, from, to]);
  const params = { search: debounced || undefined, type: type || undefined, fromDate: from || undefined, toDate: to || undefined };
  useEffect(() => {
    get('/audit-logs', { ...params, page, limit: 20 }).then(setData).catch((e) => toast.error(errMsg(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debounced, type, from, to]);

  const exportCsv = () => download('/audit-logs/export', `activity-log-${new Date().toISOString().slice(0, 10)}.csv`, params).catch((e) => toast.error(errMsg(e)));

  return (
    <>
      <PageHeader title="Activity log" subtitle="Sign-ins, project changes and saves across the platform." actions={<button type="button" className="btn-secondary" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</button>} />
      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-ink-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-400" /><input className="input pl-9" placeholder="Search user or description" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="">All activity</option>{AUDIT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
        </div>
        {!data ? <PageLoader /> : data.logs.length === 0 ? <Empty title="No activity matches these filters" /> : (
          <ul className="divide-y divide-ink-100">
            {data.logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="w-40 shrink-0 text-xs tabular-nums text-ink-400">{fmtDateTime(l.createdAt)}</span>
                <Badge tone={toneFor(l.taskType)} className="shrink-0">{l.taskType}</Badge>
                <span className="min-w-0 flex-1 text-sm text-ink-700">{l.description}</span>
                <span className="text-sm font-medium text-ink-800">{l.Creator?.name || 'System'}</span>
              </li>
            ))}
          </ul>
        )}
        {data && <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3"><span className="text-sm text-ink-500">{data.totalLogs} entries</span><Pagination page={page} totalPages={data.totalPages} onChange={setPage} /></div>}
      </div>
    </>
  );
}
