const config = require('./config');
const { sequelize } = require('./models');
const app = require('./app');

(async () => {
  try {
    await sequelize.authenticate();
    // SQL Server tables are created by database/schema.sql; only auto-create for local SQLite
    if (config.db.dialect === 'sqlite') await sequelize.sync();
    app.listen(config.port, () => console.log(`M3M One API listening on :${config.port}${config.apiPrefix} (${config.db.dialect})`));
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
})();
