require('dotenv').config();

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);

module.exports = {
  port: Number(env('PORT', 4000)),
  apiPrefix: env('API_PREFIX', '/v1'),
  jwtSecret: env('JWT_SECRET', 'change-me-in-production'),
  jwtExpiresIn: env('JWT_EXPIRES_IN', '1d'),
  corsOrigin: env('CORS_ORIGIN', 'http://localhost:5173'),
  publicUrl: env('PUBLIC_URL', 'http://localhost:4000'),
  uploadDir: env('UPLOAD_DIR', require('path').join(__dirname, '..', '..', 'uploads')),
  maxLoginAttempts: Number(env('MAX_LOGIN_ATTEMPTS', 5)),
  lockMinutes: Number(env('LOCK_MINUTES', 3)),
  db: {
    // "mssql" for SQL Server (production), "sqlite" for local development and tests
    dialect: env('DB_DIALECT', 'sqlite'),
    storage: env('DB_STORAGE', require('path').join(__dirname, '..', '..', 'data.sqlite')),
    host: env('DB_HOST', 'localhost'),
    port: Number(env('DB_PORT', 1433)),
    database: env('DB_NAME', 'm3m_one'),
    username: env('DB_USER', 'sa'),
    password: env('DB_PASSWORD', ''),
    encrypt: env('DB_ENCRYPT', 'false') === 'true',
    trustServerCertificate: env('DB_TRUST_CERT', 'true') === 'true',
    logging: env('DB_LOGGING', 'false') === 'true',
  },
};
