'use strict';

// TODO : ESM comment the following lines...
const { Labrat, LOGGER } = require('@ugate/labrat');
const { Manager } = require('sqler');
const Path = require('path');
const Fs = require('fs');
const Os = require('os');
const { expect } = require('@hapi/code');
const readChunk = require('read-chunk');
const imageType = require('image-type');
// TODO : import { Labrat, LOGGER } from '@ugate/labrat';
// TODO : import { Manager } from 'sqler.mjs';
// TODO : import * as Fs from 'fs';
// TODO : import * as Os from 'os';
// TODO : import { expect } from '@hapi/code';
// TODO : import * as readChunk from 'readChunk';
// TODO : import * as imageType from 'imageType';

const CONF_SUFFIX_VAR = 'SQLER_CONF_FILE_SUFFIX';
const test = {
  mgr: null,
  cache: null,
  rowCount: 2,
  mgrLogit: !!LOGGER.info,
  vendor: 'postgres',
  defaultPort: 5432,
  conf: {}
};

// TODO : ESM uncomment the following line...
// export
class Tester {

  /**
   * Create table(s) used for testing
   */
  static async before() {
    test.suffix = CONF_SUFFIX_VAR in process.env;
    Labrat.header(`${test.vendor}: Creating test tables (if any)${test.suffix ? ` ${CONF_SUFFIX_VAR}=${test.suffix}` : ''}`);
    
    const conf = getConf();
    test.cache = null;
    test.mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
    await test.mgr.init();
    
    if (test.mgr.db[test.vendor].setup) {
      const createDB = getCrudOp('create', test.vendor, 'database', true);
      await createDB(test.mgr, test.vendor);
      const createTB = getCrudOp('create', test.vendor, 'tables', true);
      await createTB(test.mgr, test.vendor);
    }
    test.created = true;
  }

  /**
   * Drop table(s) used for testing
   */
  static async after() {
    if (!test.created) {
      Labrat.header(`${test.vendor}: Skipping dropping of test tables/database`);
      return;
    }
    Labrat.header(`${test.vendor}: Dropping test tables/database (if any)`);
    
    const conf = getConf();
    test.cache = null;
    if (!test.mgr) {
      test.mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
      await test.mgr.init();
    }
    
    try {
      if (test.mgr.db[test.vendor].setup) {
        const deleteTB = getCrudOp('delete', test.vendor, 'tables', true);
        await deleteTB(test.mgr, test.vendor);
        const deleteDB = getCrudOp('delete', test.vendor, 'database', true);
        await deleteDB(test.mgr, test.vendor);
      }
      test.created = false;
    } catch (err) {
      if (LOGGER.warn) LOGGER.warn(`${test.vendor}: Failed to delete tables/database${test.suffix ? ` (${CONF_SUFFIX_VAR}=${test.suffix})` : ''}`, err);
      throw err;
    }
    return test.mgr.close();
  }

  /**
   * Start cache (if present)
   */
  static async beforeEach() {
    const cch = test.cache;
    test.cache = null;
    if (cch && cch.start) await cch.start();
  }

  /**
   * Stop cache (if present)
   */
  static async afterEach() {
    const cch = test.cache;
    test.cache = null;
    if (cch && cch.stop) await cch.stop();
  }

  //======================== Executions ========================

  /**
   * Test CRUD operations for a specified `priv.vendor` and `priv.mgr`
   */
  static async crud() {
    Labrat.header(`${test.vendor}: Running CRUD tests`, 'info');
    const rslts = new Array(3);
    let rslti = -1, lastUpdated;

    // expect CRUD results
    const crudly = (rtn, label, nameIncl, count = 2) => {
      const rslts = Array.isArray(rtn) ? rtn : [rtn];
      let cnt = 0, updated;
      for (let rslt of rslts) {
        if (!rslt.rows) continue;
        expect(rslt.rows, `CRUD ${label} rows`).array();
        if (!label.includes('read')) continue;
        cnt++;
        expect(rslt.rows, `CRUD ${label} rows.length`).length(count);
        for (let row of rslt.rows) {
          expect(row, `CRUD ${label} row`).object();
          if (nameIncl) expect(row.name, `CRUD ${label} row.name`).includes(nameIncl);
          updated = new Date(row.updated) || row.updated;
          expect(updated, `CRUD ${label} row.updated`).date();
          if (lastUpdated) expect(updated, `CRUD ${label} row.updated > lastUpdated`).greaterThan(lastUpdated);
          // expect binary report image
          if (row.report) {
            expect(row.report, 'row.report').to.be.buffer();
            if (row.reportPath) {
              const reportBuffer = readChunk.sync(row.reportPath, 0, 12);
              const reportType = imageType(reportBuffer);
              expect(reportType, 'row.report Image Type').to.be.object();
              expect(reportType.mime, 'row.report Image Mime-Type').to.equal('image/png');
            }
          }
        }
      }
      if (cnt > 0) lastUpdated = updated;
    };

    let create, read, update, del;

    create = getCrudOp('create', test.vendor, 'table.rows');
    rslts[++rslti] = await create(test.mgr, test.vendor);
    crudly(rslts[rslti], 'create');
  
    read = getCrudOp('read', test.vendor, 'table.rows');
    rslts[++rslti] = await read(test.mgr, test.vendor);
    crudly(rslts[rslti], 'read', 'TABLE');

    update = getCrudOp('update', test.vendor, 'table.rows');
    rslts[++rslti] = await update(test.mgr, test.vendor);
    crudly(rslts[rslti], 'update');
  
    rslts[++rslti] = await read(test.mgr, test.vendor);
    crudly(rslts[rslti], 'update read', 'UPDATE');
  
    del = getCrudOp('delete', test.vendor, 'table.rows');
    rslts[++rslti] = await del(test.mgr, test.vendor);
    crudly(rslts[rslti], 'delete');
  
    rslts[++rslti] = await read(test.mgr, test.vendor);
    crudly(rslts[rslti], 'delete read', null, 0);

    if (LOGGER.debug) LOGGER.debug(`CRUD ${test.vendor} execution results:`, ...rslts);
    Labrat.header(`${test.vendor}: Completed CRUD tests`, 'info');
    return rslts;
  }

  static async execDriverOptionsAlt() {
    const id = 400, name = 'TEST ALT', date = new Date();
    let created, rslt;
    try {
      created = await test.mgr.db[test.vendor].create.table1.rows({
        prepareStatement: true,
        binds: {
          id, name, created: date, updated: date
        }
      });
      expect(created, 'prepared statement results').to.be.object();
      expect(created.unprepare, 'prepared statement results unprepare').to.be.function();
      await created.unprepare();
      rslt = await test.mgr.db[test.vendor].read.table.rows({
        binds: { name },
        driverOptions: {
          query: {
            rowMode: 'array'
          }
        }
      });
    } finally {
      if (created) {
        await test.mgr.db[test.vendor].delete.table1.rows({
          binds: { id }
        });
      }
    }

    if (rslt) { // ensure the results are in array format from rowMode
      expect(rslt.rows, 'alt rslt.rows').to.be.array();
      expect(rslt.rows, 'alt rslt.rows').to.have.length(1);
      expect(rslt.rows[0], 'alt rslt.rows[0]').to.be.array();
      expect(rslt.rows[0], 'alt rslt.rows[0]').to.have.length(5);
      expect(rslt.rows[0][0], 'alt rslt.rows[0][0] (id)').to.equal(id);
      expect(rslt.rows[0][1], 'alt rslt.rows[0][1] (name)').to.equal(name);
      expect(rslt.rows[0][2], 'alt rslt.rows[0][2] (report)').to.be.null();
      expect(rslt.rows[0][3], 'alt rslt.rows[0][3] (created)').to.equal(date);
      expect(rslt.rows[0][4], 'alt rslt.rows[0][4] (updated)').to.equal(date);
    }
  }

  static async sqlInvalidThrow() {
    return test.mgr.db[test.vendor].error.update.non.exist({}, ['error']);
  }

  static async bindsInvalidThrow() {
    const date = new Date();
    return test.mgr.db[test.vendor].create.table1.rows({
      binds: {
        id: 500, name: 'SHOULD NEVER GET INSERTED (from bindsInvalidThrow)', /* "created" missing should throw error */ updated: date
      }
    });
  }

  static async preparedStatementNameThrow() {
    const date = new Date();
    return test.mgr.db[test.vendor].create.table1.rows({
      binds: {
        id: 500, name: 'SHOULD NEVER GET INSERTED (from bindsInvalidThrow)', created: date, updated: date
      },
      driverOptions: {
        query: {
          name: 'SOME_PREPARED_STATEMENT_NAME' // should fail since PS names use meta
        }
      }
    });
  }

  //====================== Configurations ======================

  static async initThrow() {
    // need to set a conf override to prevent overwritting of privateConf.username
    const conf = getConf({ pool: null });
    conf.univ.db[test.vendor].username = 'invalid';
    conf.univ.db[test.vendor].password = 'invalid';
    const mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
    await mgr.init();
    return mgr.close();
  }

  static async poolNone() {
    const conf = getConf({ pool: null, connection: null });
    const mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
    await mgr.init();
    return mgr.close();
  }

  static async poolPropSwap() {
    const conf = getConf({
      pool: (prop, conn) => {
        conn[prop] = conn[prop] || {};
        if (conn[prop].hasOwnProperty('max')) {
          delete conn[prop].max;
        } else {
          conn[prop].max = 10;
        }
        if (conn[prop].hasOwnProperty('min')) {
          delete conn[prop].min;
        } else {
          conn[prop].min = conn[prop].hasOwnProperty('max') ? conn[prop].max : 10;
        }
        if (conn[prop].hasOwnProperty('idle')) {
          delete conn[prop].idle;
        } else {
          conn[prop].idle = 1800;
        }
        if (conn[prop].hasOwnProperty('timeout')) {
          delete conn[prop].timeout;
        } else {
          conn[prop].timeout = 10000;
        }
      }
    });
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async driverOptionsNoneThrow() {
    const conf = getConf({ driverOptions: null });
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async driverOptionsPoolConnNone() {
    const conf = getConf({
      driverOptions: (prop, conn) => {
        conn[prop] = conn[prop] || {};
        conn[prop].pool = null;
        conn[prop].connection = null;
      }
    });
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async driverOptionsPoolConnSwap() {
    const conf = getConf({
      driverOptions: (prop, conn) => {
        conn[prop] = conn[prop] || {};
        if (conn[prop].pool && !conn[prop].connection) {
          conn[prop].connection = conn[prop].pool;
          conn[prop].pool = null;
        } else if (!conn[prop].pool && conn[prop].connection) {
          conn[prop].pool = conn[prop].connection;
          conn[prop].connection = null;
        } else {
          conn[prop].pool = {};
          conn[prop].connection = {};
        }
      }
    });
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async driverOptionsNamedPlaceholdersSwap() {
    const conf = getConf({
      driverOptions: (prop, conn) => {
        conn[prop] = conn[prop] || {};
        const cont = conn[prop].pool || conn[prop].connection || {};
        cont.namedPlaceholders = !cont.namedPlaceholders;
      }
    });
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async driverOptionsClient() {
    const conf = getConf({
      driverOptions: (prop, conn) => {
        conn[prop] = conn[prop] || {};
        conn[prop].client = conn[prop].client || {};
        conn[prop].client.query_timeout = conn[prop].client.query_timeout || 100;
      }
    });
    const mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
    await mgr.init();
    return mgr.close();
  }

  static async hostPortSwap() {
    // need to set a conf override to prevent overwritting of privateConf properties for other tests
    const conf = getConf({ pool: null });
    if (conf.univ.db[test.vendor].host) {
      //delete conf.univ.db[test.vendor].host;
      conf.univ.db[test.vendor].host = 'sqler_postgres_database'; // need to use alias hostname from docker "links"
    } else {
      conf.univ.db[test.vendor].host = realConf.univ.db[test.vendor].host;
    }
    if (conf.univ.db[test.vendor].hasOwnProperty('port')) {
      delete conf.univ.db[test.vendor].port;
    } else {
      conf.univ.db[test.vendor].port = test.defaultPort;
    }
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async multipleConnections() {
    const conf = getConf();
    const conn = JSON.parse(JSON.stringify(conf.db.connections[0]));
    conn.name += '2';
    conf.db.connections.push(conn);
    const mgr = new Manager(conf, test.cache, test.mgrLogit);
    await mgr.init();
    return mgr.close();
  }

  static async closeBeforeInit() {
    const conf = getConf();
    const mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
    return mgr.close();
  }

  static async state() {
    const poolCount = 4;
    const conf = getConf({
      pool: (prop, conn) => {
        conn[prop] = conn[prop] || {};
        conn[prop].min = conn[prop].max = poolCount;
      }
    });
    const mgr = new Manager(conf, test.cache, test.mgrLogit || generateTestAbyssLogger);
    await mgr.init();

    const state = await mgr.state();
    expect(state, 'state').to.be.object();
    expect(state.result, 'state.result').to.be.object();
    expect(state.result[test.vendor], `state.result.${test.vendor}`).to.be.object();
    expect(state.result[test.vendor].pending, `state.result.${test.vendor}.pending`).to.equal(0);
    expect(state.result[test.vendor].connection, `state.result.${test.vendor}.connection`).to.be.object();
    // there is no min pool count (should have 1 connection from init), need to ensure that the max is not exceeded?
    expect(state.result[test.vendor].connection.count, `state.result.${test.vendor}.connection.count`).to.equal(1);
    expect(state.result[test.vendor].connection.inUse, `state.result.${test.vendor}.connection.inUse`).to.equal(0);

    return mgr.close();
  }
}

// TODO : ESM comment the following line...
module.exports = Tester;

/**
 * Generates a configuration
 * @param {Object} [overrides] The connection configuration override properties. Each property will be deleted from the returned
 * connection configuration when falsy. When the property value is an function, the `function(propertyName, connectionConf)` will
 * be called (property not set by the callee). Otherwise, the property value will be set on the configuration.
 * @returns {Object} The configuration
 */
function getConf(overrides) {
  let conf = test.conf[test.vendor];
  if (!conf) {
    conf = test.conf[test.vendor] = JSON.parse(Fs.readFileSync(Path.join(`test/fixtures/${test.vendor}`, `conf${test.suffix || ''}.json`), 'utf8'));
    if (!test.univ) {
      test.univ = JSON.parse(Fs.readFileSync(Path.join('test/fixtures', `priv${test.suffix || ''}.json`), 'utf8')).univ;
    }
    conf.univ = test.univ;
    conf.mainPath = 'test';
    conf.db.dialects.postgres = './test/dialects/test-dialect.js';
  }
  if (overrides) {
    const confCopy = JSON.parse(JSON.stringify(conf));
    for (let dlct in conf.db.dialects) {
      confCopy.db.dialects[dlct] = conf.db.dialects[dlct];
    }
    conf = confCopy;
  }
  let exclude;
  for (let conn of conf.db.connections) {
    for (let prop in conn) {
      if (!conn.hasOwnProperty(prop)) continue;
      exclude = overrides && overrides.hasOwnProperty(prop);
      if (exclude) {
        if (typeof overrides[prop] === 'function') overrides[prop](prop, conn);
        else if (overrides[prop]) conn[prop] = overrides[prop];
        else delete conn[prop];
      } else if (prop === 'pool') {
        conn.pool.min = Math.floor((process.env.UV_THREADPOOL_SIZE - 1) / 2) || 2;
        conn.pool.max = process.env.UV_THREADPOOL_SIZE ? process.env.UV_THREADPOOL_SIZE - 1 : conn.pool.min;
        conn.pool.increment = 1;
        if (!overrides) return conf; // no need to continue since there are no more options that need to be set manually
      }
    }
  }
  return conf;
}

/**
 * Gets the `async function` that will execute a CRUD operation
 * @param {String} cmd The command name of the CRUD operation (e.g. `create`, `read`, etc.)
 * @param {String} vendor The vendor to use (e.g. `oracle`, `mssql`, etc.)
 * @param {String} key Key that indicates the file name (w/o extension)
 * @param {Boolean} [isSetup] Truthy when the CRUD operation is for a setup operation (e.g. creating/dropping tables)
 * @returns {Function} The `async function(manager)` that will return the CRUD results
 */
function getCrudOp(cmd, vendor, key, isSetup) {
  const base = Path.join(process.cwd(), `test/lib/${vendor}${isSetup ? '/setup' : ''}`);
  const pth = Path.join(base, `${cmd}.${key}.js`);
  return require(pth);
}

/**
 * Generate a test logger that just consumes logging
 * @param {Sring[]} [tags] The tags that will prefix the log output
 */
function generateTestAbyssLogger() {
  return function testAbyssLogger() {};
}

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Labrat.usingTestRunner()) {
  // ensure unhandled rejections puke with a non-zero exit code
  process.on('unhandledRejection', up => { throw up });
  // run the test(s)
  (async () => await Labrat.run(Tester))();
}