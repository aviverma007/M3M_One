// /project/:id/module…, /module/:id, chapters, chapter answers, CSV import/sample
const express = require('express');
const multer = require('multer');
const {
  Module, Chapter, ChapterSection, SectionField, SectionFieldOption, FieldValue, ProjectModule, Project,
} = require('../models');
const { ok, ah, ApiError } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');
const { listModules, refreshModuleStatus } = require('../services/modules');
const { audit } = require('../services/audit');
const csv = require('../utils/csv');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/project/:id/module', requireAuth, ah(async (req, res) => {
  const data = await listModules(Number(req.params.id));
  if (!data) throw new ApiError(404, 'Project not found');
  ok(res, data);
}));

router.get('/module/:id', requireAuth, ah(async (req, res) => {
  const m = await Module.findByPk(req.params.id, { include: [{ model: Chapter, as: 'moduleChapters' }] });
  if (!m) throw new ApiError(404, 'Module not found');
  ok(res, m);
}));

const chapterStatus = (chapter, pm) => {
  const done = pm?.completedChapters || 0;
  if (chapter.chapterNumber <= done) return 'completed';
  if (chapter.chapterNumber === done + 1) return 'active';
  return 'pending';
};

async function chapterRows(projectId, moduleId, chapterId) {
  const pm = await ProjectModule.findOne({ where: { projectId, moduleId } });
  const chapters = await Chapter.findAll({ where: { moduleId }, order: [['chapterNumber', 'ASC']] });
  const rows = [];
  for (const c of chapters) {
    const row = { id: c.id, moduleId: c.moduleId, title: c.title, chapterNumber: c.chapterNumber, status: chapterStatus(c, pm), isLastChapter: c.isLastChapter };
    if (chapterId && Number(chapterId) === c.id) {
      const sections = await ChapterSection.findAll({
        where: { chapterId: c.id },
        order: [['id', 'ASC']],
        include: [{ model: SectionField, as: 'sectionFields', include: [{ model: SectionFieldOption, as: 'sectionFieldOptions', attributes: ['id', 'fieldOption'] }] }],
      });
      const fieldIds = sections.flatMap((s) => s.sectionFields.map((f) => f.id));
      const values = await FieldValue.findAll({ where: { projectId, sectionFieldId: fieldIds } });
      const vBy = new Map(values.map((v) => [v.sectionFieldId, v]));
      row.chapterSections = sections.map((s) => ({
        id: s.id, chapterId: s.chapterId, title: s.title, content: s.content, status: s.status,
        sectionFields: [...s.sectionFields].sort((a, b) => a.id - b.id).map((f) => {
          const v = vBy.get(f.id);
          let answer = v?.answer ?? '';
          if (typeof answer === 'string' && answer.startsWith('[')) { try { answer = JSON.parse(answer); } catch { /* keep */ } }
          return {
            id: f.id, sectionId: f.sectionId, fieldName: f.fieldName, fieldType: f.fieldType,
            midEndAns: f.midEndAns, affluentAns: f.affluentAns, premiumAns: f.premiumAns, hiStreetAns: f.hiStreetAns, enclosedMallAns: f.enclosedMallAns,
            inputValue: f.inputValue,
            fieldValue: v ? { id: v.id, sectionFieldId: f.id, answer, remark: v.remark, isFlaged: v.isFlaged, anyOtherAnswer: v.anyOtherAnswer || '' } : null,
            sectionFieldOptions: [...f.sectionFieldOptions].sort((a, b) => a.fieldOption.localeCompare(b.fieldOption)).sort((a, b) => (a.fieldOption === 'Any Other') - (b.fieldOption === 'Any Other')),
          };
        }),
      }));
    }
    rows.push(row);
  }
  return { rows };
}

router.get('/project/:id/module/:moduleId/chapter', requireAuth, ah(async (req, res) => {
  ok(res, await chapterRows(Number(req.params.id), Number(req.params.moduleId), req.query.chapterId));
}));

async function saveAnswers(projectId, answers, isDraft) {
  if (!Array.isArray(answers)) throw new ApiError(400, 'Body must be an array of answers');
  for (const a of answers) {
    if (!a.sectionFieldId) continue;
    let answer = a.answer;
    if (answer === 'answer') answer = ''; // the original client sent this literal placeholder for empty answers
    if (Array.isArray(answer)) answer = JSON.stringify(answer);
    const vals = { answer: answer ?? '', remark: a.remark ?? '', isFlaged: a.isFlaged ? 1 : 0, anyOtherAnswer: a.anyOtherAnswer ?? '', isDraft };
    const [fv, created] = await FieldValue.findOrCreate({ where: { projectId, sectionFieldId: a.sectionFieldId }, defaults: vals });
    if (!created) await fv.update(vals);
  }
}

router.put('/project/:id/module/:moduleId/chapter/saveAndDraft/:chapterId', requireAuth, ah(async (req, res) => {
  const body = Array.isArray(req.body) ? req.body : req.body?.data;
  await saveAnswers(Number(req.params.id), body, true);
  ok(res, await chapterRows(Number(req.params.id), Number(req.params.moduleId), req.params.chapterId), 'Chapter saved as draft');
}));

router.put('/project/:id/module/:moduleId/chapter/:chapterId', requireAuth, ah(async (req, res) => {
  const projectId = Number(req.params.id);
  await saveAnswers(projectId, req.body, false);
  const chapter = await Chapter.findByPk(req.params.chapterId);
  await audit(req.user.id, 'Task Completed', `Saved chapter "${chapter?.title}"`, projectId);
  ok(res, await chapterRows(projectId, Number(req.params.moduleId), req.params.chapterId), 'Chapter saved successfully');
}));

// ---------------------------------------------------------------- CSV import / format
// Chapter modules: columns Section, Field, Answer, Remark, Flag. Key ratio modules: Field, Value.
router.post('/module/sample/:moduleId', requireAuth, ah(async (req, res) => {
  const mod = await Module.findByPk(req.params.moduleId);
  if (!mod) throw new ApiError(404, 'Module Id Not Found.');
  let text;
  if (/key ratio/i.test(mod.name)) {
    const K = require('../services/modules').kr();
    const keys = mod.projectType === 'residential' ? K.RESIDENTIAL_INPUT_KEYS : (await require('../models').KeyRatioInputField.findAll({ order: [['field_id', 'ASC']] })).map((f) => f.field_name);
    text = csv.stringify([['Field', 'Value'], ...keys.map((k) => [k, ''])]);
  } else {
    const chapters = await Chapter.findAll({ where: { moduleId: mod.id }, order: [['chapterNumber', 'ASC']] });
    const out = [['Chapter', 'Section', 'Field', 'Answer', 'Remark', 'Flag']];
    for (const c of chapters) {
      const secs = await ChapterSection.findAll({ where: { chapterId: c.id }, include: [{ model: SectionField, as: 'sectionFields' }] });
      for (const s of secs) for (const f of s.sectionFields) out.push([c.title, s.title, f.fieldName, '', '', '']);
    }
    text = csv.stringify(out);
  }
  ok(res, { base64Url: Buffer.from(text).toString('base64'), fileFormat: 'csv' });
}));

router.post('/project/:id/module/:moduleId/import', requireAuth, upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'CSV file is required');
  const projectId = Number(req.params.id);
  const project = await Project.findByPk(projectId);
  const mod = await Module.findByPk(req.params.moduleId);
  if (!project || !mod) throw new ApiError(404, 'Project or module not found');
  const rows = csv.parse(req.file.buffer.toString('utf8'));
  const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
  const col = (n) => header.indexOf(n);
  if (/key ratio/i.test(mod.name)) {
    const fi = col('field'); const vi = col('value');
    if (fi < 0 || vi < 0) throw new ApiError(400, 'CSV must have Field and Value columns');
    if (project.projectType === 'residential') {
      const KeyRatioFields = {};
      for (const r of rows) if (r[fi]) KeyRatioFields[r[fi].trim()] = r[vi] === '' ? null : r[vi];
      return ok(res, { KeyRatioFields, keyCalFields: {} }, 'Imported');
    }
    const defs = await require('../models').KeyRatioInputField.findAll();
    const byName = new Map(defs.map((d) => [d.field_name.toLowerCase(), d]));
    const inputData = {};
    for (const r of rows) {
      const d = byName.get(String(r[fi] || '').trim().toLowerCase());
      if (!d) continue;
      ((inputData[d.tab] ||= {})[d.section] ||= []).push({ field_id: d.field_id, field_name: d.field_name, value: r[vi] });
    }
    return ok(res, { inputData, outputData: {} }, 'Imported');
  }
  // chapter module
  const fi = col('field'); const ai = col('answer'); const ri = col('remark'); const gi = col('flag'); const si = col('section');
  if (fi < 0 || ai < 0) throw new ApiError(400, 'CSV must have Field and Answer columns');
  const chapters = await Chapter.findAll({ where: { moduleId: mod.id } });
  const secs = await ChapterSection.findAll({ where: { chapterId: chapters.map((c) => c.id) }, include: [{ model: SectionField, as: 'sectionFields' }] });
  const lookup = new Map();
  for (const s of secs) for (const f of s.sectionFields) lookup.set(`${s.title.trim().toLowerCase()}|${f.fieldName.trim().toLowerCase()}`, f);
  const answers = [];
  for (const r of rows) {
    const key = `${String(si >= 0 ? r[si] : '').trim().toLowerCase()}|${String(r[fi] || '').trim().toLowerCase()}`;
    const f = lookup.get(key);
    if (!f || r[ai] === undefined || r[ai] === '') continue;
    const answer = f.fieldType === 'multiselect' ? r[ai].split(/[;|]/).map((x) => x.trim()).filter(Boolean) : r[ai];
    answers.push({ sectionFieldId: f.id, answer, remark: ri >= 0 ? r[ri] : '', isFlaged: gi >= 0 && /^(1|true|yes)$/i.test(r[gi] || '') ? 1 : 0 });
  }
  await saveAnswers(projectId, answers, true);
  ok(res, { imported: answers.length }, `${answers.length} answers imported`);
}));

module.exports = { router, chapterRows, saveAnswers };
