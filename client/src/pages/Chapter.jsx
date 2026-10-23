import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Flag, MessageSquare, Save, Upload, CircleDot, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { get, put, errMsg } from '../lib/api';
import { PageHeader, PageLoader, Badge } from '../components/ui';
import CsvImport from '../components/CsvImport';
import { categoryLabel } from '../lib/constants';

const BENCH_KEY = { 'mid-end': 'midEndAns', premium: 'premiumAns', affluent: 'affluentAns', hi_street: 'hiStreetAns', enclosed_mall: 'enclosedMallAns' };
const isOther = (s) => String(s || '').trim().toLowerCase() === 'any other';
const norm = (s) => String(s).trim().toLowerCase();

function matches(answer, bench) {
  if (!bench || !bench.length) return null;
  if (Array.isArray(answer)) return answer.length ? answer.every((a) => bench.map(norm).includes(norm(a))) : null;
  if (answer === '' || answer === null || answer === undefined) return null;
  return bench.map(norm).includes(norm(answer));
}

function MultiSelect({ options, value, onChange, disabled, tone }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { const f = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false); document.addEventListener('mousedown', f); return () => document.removeEventListener('mousedown', f); }, []);
  const toggle = (opt) => {
    if (isOther(opt)) return onChange(value.some(isOther) ? [] : [opt]);
    const base = value.filter((v) => !isOther(v));
    onChange(base.includes(opt) ? base.filter((v) => v !== opt) : [...base, opt]);
  };
  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} className={`input flex min-h-[38px] items-center justify-between text-left ${tone}`}>
        <span className={`truncate ${value.length ? '' : 'text-ink-400'}`}>{value.length ? value.join(', ') : 'Select one or more'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="card absolute z-20 mt-1 max-h-64 w-full overflow-y-auto py-1">
          {options.map((o) => {
            const on = value.includes(o);
            return (
              <button type="button" key={o} onClick={() => toggle(o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50">
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300'}`}>{on && <Check className="h-3 w-3" />}</span>{o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Question({ field, state, onChange, bench, readOnly }) {
  const multi = field.fieldType === 'multiselect';
  const options = (field.sectionFieldOptions || []).map((o) => o.fieldOption);
  const m = matches(state.answer, bench);
  const tone = m === true ? 'ring-emerald-400' : m === false ? 'ring-red-400' : '';
  const hasOther = multi ? (state.answer || []).some(isOther) : isOther(state.answer);
  const [showRemark, setShowRemark] = useState(false);
  return (
    <div className={`rounded-lg p-3 ${m === false ? 'bg-red-50/50' : ''}`}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-ink-800 first-letter:uppercase">{field.fieldName}</span>
        {m === false && !readOnly && (
          <div className="-mt-1 flex gap-0.5">
            <button type="button" title={state.isFlaged ? 'Remove flag' : 'Flag for review'} onClick={() => onChange({ isFlaged: state.isFlaged ? 0 : 1 })} className={`rounded p-1 hover:bg-ink-100 ${state.isFlaged ? 'text-red-600' : 'text-ink-400'}`}><Flag className="h-3.5 w-3.5" fill={state.isFlaged ? 'currentColor' : 'none'} /></button>
            <button type="button" title="Remark" onClick={() => setShowRemark((s) => !s)} className={`rounded p-1 hover:bg-ink-100 ${state.remark ? 'text-brand-700' : 'text-ink-400'}`}><MessageSquare className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      {field.fieldType === 'select' ? (
        <select className={`input ${tone}`} value={state.answer || ''} disabled={readOnly} onChange={(e) => onChange({ answer: e.target.value })}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : multi ? (
        <MultiSelect options={options} value={Array.isArray(state.answer) ? state.answer : []} onChange={(v) => onChange({ answer: v })} disabled={readOnly} tone={tone} />
      ) : (
        <input className={`input ${tone}`} type={field.fieldType === 'number' ? 'number' : 'text'} value={state.answer || ''} disabled={readOnly} onChange={(e) => onChange({ answer: e.target.value })} />
      )}
      {hasOther && <input className="input mt-2" placeholder="Describe the specification" value={state.anyOtherAnswer || ''} disabled={readOnly} onChange={(e) => onChange({ anyOtherAnswer: e.target.value })} />}
      {bench?.length > 0 && <p className={`mt-1.5 text-xs ${m === false ? 'text-red-600' : 'text-ink-400'}`}>Benchmark: {bench.join(' / ')}</p>}
      {(showRemark || state.remark) && m === false && (
        <textarea className="input mt-2 min-h-[60px] text-xs" placeholder="Why does this differ from the benchmark?" value={state.remark || ''} disabled={readOnly} onChange={(e) => onChange({ remark: e.target.value })} />
      )}
    </div>
  );
}

export default function Chapter() {
  const { projectId, moduleId, chapterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const readOnly = !!location.state?.readOnly;
  const [project, setProject] = useState(null);
  const [moduleName, setModuleName] = useState('');
  const [rows, setRows] = useState(null);
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => { get(`/project/${projectId}`).then(setProject).catch(() => {}); get(`/module/${moduleId}`).then((m) => setModuleName(m.name)).catch(() => {}); }, [projectId, moduleId]);
  useEffect(() => {
    setRows(null);
    get(`/project/${projectId}/module/${moduleId}/chapter`, { chapterId }).then((d) => {
      setRows(d.rows);
      const cur = d.rows.find((r) => String(r.id) === String(chapterId));
      const a = {};
      for (const s of cur?.chapterSections || []) for (const f of s.sectionFields) {
        const fv = f.fieldValue || {};
        a[f.id] = { sectionId: s.id, answer: f.fieldType === 'multiselect' ? (Array.isArray(fv.answer) ? fv.answer : fv.answer ? [fv.answer] : []) : (Array.isArray(fv.answer) ? fv.answer[0] : fv.answer || ''), remark: fv.remark || '', isFlaged: fv.isFlaged || 0, anyOtherAnswer: fv.anyOtherAnswer || '' };
      }
      setAnswers(a);
    }).catch((e) => toast.error(errMsg(e)));
  }, [projectId, moduleId, chapterId, reload]);

  const current = rows?.find((r) => String(r.id) === String(chapterId));
  const benchKey = BENCH_KEY[project?.category];
  const stats = useMemo(() => {
    if (!current) return { answered: 0, total: 0, dev: 0 };
    let answered = 0; let total = 0; let dev = 0;
    for (const s of current.chapterSections || []) for (const f of s.sectionFields) {
      total++; const a = answers[f.id]?.answer;
      if (Array.isArray(a) ? a.length : a) answered++;
      if (matches(a, f[benchKey]) === false) dev++;
    }
    return { answered, total, dev };
  }, [current, answers, benchKey]);

  if (!rows || !project) return <PageLoader />;

  const idx = rows.findIndex((r) => String(r.id) === String(chapterId));
  const next = rows[idx + 1];
  const update = (fid) => (patch) => setAnswers((s) => {
    const n = { ...s[fid], ...patch };
    const f = current.chapterSections.flatMap((x) => x.sectionFields).find((x) => x.id === fid);
    if ('answer' in patch && matches(n.answer, f?.[benchKey]) === true) { n.remark = ''; n.isFlaged = 0; }
    return { ...s, [fid]: n };
  });
  const body = () => Object.entries(answers).map(([fid, a]) => ({ sectionId: a.sectionId, sectionFieldId: Number(fid), answer: a.answer, remark: a.remark, isFlaged: a.isFlaged, anyOtherAnswer: a.anyOtherAnswer }));

  const save = async (final) => {
    if (final) {
      const missing = stats.total - stats.answered;
      if (missing > 0) { toast.error(`${missing} question${missing > 1 ? 's are' : ' is'} unanswered`); return; }
    }
    setSaving(final ? 'final' : 'draft');
    try {
      if (final) {
        await put(`/project/${projectId}/module/${moduleId}/chapter/${chapterId}`, body());
        await put(`/project/${projectId}/save-project-module`, { moduleId: Number(moduleId), completedChapters: current.chapterNumber });
        toast.success(`${current.title} saved`);
        navigate(next ? `/projects/${projectId}/modules/${moduleId}/chapters/${next.id}` : `/projects/${projectId}`, { state: location.state });
      } else {
        await put(`/project/${projectId}/module/${moduleId}/chapter/saveAndDraft/${chapterId}`, body());
        toast.success('Draft saved');
      }
    } catch (e) { toast.error(errMsg(e, 'Could not save')); } finally { setSaving(''); }
  };

  const statusIcon = (r) => (r.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : String(r.id) === String(chapterId) ? <CircleDot className="h-4 w-4 text-brand-600" /> : <Circle className="h-4 w-4 text-ink-300" />);

  return (
    <>
      <PageHeader
        back={<Link to={`/projects/${projectId}`} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />{project.name}</Link>}
        title={moduleName || 'Module'}
        subtitle={`${categoryLabel(project.category)} benchmarks`}
        actions={readOnly ? <Badge tone="blue">Read only</Badge> : <>
          <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import CSV</button>
          <button type="button" className="btn-secondary" disabled={!!saving} onClick={() => save(false)}><Save className="h-4 w-4" />{saving === 'draft' ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="btn-primary" disabled={!!saving} onClick={() => save(true)}>{saving === 'final' ? 'Saving…' : next ? 'Save & continue' : 'Save & finish'}</button>
        </>}
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {rows.map((r) => (
          <Link key={r.id} to={`/projects/${projectId}/modules/${moduleId}/chapters/${r.id}`} state={location.state}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${String(r.id) === String(chapterId) ? 'bg-brand-600 text-white ring-brand-600 [&_svg]:text-white' : 'bg-white text-ink-700 ring-ink-200 hover:ring-brand-300'}`}>
            {statusIcon(r)}{r.title.replace(/\s+/g, ' ')}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Badge tone="gray">{stats.answered} / {stats.total} answered</Badge>
        {stats.dev > 0 && <Badge tone="red">{stats.dev} differ from benchmark</Badge>}
      </div>

      <div className="space-y-5">
        {(current?.chapterSections || []).map((s) => (
          <section key={s.id} className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-brand-800">{s.title}</h2>
            <div className="grid gap-x-4 gap-y-1 md:grid-cols-2 xl:grid-cols-3">
              {s.sectionFields.map((f) => answers[f.id] && (
                <Question key={f.id} field={f} state={answers[f.id]} bench={f[benchKey]} readOnly={readOnly} onChange={update(f.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <CsvImport open={importOpen} onClose={() => setImportOpen(false)} projectId={projectId} moduleId={moduleId} onImported={() => setReload((x) => x + 1)} />
    </>
  );
}
