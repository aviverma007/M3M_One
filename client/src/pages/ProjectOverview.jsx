import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Gauge, ClipboardList, Lock, Eye, Flag, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { get, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader, PageLoader, Badge, Empty } from '../components/ui';
import { categoryLabel, fmtDate, canManageProjects } from '../lib/constants';

function Ring({ value }) {
  const r = 22; const c = 2 * Math.PI * r; const pct = Math.max(0, Math.min(100, value || 0));
  const color = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#eceef1" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      <text x="28" y="33" textAnchor="middle" className="rotate-90 origin-center fill-ink-800 text-[13px] font-semibold">{pct}</text>
    </svg>
  );
}

export default function ProjectOverview() {
  const { projectId } = useParams();
  const { user, moduleAccess } = useAuth();
  const [project, setProject] = useState(null);
  const [modules, setModules] = useState(null);

  useEffect(() => {
    get(`/project/${projectId}`).then(setProject).catch((e) => toast.error(errMsg(e)));
    get(`/project/${projectId}/module`).then((d) => setModules((d.rows || []).filter((m) => typeof m.id === 'number'))).catch((e) => toast.error(errMsg(e)));
  }, [projectId]);

  if (!project || !modules) return <PageLoader />;

  const info = [
    ['Type', <span className="capitalize">{project.projectType}</span>],
    ['Category', categoryLabel(project.category)],
    ['Stage', project.projectClassification || '—'],
    ['Portfolio', project.locationCategory || '—'],
    ['Permissible FAR', project.far_permissible ? `${Number(project.far_permissible).toLocaleString('en-IN')} sq m` : '—'],
    ['Site area', project.site_area_acres ? `${Number(project.site_area_acres)} acres` : '—'],
    ['Project architect', project.projectOwner || '—'],
    ['Date', fmtDate(project.date)],
  ];

  const linkFor = (m) => (/key ratio/i.test(m.name) ? `/projects/${projectId}/key-ratio` : m.firstChapterId ? `/projects/${projectId}/modules/${m.id}/chapters/${m.firstChapterId}` : null);

  return (
    <>
      <PageHeader
        back={<Link to="/projects" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />Projects</Link>}
        title={project.name}
        subtitle={project.location}
        actions={canManageProjects(user) && <Link to={`/projects/${projectId}/edit`} className="btn-secondary"><Pencil className="h-4 w-4" />Edit details</Link>}
      />

      <div className="card mb-8 grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-4">
        {info.map(([k, val]) => <div key={k}><p className="text-xs text-ink-400">{k}</p><p className="mt-0.5 text-sm font-medium text-ink-800">{val}</p></div>)}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Modules</h2>
      {modules.length === 0 ? <div className="card"><Empty title="No modules configured for this project type" /></div> : (
        <div className="space-y-3">
          {modules.map((m) => {
            const access = moduleAccess(m.name);
            const pm = m.projectModule || {};
            const href = linkFor(m);
            const done = pm.status === 'completed';
            const Icon = /key ratio/i.test(m.name) ? Gauge : ClipboardList;
            const totalCh = m.moduleChapters?.length || 0;
            const body = (
              <div className={`card flex flex-wrap items-center gap-5 p-5 transition ${access === 'none' || !href ? 'opacity-60' : 'hover:ring-brand-300'}`}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></div>
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{m.name}</h3>
                    {done && <Badge tone="green"><CheckCircle2 className="h-3 w-3" />Complete</Badge>}
                    {access === 'view' && <Badge tone="blue"><Eye className="h-3 w-3" />Read only</Badge>}
                    {access === 'none' && <Badge tone="gray"><Lock className="h-3 w-3" />No access</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    {totalCh ? `${Math.min(pm.completedChapters || 0, totalCh)} of ${totalCh} chapters saved · ` : ''}
                    {pm.allParams || 0} parameters
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div><p className="text-xs text-ink-400">Within benchmark</p><p className="font-semibold text-emerald-700">{pm.benchmarkParams || 0}</p></div>
                  <div><p className="text-xs text-ink-400">Deviations</p><p className="font-semibold text-red-600">{pm.deviations || 0}</p></div>
                  <div><p className="flex items-center gap-1 text-xs text-ink-400"><Flag className="h-3 w-3" />Flagged</p><p className="font-semibold text-ink-800">{pm.flags || 0}</p></div>
                </div>
                <div className="flex items-center gap-2" title="Compliance score (% of answered parameters within benchmark)"><Ring value={pm.complianceScore} /></div>
              </div>
            );
            return access === 'none' || !href ? <div key={m.id}>{body}</div> : <Link key={m.id} to={href} state={{ readOnly: access === 'view' }} className="block">{body}</Link>;
          })}
        </div>
      )}
    </>
  );
}
