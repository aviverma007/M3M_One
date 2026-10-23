const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { User } = require('../models');
const { ApiError } = require('../utils/http');

const SUPER_ADMINS = ['super_admin', 'superadmin', 'admin', 'super admin'];
const isSuperAdmin = (u) => !!u && (SUPER_ADMINS.includes(String(u.role || '').toLowerCase()) || String(u.department || '').toLowerCase() === 'super_admin');

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token || token === 'null' || token === 'undefined') throw new ApiError(401, 'Access denied. No token provided', 'UNAUTHORIZED');
    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch (e) {
      throw new ApiError(401, e.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token', e.name === 'TokenExpiredError' ? 'ACCESS_TOKEN_EXPIRED' : 'UNAUTHORIZED');
    }
    const user = await User.findByPk(payload.id);
    if (!user || user.status === 'inactive') throw new ApiError(401, 'User not found or inactive', 'UNAUTHORIZED');
    req.user = user.get({ plain: true });
    next();
  } catch (e) { next(e); }
}

// Restrict a route to the listed roles (super admins always pass)
const requireRole = (...roles) => (req, _res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (isSuperAdmin(req.user) || roles.includes(role)) return next();
  next(new ApiError(403, 'You do not have permission to perform this action', 'FORBIDDEN'));
};

const sign = (user) => jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: require('../config').jwtExpiresIn });

module.exports = { requireAuth, requireRole, isSuperAdmin, sign, SUPER_ADMINS };
