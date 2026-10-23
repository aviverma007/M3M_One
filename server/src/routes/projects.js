const router = require('express').Router();
const { Op } = require('sequelize');
const {
  Project, ProjectModule, KeyRatio, FieldValue, DesignBriefSummary, DEPARTMENT_MODELS, User,
} = require('../models');
const { ok, ah, ApiError, toInt } = require('../utils/http');
const { requireAuth, isSuperAdmin } = require('../middleware/auth');
const { audit } = require('../services/audit');

const PROJECT_FIELDS = [
  'name', 'description', 'projectType', 'category', 'status', 'projectOwner', 'location', 'userName', 'userEmail', 'userNumber',
  'userDesignation', 'date', 'projectClassification', 'designOwner', 'structureOwner', 'mepOwner', 'interiorDesignOwner',
  'far_permissible', 'site_area', 'site_area_acres', 'locationCategory',
];
const pick = (body) => {
  const out = {};
  for (const k of PROJECT_FIELDS) if (body[k] !== undefined) out[k] = body[k] === '' && ['far_permissible', 'site_area', 'site_area_acres'].includes(k) ? null : body[k];
  return out;
};

const canCreateProject = (u) => isSuperAdmin(u) || (String(u.department || '').toLowerCase() === 'design' && ['design_admin', 'design_contributor', 'admin'].includes(String(u.role || '').toLowerCase()));

// GET /project — list with filters (dashboard + compare picker)
router.get('/', requireAuth, ah(async (req, res) => {
  const q = req.query;
  const page = toInt(q.page, 1);
  const limit = Math.min(toInt(q.limit, 10), 1000);
  const where = {};
  if (q.search) where[Op.or] = [{ name: { [Op.like]: `%${q.search}%` } }, { category: { [Op.like]: `%${q.search}%` } }];
  if (q.projectType) where.projectType = q.projectType;
  if (q.projectCategory) where.category = q.projectCategory;
  const lc = q.locationCategory || q.lc;
  if (lc && lc !== 'All') where.locationCategory = lc;
  if (q.fromDate || q.toDate) {
    where.date = {};
    if (q.fromDate) where.date[Op.gte] = new Date(q.fromDate);
    if (q.toDate) where.date[Op.lte] = new Date(q.toDate);
  }
  const attributes = q.fields ? String(q.fields).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const { rows, count } = await Project.findAndCountAll({ where, attributes, order: [['id', 'ASC']], limit, offset: (page - 1) * limit });
  ok(res, { count, totalPages: Math.ceil(count / limit), currentPage: page, limit, rows });
}));

// GET /project/contributor/tasks — design-brief tasks assigned to the current user
router.get('/contributor/tasks', requireAuth, ah(async (req, res) => {
  const labels = { liaison: 'Liaison', businessDevelopment: 'Business Development', land: 'Land', structure: 'Structure', mep: 'MEP' };
  const rows = [];
  for (const [key, M] of Object.entries(DEPARTMENT_MODELS)) {
    const recs = await M.findAll({ where: { assignedTo: req.user.id }, include: [{ model: User, as: 'Creator', attributes: ['name'] }] });
    for (const r of recs) {
      const p = await Project.findByPk(r.projectId, { attributes: ['id', 'name', 'projectType'] });
      if (!p) continue;
      rows.push({
        id: p.id, internalTaskId: r.id, name: p.name, projectType: p.projectType, department: labels[key],
        assignedBy: r.Creator?.name || 'Admin', date: r.createdAt, createdAt: r.createdAt, deadline: r.deadline, status: r.status || 'Pending',
      });
    }
  }
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  ok(res, { rows, count: rows.length });
}));

router.get('/:id', requireAuth, ah(async (req, res) => {
  const p = await Project.findByPk(req.params.id);
  if (!p) throw new ApiError(404, 'Project not found');
  ok(res, p);
}));

router.post('/', requireAuth, ah(async (req, res) => {
  if (!canCreateProject(req.user)) throw new ApiError(403, 'You cannot create projects', 'FORBIDDEN');
  const body = pick(req.body || {});
  if (!body.name) throw new ApiError(400, 'Project Name is required');
  const p = await Project.create({ ...body, userId: req.user.id, status: 'pending' });
  await audit(req.user.id, 'Project Creation', `Created project ${p.name}`, p.id);
  ok(res, p, 'Project created successfully', 201);
}));

router.put('/:id', requireAuth, ah(async (req, res) => {
  const p = await Project.findByPk(req.params.id);
  if (!p) throw new ApiError(404, 'Project not found');
  const body = pick(req.body || {});
  // Design chapters (Project Details) may update the core record; project-form edits need create rights
  if (!canCreateProject(req.user) && Object.keys(body).some((k) => ['name', 'projectType', 'category', 'locationCategory'].includes(k))) {
    throw new ApiError(403, 'You cannot edit project information', 'FORBIDDEN');
  }
  delete body.status;
  await p.update(body);
  await audit(req.user.id, 'Project Updated', `Updated project ${p.name}`, p.id);
  ok(res, p, 'Project updated successfully');
}));

router.delete('/:id', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can delete projects', 'FORBIDDEN');
  const p = await Project.findByPk(req.params.id);
  if (!p) throw new ApiError(404, 'Project not found');
  const id = p.id;
  await Promise.all([
    ProjectModule.destroy({ where: { projectId: id } }),
    KeyRatio.destroy({ where: { project_id: id } }),
    FieldValue.destroy({ where: { projectId: id } }),
    DesignBriefSummary.destroy({ where: { projectId: id } }),
    ...Object.values(DEPARTMENT_MODELS).map((M) => M.destroy({ where: { projectId: id } })),
  ]);
  await p.destroy();
  await audit(req.user.id, 'Project Deleted', `Deleted project ${p.name}`, id);
  ok(res, null, 'Project deleted successfully');
}));

// PUT /project/:id/save-project-module — record module progress
router.put('/:id/save-project-module', requireAuth, ah(async (req, res) => {
  const { moduleId, completedChapters } = req.body || {};
  if (!moduleId) throw new ApiError(400, 'moduleId is required');
  const [pm] = await ProjectModule.findOrCreate({ where: { projectId: req.params.id, moduleId }, defaults: { status: 'active' } });
  const update = { status: pm.status === 'pending' ? 'active' : pm.status };
  if (completedChapters !== undefined) update.completedChapters = Math.max(pm.completedChapters || 0, Number(completedChapters) || 0);
  await pm.update(update);
  await require('../services/modules').refreshModuleStatus(Number(req.params.id), Number(moduleId));
  ok(res, pm, 'Module saved');
}));

module.exports = { router, canCreateProject };
