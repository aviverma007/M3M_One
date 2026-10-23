// Residential (/keyRatio) and commercial (/commercial/...) key ratio endpoints, plus /compare/get-projects
const express = require('express');
const {
  KeyRatio, KeyRatioBenchmark, KeyRatioInputField, Project, Module, ProjectModule,
} = require('../models');
const { ok, ah, ApiError } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { groupBenchmarks, kr, listModules } = require('../services/modules');
const { chapterRows } = require('./modules');
const { audit } = require('../services/audit');

const router = express.Router();

const ownersOf = (p) => ({ design_owner: p.designOwner, mep_owner: p.mepOwner, structure_owner: p.structureOwner });

// ---------------------------------------------------------------- residential
async function residentialPayload(project) {
  const K = kr();
  const rec = await KeyRatio.findOne({ where: { project_id: project.id }, order: [['isDraft', 'ASC'], ['updatedAt', 'DESC']] });
  const mod = await Module.findOne({ where: { projectType: 'residential', moduleNumber: 1 } });
  const inputs = rec?.inputs || {};
  const record = {
    id: rec?.id ?? null, project_id: project.id, module_id: mod?.id ?? 1,
    ...Object.fromEntries(K.RESIDENTIAL_INPUT_KEYS.map((k) => [k, inputs[k] ?? null])),
    ...K.RESIDENTIAL_COST_DEFAULTS,
    ...Object.fromEntries(Object.keys(K.RESIDENTIAL_COST_DEFAULTS).filter((k) => inputs[k] !== undefined && inputs[k] !== null).map((k) => [k, inputs[k]])),
    permissible_far: inputs.permissible_far ?? project.far_permissible ?? null,
    createdAt: rec?.createdAt ?? null, updatedAt: rec?.updatedAt ?? null,
    value: null, is_flag: null, remark: null, calculated_cost: null,
  };
  const benches = await KeyRatioBenchmark.findAll({ where: { kind: 'residential' } });
  const grouped = groupBenchmarks(benches);
  const flags = rec?.flags || {};
  const { results } = K.evaluateResidential(grouped, record, project.category);
  for (const sections of Object.values(grouped)) {
    for (const list of Object.values(sections)) {
      for (const f of list) {
        const st = flags[f.id] || {};
        const r = results[f.id];
        f.value = r?.value === null || r?.value === undefined ? null : String(r.value);
        f.is_flag = !!st.is_flag;
        f.remark = st.remark || '';
        f.field_cost = st.calculated_cost ?? (r?.cost ?? null);
        f.section_cost = null;
        delete f.formula; delete f.createdAt; delete f.updatedAt; delete f.kind;
      }
    }
  }
  const calc = rec?.calculated || {};
  return {
    keyRatioFields: [{ ...record, ...Object.fromEntries(['new_loading_factor', 'new_loading_factor2', 'theoritical_maximum', 'far_permissible_maximization', 'built_up_area_optimization'].map((k) => [k, calc[k] ?? null])) }],
    keyCalFields: grouped,
    projectOwners: ownersOf(project),
    calculatedFields: rec ? [{ id: rec.id, user_id: rec.user_id, project_id: project.id, ...calc, created_at: rec.createdAt, updated_at: rec.updatedAt }] : [],
  };
}

async function saveResidential(req, isDraft) {
  const K = kr();
  const body = req.body || {};
  const projectId = Number(req.query.project_id || body.project_id);
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const inputs = {};
  for (const k of [...K.RESIDENTIAL_INPUT_KEYS, ...Object.keys(K.RESIDENTIAL_COST_DEFAULTS)]) {
    if (body[k] !== undefined) inputs[k] = body[k] === '' ? null : body[k];
  }
  const flags = {};
  for (const iv of body.inputValues || []) {
    if (iv.field_id === undefined || iv.field_id === null) continue;
    flags[iv.field_id] = { is_flag: !!(iv.flag ?? iv.is_flag), remark: iv.remark || '', calculated_cost: iv.calculated_cost ?? null, field_value: iv.field_value ?? null };
  }
  const calculated = {};
  for (const k of ['new_loading_factor', 'new_loading_factor2', 'theoritical_maximum', 'far_permissible_maximization', 'built_up_area_optimization']) if (body[k] !== undefined) calculated[k] = body[k];
  calculated.sections = body.calculatedSectionValues || [];
  const mod = await Module.findOne({ where: { projectType: 'residential', moduleNumber: 1 } });
  let rec = await KeyRatio.findOne({ where: { project_id: projectId } });
  const values = { project_id: projectId, module_id: mod?.id ?? 1, user_id: req.user.id, kind: 'residential', isDraft, inputs: { ...(rec?.inputs || {}), ...inputs }, flags, calculated };
  if (rec) {
    if (isDraft && !rec.isDraft) values.isDraft = false; // keep a submitted sheet submitted when a draft is saved over it
    await rec.update(values);
  } else rec = await KeyRatio.create(values);
  if (!isDraft) {
    await ProjectModule.findOrCreate({ where: { projectId, moduleId: values.module_id }, defaults: { status: 'completed' } });
    await ProjectModule.update({ status: 'completed' }, { where: { projectId, moduleId: values.module_id } });
    await audit(req.user.id, 'Task Completed', `Saved key ratio for ${project.name}`, projectId);
  }
  return rec;
}

router.get('/keyRatio', requireAuth, ah(async (req, res) => {
  const project = await Project.findByPk(req.query.project_id);
  if (!project) throw new ApiError(404, 'Project not found');
  ok(res, await residentialPayload(project));
}));
router.post('/keyRatio', requireAuth, ah(async (req, res) => { const r = await saveResidential(req, false); ok(res, { id: r.id }, 'KeyRatio Module created'); }));
router.put('/keyRatio', requireAuth, ah(async (req, res) => { const r = await saveResidential(req, false); ok(res, { id: r.id }, 'KeyRatio Module updated'); }));
router.post('/keyRatio/saveAsDraft', requireAuth, ah(async (req, res) => { await saveResidential(req, true); ok(res, null, 'Project saved as draft'); }));

// ---------------------------------------------------------------- commercial
async function commercialPayload(project) {
  const K = kr();
  const rec = await KeyRatio.findOne({ where: { project_id: project.id } });
  const defs = await KeyRatioInputField.findAll({ where: { kind: 'commercial' }, order: [['order_id', 'ASC'], ['field_id', 'ASC']] });
  const stored = new Map((rec?.inputs || []).map((r) => [Number(r.field_id), r.value]));
  const inputData = {};
  for (const d of defs) {
    ((inputData[d.tab] ||= {})[d.section] ||= []).push({ field_id: d.field_id, field_name: d.field_name, value: stored.has(d.field_id) ? stored.get(d.field_id) : (d.default_value ?? null), units: d.units, is_visible: d.is_visible });
  }
  const inputs = defs.map((d) => ({ field_id: d.field_id, value: stored.has(d.field_id) ? stored.get(d.field_id) : (d.default_value ?? null) }));
  const benches = await KeyRatioBenchmark.findAll({ where: { kind: 'commercial' } });
  const grouped = groupBenchmarks(benches);
  const flags = rec?.flags || {};
  const outputData = {};
  for (const [tab, sections] of Object.entries(grouped)) {
    for (const [section, list] of Object.entries(sections)) {
      for (const b of list) {
        const value = K.computeCommercialOutput({ field_id: b.id, dependency: b.dependecy_fields || [] }, K.commercialInputMap(inputs));
        const st = flags[b.id] || {};
        ((outputData[tab] ||= {})[section] ||= []).push({
          id: b.id, field_id: b.id, field_name: b.field_name, field_value: value, remark: st.remark || '', is_flag: !!st.is_flag,
          dependency: b.dependecy_fields || [], units: b.units, is_visible: b.is_visible,
          premium: b.premium, mid_end: b.mid_end, affluent: b.affluent, hi_street: b.high_street, enclosed_mall: b.enclosed_mall,
          premium_range: b.premium_range, mid_end_range: b.mid_end_range, affluent_range: b.affluent_range, hi_street_range: b.high_street_range, enclosed_mall_range: b.enclosed_mall_range,
          calculated_cost: st.calculated_cost ?? null,
        });
      }
    }
  }
  return { keyRatioData: { id: rec?.id ?? null, inputData, outputData, owner: ownersOf(project) } };
}

async function saveCommercial(req, isDraft) {
  const body = req.body?.formDataWithDisplayDataSubmit || req.body || {};
  const projectId = Number(req.query.project_id || body.projectId);
  const project = await Project.findByPk(projectId);
  if (!project) throw new ApiError(404, 'Project not found');
  const flags = {};
  for (const o of body.keyOutputs || []) flags[o.field_id] = { is_flag: o.is_flag === true || o.is_flag === 1 || o.is_flag === 'true', remark: o.remark || '', calculated_cost: o.calculated_cost ?? null, field_value: o.field_value ?? null };
  const mod = await Module.findOne({ where: { projectType: 'commercial', moduleNumber: 1 } });
  let rec = await KeyRatio.findOne({ where: { project_id: projectId } });
  const values = { project_id: projectId, module_id: mod?.id ?? 4, user_id: req.user.id, kind: 'commercial', isDraft, inputs: body.keyRatioInputs || rec?.inputs || [], flags, calculated: { sectionCost: body.sectionCost || [] } };
  if (rec) { if (isDraft && !rec.isDraft) values.isDraft = false; await rec.update(values); } else rec = await KeyRatio.create(values);
  if (!isDraft) {
    await ProjectModule.findOrCreate({ where: { projectId, moduleId: values.module_id }, defaults: { status: 'completed' } });
    await ProjectModule.update({ status: 'completed' }, { where: { projectId, moduleId: values.module_id } });
    await audit(req.user.id, 'Task Completed', `Saved commercial key ratio for ${project.name}`, projectId);
  }
  return rec;
}

router.get('/commercial/create-key-ratio', requireAuth, ah(async (req, res) => {
  const project = await Project.findByPk(req.query.project_id);
  if (!project) throw new ApiError(404, 'Project not found');
  ok(res, await commercialPayload(project));
}));
router.post('/commercial/create-key-ratio', requireAuth, ah(async (req, res) => { const r = await saveCommercial(req, false); ok(res, { id: r.id }, 'KeyRatio Module created'); }));
router.put('/commercial/create-key-ratio', requireAuth, ah(async (req, res) => { const r = await saveCommercial(req, false); ok(res, { id: r.id }, 'KeyRatio Module updated'); }));
router.put('/commercial/save-as-draft', requireAuth, ah(async (req, res) => { await saveCommercial(req, true); ok(res, null, 'Project saved as draft'); }));
router.post('/commercial/save-as-draft', requireAuth, ah(async (req, res) => { await saveCommercial(req, true); ok(res, null, 'Project saved as draft'); }));

// ---------------------------------------------------------------- compare
router.post('/compare/get-projects', requireAuth, ah(async (req, res) => {
  const { currentProjectId, compareProjectIds = [], moduleId = '1', chapterId = '1' } = req.body || {};
  const ids = [...new Set(compareProjectIds.map(Number).filter(Boolean))].slice(0, 3);
  if (!ids.length) throw new ApiError(400, 'Select at least one project to compare');
  const mod = await Module.findByPk(moduleId);
  const isKeyRatio = !mod || /key ratio/i.test(mod.name);
  const build = async (id) => {
    const p = await Project.findByPk(id);
    if (!p) return null;
    const base = { id: p.id, name: p.name, category: p.category, projectType: p.projectType };
    if (isKeyRatio) {
      if (p.projectType === 'residential') { const d = await residentialPayload(p); return { ...base, keyRatioFields: d.keyRatioFields, keyCalFields: d.keyCalFields }; }
      const d = await commercialPayload(p); return { ...base, inputData: d.keyRatioData.inputData, outputData: d.keyRatioData.outputData };
    }
    return { ...base, moduleData: await chapterRows(p.id, Number(moduleId), chapterId) };
  };
  const currentProject = currentProjectId ? await build(currentProjectId) : null;
  const comparedProjects = (await Promise.all(ids.map(build))).filter(Boolean);
  if (!comparedProjects.length) throw new ApiError(404, 'Failed to compare incomplete projects');
  let navigation = { prevModule: null, nextModule: null };
  const ref = currentProject || comparedProjects[0];
  const list = (await listModules(ref.id))?.rows.filter((r) => typeof r.id === 'number') || [];
  const idx = list.findIndex((r) => String(r.id) === String(moduleId));
  if (idx >= 0) {
    const nav = (r) => (r ? { moduleId: r.id, firstChapterId: r.firstChapterId ?? 1 } : null);
    navigation = { prevModule: nav(list[idx - 1]), nextModule: nav(list[idx + 1]) };
  }
  ok(res, { currentProject, comparedProjects, navigation });
}));

module.exports = router;
