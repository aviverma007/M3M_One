import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, MessageSquare, Upload, Save, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import * as K from '@shared/keyRatio.js';
import { get, post, put, errMsg } from '../lib/api';
import { PageHeader, PageLoader, Badge, Modal, Empty } from '../components/ui';
import CsvImport from '../components/CsvImport';
import { categoryLabel, cr } from '../lib/constants';

// Which input groups belong to which discipline tab
const TAB_GROUPS = { Design: ['Efficiency', 'Apt Configuration/ Dimensions', 'Non-Apt Configuration', 'Non-Apt Efficiencies'], Structure: ['Structure'], MEP: ['MEP'] };
const STATUS = {
  green: { tone: 'green', text: 'Within' },
  yellow: { tone: 'amber', text: 'Near limit' },
  red: { tone: 'red', text: 'Outside' },
  gray: { tone: 'gray', text: 'Awaiting input' },
};

function NumberInput({ value, onChange, disabled }) {
  return (
    <input className="input py-1.5 text-right tabular-nums" inputMode="decimal" disabled={disabled}
      value={value ?? ''} onChange={(e) => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) onChange(v === '' ? null : v); }} />
  );
}

function RemarkDialog({ row, onClose, onSave }) {
  const [text, setText] = useState(row?.remark || '');
  useEffect(() => setText(row?.remark || ''), [row]);
  return (
    <Modal open={!!row} onClose={onClose} title={`Remark — ${row?.name || ''}`} footer={<>
      <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="btn-primary" onClick={() => onSave(text)}>Save remark</button>
    </>}>
      <p className="mb-3 text-sm text-ink-500">Explain why this value is outside the benchmark.</p>
      <textarea className="input min-h-[100px]" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
    </Modal>
  );
}

function ResultsTable({ rows, readOnly, onFlag, onRemark }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-ink-100 bg-ink-50/60"><tr>
          <th className="th">Ratio</th><th className="th text-right">Value</th><th className="th">Benchmark</th><th className="th">Status</th><th className="th text-right">Impact</th><th className="th w-20" />
        </tr></thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => {
            const st = STATUS[r.check.color] || STATUS.gray;
            const fail = r.check.value === K.STATUS.FAIL;
            return (
              <tr key={r.id} className={r.flag ? 'bg-red-50/40' : ''}>
                <td className="td"><p className="font-medium text-ink-800 first-letter:uppercase">{r.name}</p>{r.remark && <p className="mt-0.5 text-xs italic text-ink-500">“{r.remark}”</p>}</td>
                <td className="td text-right font-semibold tabular-nums">{r.value ?? '—'}{r.value !== null && r.unit ? <span className="ml-1 text-xs font-normal text-ink-400">{r.unit}</span> : null}</td>
                <td className="td whitespace-nowrap text-ink-500">{r.range || '—'}</td>
                <td className="td"><Badge tone={st.tone} className="whitespace-nowrap" >{st.text}</Badge>{r.check.message && r.check.color !== 'green' && <p className="mt-1 text-xs text-ink-400">{r.check.message}</p>}</td>
                <td className={`td whitespace-nowrap text-right tabular-nums ${r.id === 27 ? 'text-amber-600' : r.cost > 0 ? 'text-red-600' : r.cost < 0 ? 'text-emerald-700' : 'text-ink-300'}`}
                  title={r.id === 27 ? 'Extra profit if the full permissible FAR were used at current ratios' : undefined}>
                  {r.cost ? (r.id === 27 ? `${cr(r.cost)} potential` : cr(r.cost)) : '—'}
                </td>
                <td className="td">
                  {fail && !readOnly && (
                    <div className="flex justify-end gap-1">
                      <button type="button" title={r.flag ? 'Remove flag' : 'Flag for review'} onClick={() => onFlag(r.id)} className={`rounded p-1.5 hover:bg-ink-100 ${r.flag ? 'text-red-600' : 'text-ink-400'}`}><Flag className="h-4 w-4" fill={r.flag ? 'currentColor' : 'none'} /></button>
                      <button type="button" title="Add remark" onClick={() => onRemark(r)} className={`rounded p-1.5 hover:bg-ink-100 ${r.remark ? 'text-brand-700' : 'text-ink-400'}`}><MessageSquare className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ residential
function Residential({ project, readOnly }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [inputs, setInputs] = useState({});
  const [marks, setMarks] = useState({}); // { id: { flag, remark } }
  const [tab, setTab] = useState('Design');
  const [remarkRow, setRemarkRow] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    get('/keyRatio', { project_id: project.id }).then((d) => {
      setData(d);
      setInputs(d.keyRatioFields[0] || {});
      const m = {};
      for (const sections of Object.values(d.keyCalFields)) for (const list of Object.values(sections)) for (const f of list) m[f.id] = { flag: !!f.is_flag, remark: f.remark || '' };
      setMarks(m);
    }).catch((e) => toast.error(errMsg(e)));
  }, [project.id]);

  const evaluated = useMemo(() => (data ? K.evaluateResidential(data.keyCalFields, inputs, project.category) : null), [data, inputs, project.category]);

  if (!data || !evaluated) return <PageLoader />;
  if (!Object.keys(data.keyCalFields).length) return <div className="card"><Empty title="Key ratio benchmarks are not set up">Run the seed with keyratio-residential.json.</Empty></div>;

  const tabs = Object.keys(data.keyCalFields);
  const rowsFor = (t) => Object.values(data.keyCalFields[t] || {}).flat().map((f) => {
    const r = evaluated.results[f.id];
    return { id: f.id, name: f.field_name, value: r.value, unit: K.RATIO_UNITS[f.id] || '', range: r.check.range, check: r.check, cost: f.id === 27 ? r.cost : r.cost, ...marks[f.id] };
  });
  const sectionsFor = (t) => Object.entries(data.keyCalFields[t] || {});
  const all = tabs.flatMap(rowsFor);
  const filled = all.filter((r) => r.check.value !== K.STATUS.PENDING);
  const ok = filled.filter((r) => r.check.value === K.STATUS.OK).length;
  const score = filled.length ? Math.round((ok / filled.length) * 100) : 0;
  const econ = evaluated.economics;
  // Cost of deviations only (FAR utilisation and efficiency economics are potentials, shown separately)
  const deviationCost = (t) => rowsFor(t).reduce((s, r) => s + (r.id !== 27 && r.cost ? Math.round(r.cost) : 0), 0);
  const effSection = Object.entries(data.keyCalFields).flatMap(([, s]) => Object.keys(s)).find((s) => s.toLowerCase() === 'efficiency');
  const optimised = effSection ? evaluated.sectionCost[effSection] : 0;

  const setInput = (k) => (v) => setInputs((s) => ({ ...s, [k]: v }));
  const toggleFlag = (id) => setMarks((m) => ({ ...m, [id]: { ...m[id], flag: !m[id]?.flag } }));

  const payload = () => {
    const inputValues = all.map((r) => ({ field_id: r.id, field_value: r.value, remark: r.check.value === K.STATUS.FAIL ? (r.remark || '') : '', flag: r.check.value === K.STATUS.FAIL && r.flag ? 1 : 0, calculated_cost: r.cost ?? null }));
    const calculatedSectionValues = Object.entries(evaluated.sectionCost).map(([section, cost]) => ({ section, section_cost: cost }));
    return { ...inputs, project_id: project.id, inputValues, calculatedSectionValues, ...(econ ? { new_loading_factor: econ.new_loading_factor, new_loading_factor2: econ.new_loading_factor2, theoritical_maximum: econ.theoritical_maximum, far_permissible_maximization: econ.far_permissible_maximization, built_up_area_optimization: econ.built_up_area_optimization } : {}) };
  };
  const save = async (final) => {
    setSaving(final ? 'final' : 'draft');
    try {
      if (final) { await (inputs.id ? put(`/keyRatio?project_id=${project.id}`, payload()) : post('/keyRatio', payload())); toast.success('Key ratio saved'); navigate(`/projects/${project.id}`); }
      else { await post('/keyRatio/saveAsDraft', payload()); toast.success('Draft saved'); }
    } catch (e) { toast.error(errMsg(e, 'Could not save')); } finally { setSaving(''); }
  };

  const groups = K.RESIDENTIAL_INPUT_GROUPS.filter((g) => (TAB_GROUPS[tab] || []).includes(g.name));

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4"><p className="text-xs text-ink-400">Compliance</p><p className="mt-1 text-2xl font-semibold">{score}%</p><p className="text-xs text-ink-500">{ok} of {filled.length} ratios within benchmark</p></div>
        {tabs.map((t) => { const c = deviationCost(t); return <div key={t} className="card p-4"><p className="text-xs text-ink-400">{t} — cost of deviations</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${c > 0 ? 'text-red-600' : ''}`}>{c ? cr(c) : '—'}</p><p className="text-xs text-ink-500">Owner: {data.projectOwners?.[`${t.toLowerCase()}_owner`] || '—'}</p></div>; })}
        {econ && (
          <div className="card p-4" title="Profit difference if saleable, BUA, carpet and balcony ratios were at the benchmark average for this FAR. Positive = room to improve.">
            <p className="text-xs text-ink-400">Layout vs. benchmark average</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${optimised > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>{optimised ? cr(Math.abs(optimised)) : '—'}</p>
            <p className="text-xs text-ink-500">{optimised > 0 ? 'potential gain' : optimised < 0 ? 'ahead of benchmark' : ''} · loading {econ.new_loading_factor ? econ.new_loading_factor.toFixed(2) : '—'}</p>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-ink-100 p-1">
          {tabs.map((t) => <button type="button" key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}>{t}</button>)}
        </div>
        {!readOnly && <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import CSV</button>
          <button type="button" className="btn-secondary" disabled={!!saving} onClick={() => save(false)}><Save className="h-4 w-4" />{saving === 'draft' ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="btn-primary" disabled={!!saving} onClick={() => save(true)}><CheckCircle2 className="h-4 w-4" />{saving === 'final' ? 'Saving…' : 'Save & finish'}</button>
        </div>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="card self-start p-5">
          <h3 className="mb-4 text-sm font-semibold">Inputs</h3>
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{g.name}</p>
                <div className="space-y-2">
                  {g.fields.map(([k, unit]) => (
                    <label key={k} className="grid grid-cols-[1fr_8rem] items-center gap-3">
                      <span className="text-sm text-ink-700 first-letter:uppercase">{K.inputLabel(k)}{unit && <span className="ml-1 text-xs text-ink-400">({unit})</span>}</span>
                      <NumberInput value={inputs[k]} onChange={setInput(k)} disabled={readOnly} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          {sectionsFor(tab).map(([section]) => {
            const rows = rowsFor(tab).filter((r) => data.keyCalFields[tab][section].some((f) => f.id === r.id));
            const sc = evaluated.sectionCost[section];
            return (
              <div key={section} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
                  <h3 className="text-sm font-semibold">{section}</h3>
                  {section.toLowerCase() !== 'efficiency' && sc ? <span className={`text-sm font-medium tabular-nums ${sc > 0 ? 'text-red-600' : 'text-emerald-700'}`} title="Cost of values outside benchmark">{cr(sc)}</span> : null}
                </div>
                <ResultsTable rows={rows} readOnly={readOnly} onFlag={toggleFlag} onRemark={setRemarkRow} />
              </div>
            );
          })}
          <p className="flex items-start gap-2 text-xs text-ink-400"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Benchmarks are for the {categoryLabel(project.category)} category. Steel and concrete benchmarks also depend on building height. Impact is in crore rupees; positive = extra cost.</p>
        </div>
      </div>

      <RemarkDialog row={remarkRow} onClose={() => setRemarkRow(null)} onSave={(text) => { setMarks((m) => ({ ...m, [remarkRow.id]: { ...m[remarkRow.id], remark: text } })); setRemarkRow(null); }} />
      <CsvImport open={importOpen} onClose={() => setImportOpen(false)} projectId={project.id} moduleId={inputs.module_id || 1}
        onImported={(d) => { if (d?.KeyRatioFields) setInputs((s) => ({ ...s, ...d.KeyRatioFields })); }} />
    </>
  );
}

// ------------------------------------------------------------------ commercial
function Commercial({ project, readOnly }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [marks, setMarks] = useState({});
  const [tab, setTab] = useState('');
  const [remarkRow, setRemarkRow] = useState(null);
  const [saving, setSaving] = useState('');

  useEffect(() => {
    get('/commercial/create-key-ratio', { project_id: project.id }).then((d) => {
      const kd = d.keyRatioData; setData(kd);
      const v = {}; for (const s of Object.values(kd.inputData)) for (const rows of Object.values(s)) for (const r of rows) v[r.field_id] = r.value;
      setValues(v);
      const m = {}; for (const s of Object.values(kd.outputData)) for (const rows of Object.values(s)) for (const r of rows) m[r.field_id] = { flag: !!r.is_flag, remark: r.remark || '' };
      setMarks(m);
      setTab(Object.keys(kd.outputData)[0] || Object.keys(kd.inputData)[0] || '');
    }).catch((e) => toast.error(errMsg(e)));
  }, [project.id]);

  const inputs = useMemo(() => Object.entries(values).map(([field_id, value]) => ({ field_id: Number(field_id), value })), [values]);
  const evaluated = useMemo(() => (data ? K.evaluateCommercial(data.outputData, inputs, project.category) : null), [data, inputs, project.category]);

  if (!data || !evaluated) return <PageLoader />;
  if (!Object.keys(data.inputData).length) {
    return <div className="card"><Empty title="Commercial key-ratio fields aren't loaded yet">They'll be imported from the previous system's data export. Residential projects work today.</Empty></div>;
  }
  const tabs = [...new Set([...Object.keys(data.outputData), ...Object.keys(data.inputData)])];
  const rowsOf = (section) => (data.outputData[tab]?.[section] || []).filter((r) => r.is_visible !== false).map((r) => {
    const e = evaluated.results[r.field_id];
    return { id: r.field_id, name: r.field_name, value: e?.value ?? null, unit: r.units, range: e?.check.range, check: e?.check || { value: 'pending', color: 'gray' }, cost: e?.cost, ...marks[r.field_id] };
  });
  const all = Object.values(evaluated.results);
  const filled = all.filter((r) => r.check.value !== K.STATUS.PENDING);
  const ok = filled.filter((r) => r.check.value === K.STATUS.OK).length;

  const save = async (final) => {
    setSaving(final ? 'final' : 'draft');
    const body = {
      projectId: project.id,
      keyRatioInputs: inputs,
      keyOutputs: Object.entries(evaluated.results).map(([id, r]) => ({ field_id: Number(id), field_value: r.value, remark: marks[id]?.remark || '', is_flag: !!marks[id]?.flag, calculated_cost: r.cost })),
      sectionCost: Object.entries(evaluated.sectionCost).map(([section_name, section_cost]) => ({ section_name, section_cost })),
    };
    try {
      if (final) { await (data.id ? put(`/commercial/create-key-ratio?project_id=${project.id}`, body) : post('/commercial/create-key-ratio', body)); toast.success('Key ratio saved'); navigate(`/projects/${project.id}`); }
      else { await put('/commercial/save-as-draft', body); toast.success('Draft saved'); }
    } catch (e) { toast.error(errMsg(e, 'Could not save')); } finally { setSaving(''); }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-ink-100 p-1">
          {tabs.map((t) => <button type="button" key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === t ? 'bg-white shadow-sm' : 'text-ink-500'}`}>{t}</button>)}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-500">{ok}/{filled.length} within benchmark</span>
          {!readOnly && <>
            <button type="button" className="btn-secondary" disabled={!!saving} onClick={() => save(false)}><Save className="h-4 w-4" />Save draft</button>
            <button type="button" className="btn-primary" disabled={!!saving} onClick={() => save(true)}><CheckCircle2 className="h-4 w-4" />Save & finish</button>
          </>}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="card self-start p-5">
          <h3 className="mb-4 text-sm font-semibold">Inputs</h3>
          {Object.entries(data.inputData[tab] || {}).map(([section, rows]) => (
            <div key={section} className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{section}</p>
              {rows.filter((r) => r.is_visible !== false).map((r) => (
                <label key={r.field_id} className="mb-2 grid grid-cols-[1fr_8rem] items-center gap-3">
                  <span className="text-sm text-ink-700">{r.field_name}{r.units && <span className="ml-1 text-xs text-ink-400">({r.units})</span>}</span>
                  <NumberInput value={values[r.field_id]} disabled={readOnly} onChange={(v) => setValues((s) => ({ ...s, [r.field_id]: v }))} />
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {Object.keys(data.outputData[tab] || {}).map((section) => (
            <div key={section} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3"><h3 className="text-sm font-semibold">{section}</h3>{evaluated.sectionCost[section] ? <span className="text-sm font-medium">{cr(evaluated.sectionCost[section])}</span> : null}</div>
              <ResultsTable rows={rowsOf(section)} readOnly={readOnly} onFlag={(id) => setMarks((m) => ({ ...m, [id]: { ...m[id], flag: !m[id]?.flag } }))} onRemark={setRemarkRow} />
            </div>
          ))}
        </div>
      </div>
      <RemarkDialog row={remarkRow} onClose={() => setRemarkRow(null)} onSave={(text) => { setMarks((m) => ({ ...m, [remarkRow.id]: { ...m[remarkRow.id], remark: text } })); setRemarkRow(null); }} />
    </>
  );
}

export default function KeyRatio() {
  const { projectId } = useParams();
  const location = useLocation();
  const readOnly = !!location.state?.readOnly;
  const [project, setProject] = useState(null);
  useEffect(() => { get(`/project/${projectId}`).then(setProject).catch((e) => toast.error(errMsg(e))); }, [projectId]);
  if (!project) return <PageLoader />;
  return (
    <>
      <PageHeader
        back={<Link to={`/projects/${projectId}`} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />{project.name}</Link>}
        title="Key ratios"
        subtitle={`${categoryLabel(project.category)} · ${project.projectType}`}
        actions={readOnly && <Badge tone="blue">Read only</Badge>}
      />
      {project.projectType === 'residential' ? <Residential project={project} readOnly={readOnly} /> : <Commercial project={project} readOnly={readOnly} />}
    </>
  );
}
