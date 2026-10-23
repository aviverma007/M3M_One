const { Sequelize } = require('sequelize');
const { db } = require('./index');

let sequelize;
if (db.dialect === 'sqlite') {
  sequelize = new Sequelize({ dialect: 'sqlite', storage: db.storage, logging: db.logging ? console.log : false });
} else {
  sequelize = new Sequelize(db.database, db.username, db.password, {
    host: db.host,
    port: db.port,
    dialect: db.dialect,
    logging: db.logging ? console.log : false,
    dialectOptions: db.dialect === 'mssql'
      ? { options: { encrypt: db.encrypt, trustServerCertificate: db.trustServerCertificate } }
      : {},
    pool: { max: 10, min: 0, idle: 10000 },
  });
}

module.exports = sequelize;
