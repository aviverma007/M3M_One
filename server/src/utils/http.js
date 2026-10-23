// Response envelope identical to the original API: { success, message, data }
class ApiError extends Error {
  constructor(statusCode, message, errorCode, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode || (statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST');
    this.data = data;
  }
}

const ok = (res, data = null, message = '', status = 200) => res.status(status).json({ success: true, message, data });

// Wrap async route handlers so thrown errors reach the error middleware
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || (err.name === 'SequelizeValidationError' ? 400 : 500);
  if (statusCode >= 500) console.error(err);
  res.status(statusCode).json({
    success: false,
    errorCode: err.errorCode || 'SERVER_ERROR',
    statusCode,
    message: statusCode >= 500 && process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    data: err.data ?? null,
    status: 'Failed',
  });
};

const toInt = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

module.exports = { ApiError, ok, ah, errorHandler, toInt };
