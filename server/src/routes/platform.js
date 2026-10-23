// Roles, notifications, audit logs, uploads, dropdown metadata and benchmarks
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Op } = require('sequelize');
const { Role, Notification, AuditLog, User, Upload, DropdownOption, Benchmark } = require('../models');
const { ok, ah, ApiError, toInt } = require('../utils/http');
const { requireAuth, isSuperAdmin } = require('../middleware/auth');
const { audit } = require('../services/audit');
const config = require('../config');

const router = express.Router();

// ---------------------------------------------------------------- roles / module access
router.get('/roles', requireAuth, ah(async (_req, res) => ok(res, await Role.findAll({ order: [['id', 'ASC']] }))));

router.post('/roles', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can manage roles', 'FORBIDDEN');
  const { roleName, description, permissions } = req.body || {};
  if (!roleName) throw new ApiError(400, 'roleName is required');
  const existing = await Role.findOne({ where: { roleName } });
  if (existing) {
    await existing.update({ description: description ?? existing.description, permissions });
    return ok(res, existing, 'Role updated');
  }
  ok(res, await Role.create({ roleName, description, permissions }), 'Role created', 201);
}));

router.put('/roles/:id', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can manage roles', 'FORBIDDEN');
  const role = await Role.findByPk(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found');
  const { roleName, description, permissions } = req.body || {};
  await role.update({ roleName: roleName ?? role.roleName, description: description ?? role.description, permissions: permissions ?? role.permissions });
  ok(res, role, 'Role updated');
}));

router.delete('/roles/:id', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can manage roles', 'FORBIDDEN');
  await Role.destroy({ where: { id: req.params.id } });
  ok(res, null, 'Role deleted');
}));

// ---------------------------------------------------------------- notifications
router.get('/notifications', requireAuth, ah(async (req, res) => {
  const limit = toInt(req.query.limit, 10);
  const { rows, count } = await Notification.findAndCountAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit });
  ok(res, { rows, count });
}));
router.put('/notifications/mark-all-read', requireAuth, ah(async (req, res) => {
  await Notification.update({ isRead: true }, { where: { userId: req.user.id } });
  ok(res, null, 'All notifications marked as read');
}));
router.put('/notifications/:id/read', requireAuth, ah(async (req, res) => {
  await Notification.update({ isRead: true }, { where: { id: req.params.id, userId: req.user.id } });
  ok(res, null, 'Notification marked as read');
}));

// ---------------------------------------------------------------- audit logs
const auditWhere = (q) => {
  const where = {};
  if (q.type) where.taskType = q.type;
  if (q.fromDate || q.toDate) {
    where.createdAt = {};
    if (q.fromDate) where.createdAt[Op.gte] = new Date(`${q.fromDate}T00:00:00`);
    if (q.toDate) where.createdAt[Op.lte] = new Date(`${q.toDate}T23:59:59.999`);
  }
  const include = [{ model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }];
  if (q.search) {
    const s = `%${q.search}%`;
    where[Op.or] = [{ description: { [Op.like]: s } }, { taskType: { [Op.like]: s } }, { '$Creator.name$': { [Op.like]: s } }];
  }
  return { where, include };
};

router.get('/audit-logs', requireAuth, ah(async (req, res) => {
  const page = toInt(req.query.page, 1);
  const limit = toInt(req.query.limit, 10);
  const { where, include } = auditWhere(req.query);
  const { rows, count } = await AuditLog.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit, subQuery: false });
  ok(res, { logs: rows, totalPages: Math.ceil(count / limit), totalLogs: count });
}));

router.get('/audit-logs/export', requireAuth, ah(async (req, res) => {
  const { where, include } = auditWhere(req.query);
  const rows = await AuditLog.findAll({ where, include, order: [['createdAt', 'DESC']], subQuery: false });
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['S.No', 'User', 'Date & Time', 'Task Type', 'Task Description'].map(esc).join(',')];
  rows.forEach((r, i) => lines.push([i + 1, r.Creator?.name || 'System', new Date(r.createdAt).toISOString(), r.taskType, r.description].map(esc).join(',')));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
  res.send(lines.join('\n'));
}));

// ---------------------------------------------------------------- uploads (local disk; swap for S3/Blob storage later)
fs.mkdirSync(config.uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_').slice(-120);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/upload', requireAuth, upload.single('file'), ah(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded');
  const url = `${config.publicUrl}/uploads/${encodeURIComponent(req.file.filename)}`;
  const rec = await Upload.create({ userId: req.user.id, originalName: req.file.originalname, storedName: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, url });
  // Original API answered both data.s3Url and data.data.s3Url depending on the caller — return both shapes
  ok(res, { id: rec.id, s3Url: url, url, fileName: req.file.originalname, data: { s3Url: url } }, 'File uploaded');
}));

// ---------------------------------------------------------------- dropdown metadata ("Any Other" options)
router.get('/metadata/dropdown-options/:fieldKey', requireAuth, ah(async (req, res) => {
  ok(res, await DropdownOption.findAll({ where: { fieldKey: req.params.fieldKey }, attributes: ['id', 'optionValue'], order: [['id', 'ASC']] }));
}));
router.post('/metadata/dropdown-options', requireAuth, ah(async (req, res) => {
  const { fieldKey, optionValue } = req.body || {};
  if (!fieldKey || !optionValue) throw new ApiError(400, 'fieldKey and optionValue are required');
  const [opt] = await DropdownOption.findOrCreate({ where: { fieldKey, optionValue }, defaults: { userId: req.user.id } });
  ok(res, { id: opt.id, optionValue: opt.optionValue }, 'Option added', 201);
}));
router.delete('/metadata/dropdown-options/:id', requireAuth, ah(async (req, res) => {
  await DropdownOption.destroy({ where: { id: req.params.id } });
  ok(res, null, 'Option deleted');
}));

// ---------------------------------------------------------------- benchmark dictionary
router.get('/benchmark', ah(async (_req, res) => {
  const rows = await Benchmark.findAll();
  const out = {};
  for (const r of rows) out[r.label] = { benchmarkValue: r.benchmarkValue || '', validOptions: r.validOptions || [], status: r.status || '' };
  res.json({ success: true, data: out });
}));

module.exports = router;
