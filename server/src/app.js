const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { errorHandler, ApiError } = require('./utils/http');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));

// Uploaded files
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const api = express.Router();
api.use('/auth', require('./routes/auth'));
api.use('/project', require('./routes/projects').router);
api.use('/', require('./routes/modules').router);
api.use('/', require('./routes/keyRatio'));
api.use('/', require('./routes/platform'));
app.use(config.apiPrefix, api);

// Web app (client/dist after `npm run build` in client/) — served from the same port
const path = require('path');
const fs = require('fs');
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/v1\/|\/uploads\/|\/health).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

module.exports = app;
