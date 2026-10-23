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

app.use((req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`)));
app.use(errorHandler);

module.exports = app;
