// Module list per project (Key Ratio, question-bank modules, and the DPR / design-brief modules)
const { Op } = require('sequelize');
const {
  Module, Chapter, ChapterSection, SectionField, FieldValue, ProjectModule, KeyRatio, KeyRatioBenchmark, DesignBriefSummary, Project,
} = require('../models');

let K; // shared ESM module, loaded lazily
const kr = () => (K ||= require('../../../shared/keyRatio.js'));

// DPR modules shown after the question-bank modules. `summaryKey` = key written in design-brief-summary.
const DPR_MODULES = [
  { key: 'parent', name: 'Design Brief' },
  { key: 'project-details', name: 'Project Details + Layout Plans.', summaryKey: 'projectDetailsLayoutData' },
  { key: 'project-level-design', name: 'Project Level Design', summaryKey: 'projectLevelDesignData' },
  { key: 'unit-level-design', name: 'Unit Level Design', summaryKey: 'unitLevelDesignData' },
  { key: 'structure', name: 'Structures' },
  { key: 'mep', name: 'MEP' },
  { key: 'id-specifications', name: 'ID Specifications', summaryKey: 'idSpecificationsData' },
  { key: 'common-area', name: 'Common Area', summaryKey: 'commonAreaData' },
  { key: 'landscape-amenities', name: 'Landscape & Amenities', summaryKey: 'landscapeAmenitiesData' },
  { key: 'service-design', name: 'Service Design Consideration', summaryKey: 'serviceDesignData' },
  { key: 'contracting-strategy', name: 'Contracting Strategy', summaryKey: 'contractingStrategyData' },
  { key: 'consultant-strategy', name: 'Consultant Strategy', summaryKey: 'consultantStrategyData' },
  { key: 'phasing-plan', name: 'Phasing Plans', summaryKey: 'phasingPlanData' },
  { key: 'project-schedule', name: 'Project Schedule', summaryKey: 'projectScheduleData' },
  { key: 'approvals', name: 'Approvals', summaryKey: 'approvalsData' },
  { key: 'additional-details', name: 'Additional Details', summaryKey: 'additionalProjectDetailsData' },
  { key: 'export-configuration', name: 'Export Configuration' },
];

const benchKey = { 'mid-end': 'midEndAns', mid_end: 'midEndAns', premium: 'premiumAns', affluent: 'affluentAns', hi_street: 'hiStreetAns', high_street: 'hiStreetAns', enclosed_mall: 'enclosedMallAns' };

const answerMatches = (answer, bench) => {
  if (answer === null || answer === undefined || answer === '' || !bench || !bench.length) return null;
  const norm = (s) => String(s).trim().toLowerCase();
  const b = bench.map(norm);
  let a = answer;
  if (typeof a === 'string' && a.startsWith('[')) { try { a = JSON.parse(a); } catch { /* keep string */ } }
  if (Array.isArray(a)) return a.length ? a.every((x) => b.includes(norm(x))) : null;
  return b.includes(norm(a));
};

async function questionModuleStats(projectId, moduleId, category) {
  const chapters = await Chapter.findAll({ where: { moduleId }, attributes: ['id'] });
  const sections = await ChapterSection.findAll({ where: { chapterId: chapters.map((c) => c.id) }, attributes: ['id'] });
  const fields = await SectionField.findAll({ where: { sectionId: sections.map((s) => s.id) } });
  const values = await FieldValue.findAll({ where: { projectId, sectionFieldId: fields.map((f) => f.id), isDraft: false } });
  const byField = new Map(values.map((v) => [v.sectionFieldId, v]));
  let ok = 0; let dev = 0; let flags = 0;
  for (const f of fields) {
    const v = byField.get(f.id);
    if (!v) continue;
    if (v.isFlaged) flags++;
    const m = answerMatches(v.answer, f[benchKey[category]] || []);
    if (m === true) ok++; else if (m === false) dev++;
  }
  return { allParams: fields.length, benchmarkParams: ok, deviations: dev, flags, complianceScore: ok + dev ? Math.round((ok / (ok + dev)) * 100) : 0 };
}

async function keyRatioStats(projectId, project) {
  const rec = await KeyRatio.findOne({ where: { project_id: projectId, isDraft: false } });
  const kind = project.projectType === 'residential' ? 'residential' : 'commercial';
  const benches = await KeyRatioBenchmark.findAll({ where: { kind } });
  if (!rec) return { allParams: benches.length, benchmarkParams: 0, deviations: 0, flags: 0, complianceScore: 0 };
  const K2 = kr();
  if (kind === 'residential') {
    const grouped = groupBenchmarks(benches);
    const { results } = K2.evaluateResidential(grouped, rec.inputs || {}, project.category);
    return K2.keyRatioStats(results, rec.flags || {});
  }
  const outputData = groupCommercialOutputs(benches);
  const { results } = K2.evaluateCommercial(outputData, rec.inputs || [], project.category);
  return K2.commercialStats(results, Object.values(rec.flags || {}));
}

// { Tab: { Section: [benchmark rows] } }
function groupBenchmarks(rows) {
  const out = {};
  for (const r of [...rows].sort((a, b) => (a.section_id - b.section_id) || ((a.order_id ?? 999) - (b.order_id ?? 999)) || (a.id - b.id))) {
    const p = r.get ? r.get({ plain: true }) : r;
    (out[p.type] ||= {});
    (out[p.type][p.section] ||= []).push(p);
  }
  return out;
}
function groupCommercialOutputs(rows) {
  const g = groupBenchmarks(rows);
  for (const sections of Object.values(g)) for (const list of Object.values(sections)) list.forEach((r) => { r.field_id = r.id; r.dependency = r.dependecy_fields || []; });
  return g;
}

async function listModules(projectId) {
  const project = await Project.findByPk(projectId);
  if (!project) return null;
  const projectType = project.projectType === 'residential' ? 'residential' : 'commercial';
  const mods = await Module.findAll({ where: { projectType }, order: [['moduleNumber', 'ASC']], include: [{ model: Chapter, as: 'moduleChapters', attributes: ['id', 'title', 'chapterNumber'] }] });
  const progress = await ProjectModule.findAll({ where: { projectId } });
  const pmBy = new Map(progress.map((p) => [Number(p.moduleId), p]));
  const summary = (await DesignBriefSummary.findOne({ where: { projectId } }))?.data || {};
  const rows = [];
  // Key ratio + question-bank modules ("Commercial Complex Design Considerations" is listed last, as in the original)
  const isExtra = (m) => m.moduleNumber > 3;
  const ordered = [...mods.filter((m) => !isExtra(m)), ...mods.filter(isExtra)];
  const dprBase = projectType === 'residential' ? 7 : 8;
  const pushQuestion = async (m) => {
    const pm = pmBy.get(m.id);
    const isKeyRatio = /key ratio/i.test(m.name);
    const stats = isKeyRatio ? await keyRatioStats(projectId, project) : await questionModuleStats(projectId, m.id, project.category);
    const chapters = [...(m.moduleChapters || [])].sort((a, b) => a.chapterNumber - b.chapterNumber);
    rows.push({
      id: m.id, moduleNumber: rows.length + 1, name: m.name, description: m.description, status: m.status,
      projectModule: { ...stats, moduleStatus: pm?.status === 'completed' ? 1 : 0, completedChapters: pm?.completedChapters || 0, status: pm?.status || 'pending' },
      moduleChapters: chapters.map((c) => ({ id: c.id, title: c.title })), firstChapterId: chapters[0]?.id ?? null,
    });
  };
  for (const m of ordered.filter((x) => !isExtra(x))) await pushQuestion(m);
  const filled = DPR_MODULES.filter((d) => d.summaryKey && summary[d.summaryKey]).length;
  const dprTotal = DPR_MODULES.filter((d) => d.summaryKey).length;
  for (const d of DPR_MODULES) {
    const done = d.summaryKey ? !!summary[d.summaryKey] : (d.key === 'parent' ? !!summary.moApprovedDocUrl : false);
    rows.push({
      id: `${dprBase}_${d.key}`, originalModuleId: dprBase, moduleNumber: rows.length + 1, name: d.name, status: 'active',
      projectModule: {
        allParams: dprTotal, benchmarkParams: filled, deviations: 0, flags: 0, complianceScore: dprTotal ? Math.round((filled / dprTotal) * 100) : 0,
        moduleStatus: done ? 1 : 0, completedChapters: filled, status: done ? 'completed' : 'active', moApprovedDocUrl: summary.moApprovedDocUrl || null,
      },
      moduleChapters: [], firstChapterId: null,
    });
  }
  for (const m of ordered.filter(isExtra)) await pushQuestion(m);
  return { count: rows.length, totalPages: 1, currentPage: 1, rows };
}

// Mark a module completed once every chapter has been saved; mark the project completed when all are
async function refreshModuleStatus(projectId, moduleId) {
  const pm = await ProjectModule.findOne({ where: { projectId, moduleId } });
  if (!pm) return;
  const mod = await Module.findByPk(moduleId);
  if (!mod) return;
  const total = await Chapter.count({ where: { moduleId } });
  const complete = /key ratio/i.test(mod.name) || (total > 0 && (pm.completedChapters || 0) >= total);
  if (complete && pm.status !== 'completed') await pm.update({ status: 'completed' });
  const project = await Project.findByPk(projectId);
  const projectType = project.projectType === 'residential' ? 'residential' : 'commercial';
  const all = await Module.findAll({ where: { projectType }, attributes: ['id'] });
  const done = await ProjectModule.count({ where: { projectId, moduleId: { [Op.in]: all.map((m) => m.id) }, status: 'completed' } });
  if (done >= all.length && project.status !== 'completed') await project.update({ status: 'completed' });
}

module.exports = { listModules, refreshModuleStatus, groupBenchmarks, groupCommercialOutputs, answerMatches, DPR_MODULES, benchKey, kr };
