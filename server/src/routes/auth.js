const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { ok, ah, ApiError } = require('../utils/http');
const { requireAuth, sign, isSuperAdmin } = require('../middleware/auth');
const { audit } = require('../services/audit');
const config = require('../config');

const publicUser = (u) => {
  const p = u.get ? u.get({ plain: true }) : { ...u };
  delete p.password; delete p.resetToken; delete p.resetTokenExpires; delete p.failedLoginAttempts; delete p.lockUntil;
  return p;
};

// ---------------------------------------------------------------- login / session
router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const user = await User.unscoped().findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user) throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
    throw new ApiError(423, 'Account is temporarily locked', 'LOCKED', { lockUntil: user.lockUntil });
  }
  if (user.status === 'inactive') throw new ApiError(403, 'Account is inactive', 'INACTIVE');
  const valid = user.password && await bcrypt.compare(password, user.password);
  if (!valid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    if (attempts >= config.maxLoginAttempts) {
      const lockUntil = new Date(Date.now() + config.lockMinutes * 60 * 1000);
      await user.update({ failedLoginAttempts: 0, lockUntil });
      throw new ApiError(423, 'Account is temporarily locked', 'LOCKED', { lockUntil });
    }
    await user.update({ failedLoginAttempts: attempts });
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  await user.update({ failedLoginAttempts: 0, lockUntil: null });
  await audit(user.id, 'User Login', `${user.name || user.email} logged in`);
  ok(res, { accessToken: sign(user), user: publicUser(user), role: user.role }, 'Login successful');
}));

router.get('/me', requireAuth, ah(async (req, res) => ok(res, publicUser(req.user))));

router.post('/forgot-password', ah(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = await User.unscoped().findOne({ where: { email } });
  // Always answer success so the endpoint cannot be used to discover accounts
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ resetToken: crypto.createHash('sha256').update(token).digest('hex'), resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) });
    const link = `${config.corsOrigin.split(',')[0]}/reset-password?token=${token}`;
    // TODO: send via SMTP / Microsoft Graph. Until mail is configured the link is written to the server log.
    console.log(`[password-reset] ${email}: ${link}`);
  }
  ok(res, null, 'Reset link sent to your email');
}));

router.post('/reset-password', ah(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || String(password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters long');
  const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
  const user = await User.unscoped().findOne({ where: { resetToken: hashed, resetTokenExpires: { [Op.gt]: new Date() } } });
  if (!user) throw new ApiError(400, 'Reset link is invalid or has expired');
  await user.update({ password: await bcrypt.hash(password, 10), resetToken: null, resetTokenExpires: null, failedLoginAttempts: 0, lockUntil: null });
  await audit(user.id, 'Password Reset', `${user.email} reset their password`);
  ok(res, null, 'Password reset successfully');
}));

// ---------------------------------------------------------------- users
// Which departments can be assigned a design-brief section
const ASSIGNEE_DEPARTMENTS = {
  liaison: ['liaison'],
  'business-development': ['business-development', 'bd', 'bt', 'pl'],
  land: ['land'],
  structure: ['structure', 'design_str'],
  mep: ['mep', 'design_mep'],
};

router.get('/users', requireAuth, ah(async (req, res) => {
  const { assigneesFor } = req.query;
  if (assigneesFor) {
    const depts = ASSIGNEE_DEPARTMENTS[assigneesFor] || [assigneesFor];
    let users = await User.findAll({ where: { department: { [Op.in]: depts }, status: 'active' }, attributes: ['id', 'name', 'email', 'role', 'department'], order: [['name', 'ASC']] });
    if (!users.length) {
      users = await User.findAll({ where: { role: { [Op.in]: ['general_admin', 'general_contributor'] }, status: 'active' }, attributes: ['id', 'name', 'email', 'role', 'department'], order: [['name', 'ASC']] });
    }
    return ok(res, users);
  }
  const users = await User.findAll({ order: [['createdAt', 'DESC']] });
  ok(res, users.map(publicUser));
}));

const userBody = (b) => {
  const out = {};
  for (const k of ['name', 'email', 'phone', 'company', 'department', 'role', 'status']) if (b[k] !== undefined) out[k] = b[k];
  if (out.email) out.email = String(out.email).trim().toLowerCase();
  return out;
};

router.post('/users', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can create users', 'FORBIDDEN');
  const body = userBody(req.body || {});
  if (!body.email) throw new ApiError(400, 'Email is required');
  if (await User.findOne({ where: { email: body.email } })) throw new ApiError(409, 'A user with this email already exists', 'DUPLICATE');
  if (!req.body.password || String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters long');
  body.password = await bcrypt.hash(req.body.password, 10);
  const user = await User.create(body);
  await audit(req.user.id, 'User Created', `Created user ${user.email}`);
  ok(res, publicUser(user), 'User created', 201);
}));

router.put('/users/:id', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can edit users', 'FORBIDDEN');
  const user = await User.unscoped().findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  const body = userBody(req.body || {});
  if (req.body.password) {
    if (String(req.body.password).length < 8) throw new ApiError(400, 'Password must be at least 8 characters long');
    body.password = await bcrypt.hash(req.body.password, 10);
  }
  await user.update(body);
  await audit(req.user.id, 'User Updated', `Updated user ${user.email}`);
  ok(res, publicUser(user), 'User updated');
}));

router.delete('/users/:id', requireAuth, ah(async (req, res) => {
  if (!isSuperAdmin(req.user)) throw new ApiError(403, 'Only super admins can delete users', 'FORBIDDEN');
  if (Number(req.params.id) === req.user.id) throw new ApiError(400, 'You cannot delete your own account');
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await user.destroy();
  await audit(req.user.id, 'User Deleted', `Deleted user ${user.email}`);
  ok(res, null, 'User deleted');
}));

module.exports = router;
