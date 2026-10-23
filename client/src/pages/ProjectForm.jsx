import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { get, post, put, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getPortfolio } from '../components/Layout';
import { PageHeader, PageLoader, Field } from '../components/ui';
import { PROJECT_TYPES, CATEGORIES, CLASSIFICATIONS, PORTFOLIOS, canManageProjects } from '../lib/constants';

const ACRE_TO_SQM = 4046.856;
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  name: '', projectType: 'residential', category: '', location: '', locationCategory: '', projectClassification: '',
  far_permissible: '', site_area_acres: '', site_area: '', date: today(),
  projectOwner: '', designOwner: '', structureOwner: '', mepOwner: '', interiorDesignOwner: '',
  userName: '', userEmail: '', userNumber: '', userDesignation: '',
};

function validate(v) {
  const e = {};
  if (!v.name.trim()) e.name = 'Required';
  if (!v.category) e.category = 'Choose a category';
  if (!v.location.trim()) e.location = 'Required';
  if (!v.locationCategory) e.locationCategory = 'Choose a portfolio';
  if (!v.projectClassification) e.projectClassification = 'Choose a stage';
  if (v.far_permissible !== '' && Number.isNaN(Number(v.far_permissible))) e.far_permissible = 'Must be a number';
  if (v.site_area_acres !== '' && Number.isNaN(Number(v.site_area_acres))) e.site_area_acres = 'Must be a number';
  if (v.userEmail && !/^\S+@\S+\.\S+$/.test(v.userEmail)) e.userEmail = 'Enter a valid email';
  if (v.userNumber && !/^[6-9]\d{9}$/.test(v.userNumber)) e.userNumber = '10-digit mobile number';
  return e;
}

export default function ProjectForm() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({ ...EMPTY, locationCategory: getPortfolio() });
  const [loading, setLoading] = useState(!!projectId);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    get(`/project/${projectId}`).then((p) => {
      const out = { ...EMPTY };
      for (const k of Object.keys(EMPTY)) if (p[k] !== null && p[k] !== undefined) out[k] = String(p[k]);
      out.date = p.date ? p.date.slice(0, 10) : today();
      setV(out);
    }).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [projectId]);

  if (!canManageProjects(user)) return <Navigate to="/projects" replace />;
  if (loading) return <PageLoader />;

  const errors = touched ? validate(v) : {};
  const set = (k) => (e) => {
    const val = e.target.value;
    setV((s) => {
      const n = { ...s, [k]: val };
      if (k === 'projectType') n.category = '';
      if (k === 'site_area_acres') n.site_area = val && !Number.isNaN(Number(val)) ? (Number(val) * ACRE_TO_SQM).toFixed(2) : '';
      if (k === 'userNumber') n.userNumber = val.replace(/\D/g, '').slice(0, 10);
      return n;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate(v)).length) { toast.error('Please fix the highlighted fields'); return; }
    setSaving(true);
    const body = { ...v, date: new Date(`${v.date}T00:00:00`).toISOString() };
    for (const k of ['far_permissible', 'site_area_acres', 'site_area']) body[k] = v[k] === '' ? null : Number(v[k]);
    try {
      const res = projectId ? await put(`/project/${projectId}`, body) : await post('/project', body);
      toast.success(projectId ? 'Project updated' : 'Project created');
      navigate(`/projects/${projectId || res.data.id}`);
    } catch (err) { toast.error(errMsg(err, 'Could not save')); } finally { setSaving(false); }
  };

  const text = (k, label, props = {}) => <Field label={label} error={errors[k]}><input className="input" value={v[k]} onChange={set(k)} {...props} /></Field>;

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        back={<Link to={projectId ? `/projects/${projectId}` : '/projects'} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"><ArrowLeft className="h-4 w-4" />Back</Link>}
        title={projectId ? 'Edit project' : 'New project'}
        actions={<><Link to={projectId ? `/projects/${projectId}` : '/projects'} className="btn-secondary">Cancel</Link><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : projectId ? 'Save changes' : 'Create project'}</button></>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Project</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{text('name', 'Project name', { placeholder: 'e.g. Skyline Residences' })}</div>
              <Field label="Type">
                <select className="input" value={v.projectType} onChange={set('projectType')} disabled={!!projectId}>
                  {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Category" error={errors.category}>
                <select className="input" value={v.category} onChange={set('category')}>
                  <option value="">Select…</option>
                  {(CATEGORIES[v.projectType] || []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Stage" error={errors.projectClassification}>
                <select className="input" value={v.projectClassification} onChange={set('projectClassification')}>
                  <option value="">Select…</option>
                  {CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Project date"><input className="input" type="date" max={today()} value={v.date} onChange={set('date')} /></Field>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Site</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{text('location', 'Location', { placeholder: 'Sector, city' })}</div>
              <Field label="Portfolio" error={errors.locationCategory}>
                <select className="input" value={v.locationCategory} onChange={set('locationCategory')}>
                  <option value="">Select…</option>
                  {PORTFOLIOS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              {text('far_permissible', 'Permissible FAR (sq m)', { inputMode: 'decimal' })}
              {text('site_area_acres', 'Site area (acres)', { inputMode: 'decimal' })}
              <Field label="Site area (sq m)" hint="Calculated from acres"><input className="input" value={v.site_area} disabled /></Field>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Owners</h2>
            <div className="space-y-4">
              {text('projectOwner', 'Project architect')}
              {text('designOwner', 'Design')}
              {text('structureOwner', 'Structure')}
              {text('mepOwner', 'MEP')}
              {text('interiorDesignOwner', 'Interior design')}
            </div>
          </section>
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Point of contact</h2>
            <div className="space-y-4">
              {text('userName', 'Name')}
              {text('userDesignation', 'Designation')}
              {text('userEmail', 'Email', { type: 'email' })}
              {text('userNumber', 'Mobile', { inputMode: 'numeric' })}
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
