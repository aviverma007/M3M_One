/*
 * Seeds reference data and the first super admin.
 *   node seed/seed.js            (idempotent — skips anything already present)
 * Reference data files live in seed/data/ (not committed; company data):
 *   benchmarks.json, chapters-residential.json, keyratio-residential.json
 * Original ids are preserved so a data export from the previous system can be imported unchanged.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const {
  sequelize, User, Module, Chapter, ChapterSection, SectionField, SectionFieldOption, KeyRatioBenchmark, Benchmark,
} = require('../src/models');

const DATA = path.join(__dirname, 'data');
const load = (f) => (fs.existsSync(path.join(DATA, f)) ? JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')) : null);

// Explicit ids on SQL Server need IDENTITY_INSERT
async function withIdentity(table, fn) {
  if (config.db.dialect !== 'mssql') return fn();
  await sequelize.query(`SET IDENTITY_INSERT [${table}] ON`);
  try { return await fn(); } finally { await sequelize.query(`SET IDENTITY_INSERT [${table}] OFF`); }
}

const MODULES = [
  { id: 1, moduleNumber: 1, name: 'Key Ratio', projectType: 'residential' },
  { id: 2, moduleNumber: 2, name: 'Apartment Design', projectType: 'residential' },
  { id: 3, moduleNumber: 3, name: 'Common Design', projectType: 'residential' },
  { id: 4, moduleNumber: 1, name: 'Key Ratio', projectType: 'commercial' },
  { id: 9, moduleNumber: 2, name: 'Apartment Design', projectType: 'commercial' },
  { id: 10, moduleNumber: 3, name: 'Common Design', projectType: 'commercial' },
  { id: 5, moduleNumber: 21, name: 'Commercial Complex Design Considerations', projectType: 'commercial' },
];
// Commercial chapter titles (question bank for these still to be imported from the previous system's export)
const COMMERCIAL_CHAPTERS = [
  [65, 9, 1, 'flooring'], [66, 9, 2, 'Wall'], [67, 9, 3, 'Ceiling'], [68, 9, 4, 'Doors, frame, lock'], [69, 9, 5, 'Kitchen Goods'], [70, 9, 6, 'Electricals'], [71, 9, 7, 'Bathroom Accessories'],
  [72, 10, 1, 'Flooring'], [73, 10, 2, 'Walls & Ceiling'], [74, 10, 3, 'Doors & Other Facilities'],
  [11, 5, 1, 'Flooring & Skirting'], [12, 5, 2, 'Walls'], [13, 5, 3, 'Celing'], [14, 5, 4, 'Doors & Balcony'], [15, 5, 5, 'Restroom & Electricals'],
];

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) { console.log('• admin: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first super admin'); return; }
  if (await User.findOne({ where: { email } })) { console.log(`• admin: ${email} already exists`); return; }
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  await User.create({ name: process.env.ADMIN_NAME || 'Super Admin', email, password: await bcrypt.hash(password, 10), role: 'super_admin', department: 'super_admin', status: 'active' });
  console.log(`• admin: created ${email}`);
}

async function seedModules() {
  let n = 0;
  await withIdentity('modules', async () => {
    for (const m of MODULES) if (!(await Module.findByPk(m.id))) { await Module.create(m); n++; }
  });
  console.log(`• modules: ${n} added`);
}

async function seedQuestionBank() {
  const chapters = load('chapters-residential.json');
  let c = 0; let s = 0; let f = 0; let o = 0;
  if (chapters) {
    const byModule = {};
    chapters.forEach((ch) => { (byModule[ch.mod] ||= []).push(ch.n); });
    for (const ch of chapters) {
      if (!(await Chapter.findByPk(ch.id))) {
        await withIdentity('chapters', () => Chapter.create({ id: ch.id, moduleId: ch.mod, title: ch.t.replace(/\s+/g, ' ').trim(), chapterNumber: ch.n, isLastChapter: ch.n === Math.max(...byModule[ch.mod]) }));
        c++;
      }
      for (const sec of ch.secs) {
        if (!(await ChapterSection.findByPk(sec.id))) { await withIdentity('chapter_sections', () => ChapterSection.create({ id: sec.id, chapterId: ch.id, title: sec.t, content: sec.c })); s++; }
        for (const fld of sec.f) {
          if (!(await SectionField.findByPk(fld.i))) {
            await withIdentity('section_fields', () => SectionField.create({
              id: fld.i, sectionId: sec.id, fieldName: fld.n, fieldType: fld.ty,
              midEndAns: fld.me || null, premiumAns: fld.pr || null, affluentAns: fld.af || null, hiStreetAns: fld.hs || null, enclosedMallAns: fld.em || null, inputValue: fld.iv || null,
            }));
            f++;
          }
          for (const opt of fld.op || []) {
            const idx = opt.indexOf(':');
            const id = Number(opt.slice(0, idx)); const text = opt.slice(idx + 1);
            if (!(await SectionFieldOption.findByPk(id))) { await withIdentity('section_field_options', () => SectionFieldOption.create({ id, sectionFieldId: fld.i, fieldOption: text })); o++; }
          }
        }
      }
    }
  } else console.log('• question bank: seed/data/chapters-residential.json not found — skipped');
  for (const [id, moduleId, n, title] of COMMERCIAL_CHAPTERS) {
    if (!(await Chapter.findByPk(id))) {
      const last = Math.max(...COMMERCIAL_CHAPTERS.filter((x) => x[1] === moduleId).map((x) => x[2]));
      await withIdentity('chapters', () => Chapter.create({ id, moduleId, title, chapterNumber: n, isLastChapter: n === last }));
      c++;
    }
  }
  console.log(`• question bank: ${c} chapters, ${s} sections, ${f} fields, ${o} options added`);
}

async function seedKeyRatio() {
  const rows = load('keyratio-residential.json');
  if (!rows) { console.log('• key ratio: seed/data/keyratio-residential.json not found — skipped'); return; }
  let n = 0;
  await withIdentity('key_ratio_benchmarks', async () => {
    for (const r of rows) if (!(await KeyRatioBenchmark.findByPk(r.id))) { await KeyRatioBenchmark.create({ ...r, kind: 'residential' }); n++; }
  });
  console.log(`• key ratio benchmarks: ${n} added`);
}

async function seedBenchmarks() {
  const data = load('benchmarks.json');
  if (!data) { console.log('• benchmarks: seed/data/benchmarks.json not found — skipped'); return; }
  let n = 0;
  for (const [label, v] of Object.entries(data.data || data)) {
    if (!(await Benchmark.findOne({ where: { label } }))) { await Benchmark.create({ label, benchmarkValue: v.benchmarkValue || '', validOptions: v.validOptions || [], status: v.status || '' }); n++; }
  }
  console.log(`• benchmarks: ${n} added`);
}

(async () => {
  try {
    await sequelize.authenticate();
    if (config.db.dialect === 'sqlite') await sequelize.sync();
    await seedAdmin();
    await seedModules();
    await seedQuestionBank();
    await seedKeyRatio();
    await seedBenchmarks();
    console.log('Seed complete.');
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exit(1);
  }
})();
